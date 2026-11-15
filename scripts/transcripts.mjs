/**
 * Transcripts for the channel's videos: what was said, and when.
 *
 * Sources, best first (all optional; a video can have none):
 *  1. content/transcripts/<videoId>.srt | .vtt  (caption files downloaded from YouTube Studio)
 *  2. YouTube captions API, for the channel owner (OAuth refresh token, see README)
 *  3. Chapters in the video description ("12:34 Boss fight")
 *
 * Pure parsers are exported for tests. Downloads are cached in cache/transcripts/.
 */
import fs from "node:fs/promises";
import { env, fetchJson, log, p } from "./util.mjs";

// ── pure parsers ────────────────────────────────────────────────────────────

/** "01:02:03,450" | "01:02:03.450" | "02:03.450" → seconds */
export function parseCueTime(s) {
  const m = String(s)
    .trim()
    .match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return NaN;
  const [, h = "0", min, sec, ms = "0"] = m;
  return Number(h) * 3600 + Number(min) * 60 + Number(sec) + Number(ms.padEnd(3, "0")) / 1000;
}

const clean = (text) =>
  text
    .replace(/<[^>]+>/g, "") // VTT voice / timing tags
    .replace(/\{\\[^}]*\}/g, "") // SRT styling
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/**
 * Parses SRT or WebVTT captions into cues. Drops YouTube's rolling duplicate
 * lines (auto-captions repeat the previous line in every cue).
 * @returns {{ t: number, text: string }[]}
 */
export function parseCaptions(raw) {
  const cues = [];
  const blocks = String(raw)
    .replace(/\r/g, "")
    .split(/\n{2,}/);
  let last = "";
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const timing = lines.findIndex((l) => l.includes("-->"));
    if (timing === -1) continue;
    const t = parseCueTime(lines[timing].split("-->")[0].trim().split(" ")[0]);
    if (!Number.isFinite(t)) continue;
    for (const line of lines.slice(timing + 1)) {
      const text = clean(line);
      if (!text || text === last) continue;
      last = text;
      cues.push({ t, text });
    }
  }
  return cues;
}

/**
 * Chapters from a video description: lines starting with a timestamp.
 * YouTube only treats them as chapters when the first is 0:00; we accept any.
 * @returns {{ t: number, title: string }[]}
 */
export function parseChapters(description = "") {
  const out = [];
  for (const line of String(description).split(/\r?\n/)) {
    const m = line.match(/^\s*[[(]?((?:\d+:)?\d{1,2}:\d{2})[\])]?\s*[-–—:|]?\s*(.+?)\s*$/);
    if (!m) continue;
    const t = parseCueTime(m[1]);
    if (Number.isFinite(t) && m[2]) out.push({ t, title: m[2] });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Merges cues into ~`seconds`-long lines ("[12:34] text"), which keeps the
 * prompt compact while every line still carries a real timestamp.
 */
export function transcriptLines(cues, seconds = 20) {
  const lines = [];
  let start = null;
  let buf = [];
  for (const c of cues) {
    if (start === null) start = c.t;
    if (c.t - start >= seconds && buf.length) {
      lines.push({ t: start, text: buf.join(" ") });
      start = c.t;
      buf = [];
    }
    buf.push(c.text);
  }
  if (buf.length) lines.push({ t: start, text: buf.join(" ") });
  return lines;
}

export const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

/** ISO 8601 duration ("PT1H2M3S") → seconds */
export function parseIsoDuration(iso) {
  const m = String(iso ?? "").match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

// ── sources ─────────────────────────────────────────────────────────────────

async function readLocal(videoId) {
  for (const ext of ["srt", "vtt"]) {
    try {
      return await fs.readFile(p("content", "transcripts", `${videoId}.${ext}`), "utf8");
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/** Exchanges the owner's refresh token for a short-lived access token (YouTube captions need OAuth). */
async function ownerAccessToken() {
  const id = env("YT_OAUTH_CLIENT_ID");
  const secret = env("YT_OAUTH_CLIENT_SECRET");
  const refresh = env("YT_OAUTH_REFRESH_TOKEN");
  if (!id || !secret || !refresh) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`OAuth token refresh failed (HTTP ${res.status})`);
  return (await res.json()).access_token;
}

/**
 * Downloads the owner's own captions (manual track preferred, else auto-generated).
 * Costs 50 + 200 quota units per video, so results are cached forever.
 */
async function downloadCaptions(videoId, token) {
  const auth = { headers: { authorization: `Bearer ${token}` } };
  const list = await fetchJson(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}`, auth);
  const tracks = list.items ?? [];
  const pick = tracks.find((t) => t.snippet?.trackKind !== "asr") ?? tracks[0];
  if (!pick) return null;
  const res = await fetch(`https://www.googleapis.com/youtube/v3/captions/${pick.id}?tfmt=srt`, auth);
  if (!res.ok) throw new Error(`captions.download HTTP ${res.status}`);
  return res.text();
}

/**
 * @param {{ id: string, description?: string }[]} videos
 * @returns {Promise<Record<string, { cues: { t: number, text: string }[], chapters: { t: number, title: string }[], source: string }>>}
 */
export async function fetchTranscripts(videos) {
  const out = {};
  let token = null;
  try {
    token = await ownerAccessToken();
  } catch (err) {
    log.warn(`Transcripts: ${err.message}. Using local caption files only.`);
  }
  const cacheDir = p("cache", "transcripts");
  await fs.mkdir(cacheDir, { recursive: true });
  let downloaded = 0;
  let quotaHit = false;

  for (const v of videos) {
    const chapters = parseChapters(v.description);
    let raw = await readLocal(v.id);
    let source = raw ? "file" : null;
    if (!raw) {
      try {
        raw = await fs.readFile(`${cacheDir}/${v.id}.srt`, "utf8");
        source = "youtube";
      } catch {
        /* not cached yet */
      }
    }
    if (!raw && token && !quotaHit) {
      try {
        raw = await downloadCaptions(v.id, token);
        if (raw) {
          await fs.writeFile(`${cacheDir}/${v.id}.srt`, raw);
          source = "youtube";
          downloaded++;
        }
      } catch (err) {
        if (/HTTP 403/.test(err.message))
          quotaHit = true; // daily quota: the rest go next run
        else log.warn(`Transcripts: ${v.id}: ${err.message}`);
      }
    }
    const cues = raw ? parseCaptions(raw) : [];
    if (cues.length || chapters.length) out[v.id] = { cues, chapters, source: source ?? "chapters" };
  }
  const withText = Object.values(out).filter((x) => x.cues.length).length;
  log.ok(
    `Transcripts: ${withText} with captions${downloaded ? ` (${downloaded} new)` : ""}, ${Object.keys(out).length - withText} chapters only`,
  );
  if (quotaHit) log.warn("Transcripts: YouTube quota reached; the remaining videos are fetched on the next run.");
  if (!token && !withText)
    log.info("Transcripts: add YT_OAUTH_* (see README) or drop .srt files into content/transcripts/ for full moments.");
  return out;
}
