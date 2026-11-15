/** Fuzzy matching of YouTube playlist / video titles to games. Pure + tested. */
import { tokens } from "./math.js";

const STOP = new Set(["the", "a", "of", "and", "marvels", "tom", "clancys", "edition", "remastered", "collection"]);

const sig = (s) => tokens(s).filter((t) => !STOP.has(t));

/** All name variants of a game, longest first (more specific wins). */
export function nameVariants(game) {
  return [game.title, ...(game.aliases ?? [])]
    .map(sig)
    .filter((t) => t.length)
    .sort((a, b) => b.length - a.length);
}

/**
 * Does `text` mention the game? Every token of some variant must appear in the
 * text, in order, as whole tokens. Returns a specificity score (0 = no match).
 */
export function mentionScore(text, game) {
  const hay = sig(text);
  let best = 0;
  for (const v of nameVariants(game)) {
    let j = 0;
    for (let i = 0; i < hay.length && j < v.length; i++) if (hay[i] === v[j]) j++;
    if (j === v.length) best = Math.max(best, v.join("").length);
  }
  return best;
}

/**
 * Picks the single best game for a title, so "Spider-Man 2" doesn't also land
 * on "Spider-Man". Ties are broken by specificity (longest matched name).
 * @returns {string | null} slug
 */
export function bestGameForTitle(title, games) {
  let best = null;
  let bestScore = 0;
  for (const g of games) {
    const s = mentionScore(title, g);
    if (s > bestScore) {
      best = g.slug;
      bestScore = s;
    }
  }
  return best;
}

/** Parses "12:34", "1:02:03" or a number into seconds. */
export function parseTimestamp(t) {
  if (typeof t === "number") return t;
  const parts = String(t).trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
