/**
 * Read-only accessors over the lite dataset (built by `npm run data`).
 * This ships with the app, so it holds only what lists and scenes need; the
 * full record for one game comes from src/lib/gameData.js (game page only).
 */
import dataset from "@/data/generated/games.lite.json";
import { GENRES, MOODS, PLATFORMS } from "@/data/taxonomy.js";

const lite = dataset.games;
const liteBySlug = new Map(lite.map((g) => [g.slug, g]));

export const meta = dataset.meta;
export const getLiteGames = () => lite;
export const getLite = (slug) => liteBySlug.get(slug) ?? null;
export const getJourney = () => dataset.journey.map((s) => liteBySlug.get(s)).filter(Boolean);

export const genreList = () =>
  Object.entries(GENRES)
    .map(([key, d]) => ({ key, label: d.label, count: lite.filter((g) => g.shelves.includes(key)).length }))
    .filter((g) => g.count > 0);

export const moodList = () =>
  Object.entries(MOODS)
    .map(([key, d]) => ({ key, label: d.label, count: lite.filter((g) => g.primaryMood === key).length }))
    .filter((m) => m.count > 0);

export const platformList = () => PLATFORMS.map((key) => ({ key, count: lite.filter((g) => g.platform === key).length }));

export const genreLabel = (k) => GENRES[k]?.label ?? k;
export const moodLabel = (k) => MOODS[k]?.label ?? k;

export function prevNext(slug) {
  const i = lite.findIndex((g) => g.slug === slug);
  return {
    prev: lite[(i - 1 + lite.length) % lite.length],
    next: lite[(i + 1) % lite.length],
  };
}
