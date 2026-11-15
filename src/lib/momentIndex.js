/**
 * The moment index: every findable moment in the channel's videos, from the
 * creator's own notes (content/<slug>.md) and the AI index (scripts/moments.mjs).
 *
 * Plain module (no "@/" imports) so the Node build script can use it too.
 */
import { tokens } from "./math.js";

/**
 * Combines the creator's moments with the AI's for one game.
 * Creator moments win: an AI moment within 30 s of one of theirs on the same
 * video is dropped. A creator moment without a video belongs to the first video.
 *
 * @param {{ t: number, label: string, videoId?: string }[]} creator
 * @param {{ id: string }[]} videos in play order
 * @param {Record<string, { moments: { t: number, title: string, detail: string, kind: string, spoiler: boolean, tags: string[] }[] }>} ai by video id
 */
export function mergeMoments(creator, videos, ai) {
  const first = videos[0]?.id;
  const mine = creator.map((m) => ({
    t: m.t,
    label: m.label,
    videoId: m.videoId ?? first,
    source: "creator",
  }));
  const theirs = videos.flatMap((v) =>
    (ai[v.id]?.moments ?? [])
      .filter((m) => !mine.some((c) => c.videoId === v.id && Math.abs(c.t - m.t) < 30))
      .map((m) => ({
        t: m.t,
        label: m.title,
        detail: m.detail,
        kind: m.kind,
        spoiler: m.spoiler,
        tags: m.tags,
        videoId: v.id,
        source: "ai",
      })),
  );
  const order = new Map(videos.map((v, i) => [v.id, i]));
  return [...mine, ...theirs].sort((a, b) => (order.get(a.videoId) ?? 99) - (order.get(b.videoId) ?? 99) || a.t - b.t);
}

/** The text a moment is embedded and keyword-searched by. */
export const momentText = (m, gameTitle) => [m.label, m.detail, (m.tags ?? []).join(", "), gameTitle].filter(Boolean).join(". ");

/**
 * Unit vectors → int8 (×127): a quarter of the size of float32, with no
 * meaningful loss for cosine ranking.
 * @param {number[][]} vectors
 */
export function quantize(vectors) {
  const dim = vectors[0]?.length ?? 0;
  const out = new Int8Array(vectors.length * dim);
  vectors.forEach((v, i) => v.forEach((x, j) => (out[i * dim + j] = Math.max(-127, Math.min(127, Math.round(x * 127))))));
  return out;
}

/**
 * Instant keyword ranking (used while the AI model loads, or if it can't).
 * @param {string} query
 * @param {{ text: string }[]} items
 * @returns {{ index: number, score: number }[]}
 */
export function keywordMomentSearch(query, items, k = 12) {
  const q = tokens(query).filter((t) => t.length > 2);
  if (!q.length) return [];
  return items
    .map((it, index) => {
      const words = new Set(tokens(it.text));
      let score = 0;
      for (const t of q) if (words.has(t)) score += 1;
      // prefix matches ("sigr" → "sigrun") count a little
      for (const t of q) if (!words.has(t) && [...words].some((w) => w.startsWith(t))) score += 0.5;
      return { index, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
