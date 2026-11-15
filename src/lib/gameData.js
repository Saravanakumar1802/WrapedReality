/**
 * Full game records (videos, moments, takeaways, scores, neighbours), one small
 * JSON file per game in public/data/games/, written by `npm run data`.
 *
 * The game page fetches only the record it shows (≈4 KB) instead of bundling
 * every game's full record (≈115 KB, and growing with each game added).
 */
import { getLite } from "./data.js";

const cache = new Map();

/**
 * @param {string | undefined} slug
 * @returns {Promise<any | null>} null for an unknown game (the page shows "not found")
 */
export function loadGame(slug) {
  if (!slug || !getLite(slug)) return Promise.resolve(null);
  if (!cache.has(slug)) {
    cache.set(
      slug,
      fetch(`/data/games/${encodeURIComponent(slug)}.json`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => {
          cache.delete(slug); // offline blip: let the next visit retry
          return null;
        }),
    );
  }
  return cache.get(slug);
}

/** Warm the record before the visitor clicks (hover / focus on a link to the game). */
export const prefetchGame = (slug) => void loadGame(slug);
