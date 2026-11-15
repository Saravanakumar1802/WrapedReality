import { describe, expect, it } from "vitest";
import { centerMoodScores, dnaDots, pickGenres, pickMood, relativeMatch, scoreGenres, scoreMoods } from "@/lib/scoring.js";
import { GENRE_KEYS, MOOD_KEYS } from "@/data/taxonomy.js";

describe("scoring", () => {
  const game = { tags: ["sports", "racing"] };

  it("tag-only fallback scores every genre and prefers the first tag", () => {
    const s = scoreGenres(game, null, null);
    expect(Object.keys(s).sort()).toEqual([...GENRE_KEYS].sort());
    expect(pickGenres(game, s).primary).toBe("sports");
  });

  it("primary genre is restricted to curated tags even if another genre scores higher", () => {
    const scores = Object.fromEntries(GENRE_KEYS.map((k) => [k, 0]));
    scores.rpg = 0.9;
    scores.sports = 0.5;
    scores.racing = 0.48;
    const r = pickGenres(game, scores);
    expect(r.primary).toBe("sports");
    expect(r.shelves).toEqual(["sports", "racing"]);
  });

  it("manual mood wins; an invalid manual mood is ignored", () => {
    const m = scoreMoods(game, null, null);
    expect(pickMood("grief", m)).toBe("grief");
    expect(MOOD_KEYS).toContain(pickMood("nonsense", m));
  });

  it("relative match sums to 1; DNA dots are 0-5 and the top one is 5", () => {
    const rm = relativeMatch({ a: 0.6, b: 0.5, c: 0.2 });
    expect(Object.values(rm).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 10);
    const d = dnaDots(rm);
    expect(d.a).toBe(5);
    expect(Object.values(d).every((x) => x >= 0 && x <= 5)).toBe(true);
  });

  it("mood centring removes each mood's library-wide bias", () => {
    const rows = [
      { peace: 0.5, fear: 0.2 },
      { peace: 0.7, fear: 0.4 },
    ];
    const out = centerMoodScores(rows, [[], []]);
    expect(out[0].peace + out[1].peace).toBeCloseTo(0, 6);
    expect(out[1].fear).toBeGreaterThan(out[0].fear);
  });
});
