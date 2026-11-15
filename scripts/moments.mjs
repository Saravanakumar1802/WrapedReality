/**
 * AI moment index: turns each playthrough video (its transcript and chapters)
 * into findable moments: bosses, story beats, places, puzzles, tips, the funny
 * and the emotional bits, each with an exact timestamp, a spoiler flag and tags.
 *
 * Why an LLM: a 3-hour playthrough is unsearchable. YouTube finds a video, not
 * the 40 seconds inside it where a boss is beaten. Reading a transcript and
 * naming "what happens when" is what a language model is good at, and nobody
 * will do it by hand for hundreds of hours of video. It runs at build time, so
 * the site stays static (no server, no key in the browser, no per-visitor cost).
 *
 * Token budget (free tiers have daily limits, paid ones cost per token):
 *  - each video is indexed once; results are cached by content hash, and the key
 *    ignores the model, so switching provider never re-spends tokens
 *  - input is compressed: 30 s windows, filler words and [Music] tags removed,
 *    repeated lines dropped, timestamps as plain seconds
 *  - output is one compact line per moment (no JSON keys or indentation), the
 *    number of moments scales with video length, and output tokens are capped
 *  - a short fixed instruction, no "thinking", and a per-run video cap
 *
 * Model: scripts/llm.mjs (Gemini free tier by default).
 */
import { hashString } from "../src/lib/math.js";
import { createLLM } from "./llm.mjs";
import { env, log, p, readJson, sleep, writeJson } from "./util.mjs";

export const MOMENT_KINDS = [
  "boss",
  "story",
  "combat",
  "exploration",
  "puzzle",
  "collectible",
  "tip",
  "funny",
  "emotional",
  "ending",
  "other",
];
/** Bump when the prompt or output format changes: every video is re-indexed once. */
export const PROMPT_VERSION = 2;
const CACHE = p("cache", "moments.json");
/** Videos indexed per run, so a free daily quota is never exhausted in one go. The rest go next run. */
const maxPerRun = () => Number(env("LLM_MAX_VIDEOS")) || 25;

const SYSTEM = `You index gameplay videos so viewers can jump to moments. Input: game, video, length, chapters and transcript lines, each starting with a time in seconds.
Output only lines, no other text:
S|<one short spoiler-free sentence: what this video covers>
<seconds>|<kind>|<spoiler 0 or 1>|<title, max 60 chars>|<what happens, max 90 chars>|<up to 4 keywords, comma separated>
kind is one of: ${MOMENT_KINDS.join(", ")}.
Rules: times must come from the input lines. Only state what the input supports. Use the game's own names for characters, bosses, places and items. spoiler=1 for twists, deaths, reveals, late bosses, endings. Skip menus, loading and dead air. Never use "|" inside a field.`;

// ── input compression ───────────────────────────────────────────────────────

const NOISE = /\[(?:music|applause|laughter|laughs|inaudible|silence|noise|cheering|foreign)\]|[♪♫]+/gi;
const FILLER = /\b(?:um+|uh+|erm+|hmm+|ah+|uh-huh|mm+)\b[,.]?\s*/gi;

/**
 * Transcript cues → compact "seconds text" lines: noise and filler removed,
 * repeated lines dropped, merged into `window`-second blocks.
 * @param {{ t: number, text: string }[]} cues
 */
export function compactTranscript(cues, window = 30) {
  const lines = [];
  let start = null;
  let buf = [];
  let last = "";
  const flush = () => {
    const text = buf.join(" ").replace(/\s+/g, " ").trim();
    if (text) lines.push(`${Math.round(start)} ${text}`);
    buf = [];
  };
  for (const c of cues) {
    const text = c.text
      .replace(NOISE, " ")
      .replace(FILLER, "")
      .replace(/\b(\w+)( \1\b)+/gi, "$1")
      .trim();
    if (!text || text.toLowerCase() === last) continue;
    last = text.toLowerCase();
    if (start === null) start = c.t;
    if (c.t - start >= window && buf.length) {
      flush();
      start = c.t;
    }
    buf.push(text);
  }
  if (buf.length) flush();
  return lines;
}

