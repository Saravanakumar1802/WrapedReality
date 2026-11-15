/**
 * Where each visitor got to in each video, kept in their own browser only
 * (localStorage, never sent anywhere). Powers "Resume at 23:10" on a game page
 * and "Continue watching" on the home page: playthroughs are long and split
 * into parts, so picking up where you left off matters.
 */
import { safeStorage } from "./env.js";

const KEY = "watch:v1";
const MAX_ENTRIES = 60;
/** Closer than this to the end counts as finished. */
const FINISHED_MARGIN = 45;
/** Less than this in is not worth resuming. */
const MIN_RESUME = 30;

/**
 * @typedef {{ t: number, duration: number | null, slug: string, title: string, at: number }} WatchEntry
 * @typedef {{ get: (k: string, fallback: any) => any, set: (k: string, v: any) => void }} Store
 */

/** @param {Store} store */
const read = (store) => store.get(KEY, {}) ?? {};

/**
 * Records the position in a video (called every few seconds while it plays).
 * @param {string} videoId
 * @param {{ t: number, duration?: number | null, slug: string, title: string }} info
 * @param {Store} [store]
 */
export function saveProgress(videoId, { t, duration = null, slug, title }, store = safeStorage, now = Date.now()) {
  if (!videoId || !Number.isFinite(t)) return;
  const all = read(store);
  all[videoId] = { t: Math.floor(t), duration: duration ? Math.floor(duration) : null, slug, title, at: now };
  const kept = Object.entries(all)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_ENTRIES);
  store.set(KEY, Object.fromEntries(kept));
}

/** @returns {WatchEntry | null} */
export function getProgress(videoId, store = safeStorage) {
  return read(store)[videoId] ?? null;
}

export const isFinished = (e) => Boolean(e?.duration && e.t >= e.duration - FINISHED_MARGIN);

/** Seconds to resume from, or 0 when there is nothing worth resuming. */
export function resumeAt(videoId, store = safeStorage) {
  const e = getProgress(videoId, store);
  if (!e || isFinished(e) || e.t < MIN_RESUME) return 0;
  return e.t;
}

/**
 * Videos started but not finished, most recent first.
 * @returns {(WatchEntry & { videoId: string })[]}
 */
export function continueWatching(limit = 6, store = safeStorage) {
  return Object.entries(read(store))
    .map(([videoId, e]) => ({ videoId, ...e }))
    .filter((e) => e.t >= MIN_RESUME && !isFinished(e))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}
