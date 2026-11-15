/**
 * Hybrid "closest match" scoring: embedding similarity blended with curated tags,
 * so the AI explains itself but never drifts away from the facts.
 */
import { dot, softmax } from "./math.js";
import { GENRE_KEYS, GENRE_TO_MOOD, MOOD_KEYS } from "../data/taxonomy.js";

export const EMBED_WEIGHT = 0.65;
export const TAG_WEIGHT = 0.35;
export const EXTRA_SHELF_MARGIN = 0.05;
export const SOFTMAX_TEMPERATURE = 0.05;

/** Tag-hit strength: the first tag is the strongest signal, later tags slightly weaker. */
export function tagStrength(tags, key) {
  const i = tags.indexOf(key);
  if (i === -1) return 0;
  return 1 - i * 0.12;
}

const round = (x) => Math.round(x * 1e4) / 1e4;

/**
 * @param {{ tags: string[] }} game
 * @param {number[] | null} vector unit embedding of the game (null = no embeddings)
 * @param {Record<string, number[]> | null} protos genre prototypes
 */
export function scoreGenres(game, vector, protos) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const key of GENRE_KEYS) {
    const tag = tagStrength(game.tags, key);
    out[key] = vector && protos?.[key] ? round(EMBED_WEIGHT * dot(vector, protos[key]) + TAG_WEIGHT * tag) : round(tag * 0.9); // fallback: tags only
  }
  return out;
}

/**
 * @param {{ tags: string[] }} game
 * @param {number[] | null} vector
 * @param {Record<string, number[]> | null} protos mood prototypes
 */
export function scoreMoods(game, vector, protos) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const key of MOOD_KEYS) {
    if (vector && protos?.[key]) {
      out[key] = round(dot(vector, protos[key]));
    } else {
      // fallback: moods implied by genre tags
      out[key] = round(game.tags.reduce((s, t, i) => s + (GENRE_TO_MOOD[t] === key ? 1 - i * 0.2 : 0), 0) / 2);
    }
  }
  return out;
}

const argmax = (scores, keys = Object.keys(scores)) => keys.reduce((best, k) => (scores[k] > scores[best] ? k : best), keys[0]);

/**
 * Primary genre is restricted to the game's curated tags when it has any
 * (keeps FIFA off the RPG shelf); extra shelves are within EXTRA_SHELF_MARGIN.
 */
export function pickGenres(game, scores) {
  const tagged = game.tags.filter((t) => GENRE_KEYS.includes(t));
  const primary = argmax(scores, tagged.length ? tagged : GENRE_KEYS);
  const extras = tagged.filter((k) => k !== primary && scores[primary] - scores[k] <= EXTRA_SHELF_MARGIN);
  return { primary, shelves: [primary, ...extras] };
}

/** A manual mood (from content/<slug>.md) always wins over the AI. */
export function pickMood(manual, scores) {
  if (manual && MOOD_KEYS.includes(manual)) return manual;
  return argmax(scores);
}

/** Relative match for the Genre DNA strip (sums to 1 — not a probability). */
export const relativeMatch = (scores) => softmax(scores, SOFTMAX_TEMPERATURE);

/** 0–5 filled dots for the DNA strip, relative to the strongest genre. */
export function dnaDots(match) {
  const max = Math.max(...Object.values(match), 1e-9);
  return Object.fromEntries(Object.entries(match).map(([k, v]) => [k, Math.max(0, Math.min(5, Math.round((v / max) * 5)))]));
}

/** Prior pull toward the mood implied by a game's genre tags (0–1). */
export function moodPrior(tags, mood) {
  return tags.reduce((s, t, i) => s + (GENRE_TO_MOOD[t] === mood ? 1 - i * 0.25 : 0), 0) / 1.5;
}

export const MOOD_PRIOR_WEIGHT = 0.035;

/**
 * Embedding similarity has a per-prototype bias (some moods score high for
 * everything). Subtracting each mood's mean across all games makes moods
 * relative to the library, then a small genre prior breaks near-ties.
 * @param {Record<string, number>[]} rows mood scores per game
 * @param {string[][]} tagsPerGame
 */
export function centerMoodScores(rows, tagsPerGame) {
  if (!rows.length) return rows;
  const keys = Object.keys(rows[0]);
  const mean = Object.fromEntries(keys.map((k) => [k, rows.reduce((s, r) => s + r[k], 0) / rows.length]));
  return rows.map((r, i) =>
    Object.fromEntries(keys.map((k) => [k, round(r[k] - mean[k] + MOOD_PRIOR_WEIGHT * moodPrior(tagsPerGame[i], k))])),
  );
}