/** How many moments to ask for: about one per 4 minutes, between 4 and 30. */
export function momentTarget(duration, chapters = 0) {
  const byLength = duration ? Math.round(duration / 240) : 8;
  return Math.max(4, Math.min(30, Math.max(byLength, chapters)));
}

/** Builds the (compact) user message for one video. */
export function buildPrompt({ game, video, duration, chapters, cues }) {
  const lines = compactTranscript(cues);
  const target = momentTarget(duration, chapters.length);
  return [
    `Game: ${game.title} (${game.platform}${game.year ? ` ${game.year}` : ""})`,
    `Video: ${video.title}${duration ? ` (${Math.round(duration)} s)` : ""}`,
    `Give about ${target} moments.`,
    chapters.length ? `Chapters:\n${chapters.map((c) => `${Math.round(c.t)} ${c.title}`).join("\n")}` : "",
    lines.length ? `Transcript:\n${lines.join("\n")}` : "No transcript: use the chapters.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── output parsing ──────────────────────────────────────────────────────────

/**
 * Reads the compact line format. Lines that don't parse are dropped.
 * @returns {{ summary: string, moments: { t: number, kind: string, spoiler: boolean, title: string, detail: string, tags: string[] }[] }}
 */
export function parseMomentLines(text) {
  let summary = "";
  const moments = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-*•]\s*/, "");
    if (!line) continue;
    if (/^S\s*\|/i.test(line)) {
      summary = line.replace(/^S\s*\|/i, "").trim();
      continue;
    }
    const [t, kind, spoiler, title, detail = "", tags = ""] = line.split("|").map((s) => s.trim());
    const seconds = Number(t);
    if (!Number.isFinite(seconds) || !title) continue;
    moments.push({
      t: seconds,
      kind: (kind ?? "").toLowerCase(),
      spoiler: spoiler === "1" || /^(true|yes)$/i.test(spoiler ?? ""),
      title,
      detail,
      tags: tags ? tags.split(",") : [],
    });
  }
  return { summary, moments };
}

/**
 * Validates and tidies moments: inside the video, sorted, no two within 20 s of
 * each other, fields trimmed to size.
 * @param {{ t: number, title: string, detail?: string, kind?: string, spoiler?: boolean, tags?: string[] }[]} moments
 * @param {{ duration?: number | null, max?: number }} opts
 */
