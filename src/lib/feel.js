/**
 * Keyword fallback for Feel-search (used when the in-browser model can't load).
 * Maps feeling words to moods/genres, then scores games by overlap.
 */
import { tokens } from "./math.js";

const LEXICON = {
  peace: ["calm", "peaceful", "relax", "relaxing", "slow", "quiet", "chill", "cozy", "gentle", "beautiful", "lonely", "nature", "ride"],
  fear: ["scary", "fear", "afraid", "horror", "terrifying", "creepy", "dark", "monsters", "zombies", "tense", "dread"],
  adrenaline: ["fast", "chaos", "intense", "adrenaline", "action", "speed", "competitive", "friends", "explosive", "hype", "battle"],
  grief: ["sad", "cry", "grief", "loss", "emotional", "heartbreaking", "broke", "revenge", "tragic", "father", "family"],
  wonder: ["wonder", "magic", "myth", "awe", "epic", "fantasy", "explore", "discovery", "huge", "world", "gods"],
};

const GENRE_WORDS = {
  racing: ["car", "cars", "race", "racing", "drive", "driving"],
  sports: ["football", "soccer", "cricket", "sport", "sports"],
  fighting: ["fight", "fighting", "punch", "wrestling", "combo"],
  shooter: ["shoot", "shooter", "guns", "battle", "royale", "squad"],
  horror: ["horror", "zombies", "survival"],
  rpg: ["rpg", "quests", "story", "choices", "fantasy"],
  "open-world": ["open", "world", "roam", "explore", "city"],
};

/**
 * @param {string} query
 * @param {{ slug: string, title: string, summary: string, primaryMood: string, primaryGenre: string, shelves?: string[] }[]} games
 * @returns {{ slug: string, score: number }[]}
 */
export function keywordFeelSearch(query, games, k = 6) {
  const q = new Set(tokens(query));
  if (!q.size) return [];
  const moodHits = Object.fromEntries(Object.entries(LEXICON).map(([m, words]) => [m, words.filter((w) => q.has(w)).length]));
  const genreHits = Object.fromEntries(Object.entries(GENRE_WORDS).map(([g, words]) => [g, words.filter((w) => q.has(w)).length]));
  return games
    .map((g) => {
      const text = new Set(tokens(`${g.title} ${g.summary}`));
      let score = 0;
      for (const t of q) if (t.length > 2 && text.has(t)) score += 1;
      score += (moodHits[g.primaryMood] ?? 0) * 2;
      for (const s of g.shelves ?? [g.primaryGenre]) score += (genreHits[s] ?? 0) * 1.5;
      return { slug: g.slug, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