export function cleanMoments(moments, { duration = null, max = 40 } = {}) {
  const limit = duration ? duration - 1 : Infinity;
  const sorted = moments
    .filter((m) => Number.isFinite(m.t) && m.t >= 0 && m.t <= limit && m.title?.trim())
    .map((m) => ({
      t: Math.round(m.t),
      title: m.title.trim().slice(0, 70),
      detail: (m.detail ?? "").trim().slice(0, 160),
      kind: MOMENT_KINDS.includes(m.kind) ? m.kind : "other",
      spoiler: Boolean(m.spoiler),
      tags: [...new Set((m.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 4),
    }))
    .sort((a, b) => a.t - b.t);
  const out = [];
  for (const m of sorted) if (!out.length || m.t - out[out.length - 1].t >= 20) out.push(m);
  return out.slice(0, max);
}

/** Chapters as moments, with no model at all (used when no key is set). */
export const chaptersAsMoments = (chapters, duration) =>
  cleanMoments(
    chapters.map((c) => ({ t: c.t, title: c.title })),
    { duration },
  );

// ── the model call ──────────────────────────────────────────────────────────

/**
 * One model call for one video.
 * @param {{ complete: (req: { system: string, prompt: string, maxOutputTokens: number }) => Promise<{ text: string, usage: { input: number, output: number } }> }} llm
 */
export async function extractMoments(llm, input) {
  const target = momentTarget(input.duration, input.chapters.length);
  // ~45 tokens per line plus the summary, with headroom; never an open-ended answer
  const { text, usage } = await llm.complete({
    system: SYSTEM,
    prompt: buildPrompt(input),
    maxOutputTokens: Math.min(4000, 120 + target * 70),
  });
  const parsed = parseMomentLines(text);
  const moments = cleanMoments(parsed.moments, { duration: input.duration, max: target + 6 });
  if (!moments.length) throw new Error("no usable moments in the answer");
  return { summary: parsed.summary.slice(0, 200), moments, usage };
}

const cacheKey = (input) => `${PROMPT_VERSION}|${input.video.id}|${hashString(buildPrompt(input))}`;

/**
 * Indexes every video that has a transcript or chapters.
 * @param {{ game: any, video: { id: string, title: string, duration?: number | null } }[]} jobs
 * @param {Record<string, { cues: any[], chapters: any[] }>} transcripts
 * @param {{ llm?: any, cacheFile?: string, gapMs?: number }} [opts] model, cache location and pacing are injectable for tests
 * @returns {Promise<Record<string, { summary: string, moments: any[] }>>} by video id
 */
export async function indexMoments(jobs, transcripts, { llm = undefined, cacheFile = CACHE, gapMs = 1500 } = {}) {
  const cache = await readJson(cacheFile, { items: {} });
  const out = {};
  const todo = [];
  for (const { game, video } of jobs) {
    const tr = transcripts[video.id];
    if (!tr) continue;
    const input = { game, video, duration: video.duration ?? null, chapters: tr.chapters, cues: tr.cues };
    const key = cacheKey(input);
    const hit = cache.items[key];
    if (hit) out[video.id] = { summary: hit.summary, moments: hit.moments };
    else todo.push({ key, input });
  }

  const model = llm === undefined ? createLLM() : llm;
  if (todo.length && !model) {
    // free fallback: chapters still become moments, just without spoiler flags and tags
    for (const { input } of todo) {
      const moments = chaptersAsMoments(input.chapters, input.duration);
      if (moments.length) out[input.video.id] = { summary: "", moments };
    }
    log.warn(`Moments: ${todo.length} video(s) need the AI step. Set GEMINI_API_KEY (free) to index them; chapters are used meanwhile.`);
  } else if (todo.length) {
    const batch = todo.slice(0, maxPerRun());
    const tokens = { input: 0, output: 0 };
    let done = 0;
    for (const job of batch) {
      try {
        const { usage, ...result } = await extractMoments(model, job.input);
        cache.items[job.key] = { ...result, videoId: job.input.video.id };
        out[job.input.video.id] = result;
        tokens.input += usage.input;
        tokens.output += usage.output;
        done++;
        log.info(
          `Moments: ${job.input.game.title}: "${job.input.video.title}" → ${result.moments.length} (${usage.input}+${usage.output} tokens)`,
        );
        await writeJson(cacheFile, cache); // saved after every video: an interrupted run loses nothing
      } catch (err) {
        log.warn(`Moments: "${job.input.video.title}" skipped (${err.message})`);
      }
      if (gapMs) await sleep(gapMs); // stay under free-tier requests-per-minute limits
    }
    const live = new Set(jobs.map(({ video }) => video.id));
    for (const [k, v] of Object.entries(cache.items)) if (!live.has(v.videoId ?? k.split("|")[1])) delete cache.items[k];
    await writeJson(cacheFile, cache);
    log.ok(`Moments: indexed ${done}/${batch.length} with ${model.name} ${model.model}; tokens in ${tokens.input}, out ${tokens.output}`);
    if (todo.length > batch.length)
      log.info(`Moments: ${todo.length - batch.length} more video(s) next run (LLM_MAX_VIDEOS=${maxPerRun()}).`);
  }
  const total = Object.values(out).reduce((n, v) => n + v.moments.length, 0);
  if (Object.keys(out).length) log.ok(`Moments: ${total} moments across ${Object.keys(out).length} video(s)`);
  return out;
}
