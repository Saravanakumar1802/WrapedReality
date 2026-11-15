import { describe, expect, it } from "vitest";
import { GAMES } from "@/data/games.js";
import { GENRE_KEYS, MOOD_KEYS } from "@/data/taxonomy.js";
import { slugify } from "@/lib/math.js";
import { GameSeedSchema } from "../../scripts/schema.mjs";
import dataset from "@/data/generated/games.json";
import lite from "@/data/generated/games.lite.json";
import { toLiteDataset } from "@/lib/lite.js";

describe("curated games", () => {
  it("every entry is valid", () => {
    for (const g of GAMES) {
      const r = GameSeedSchema.safeParse(g);
      expect(r.success, `${g.title}: ${r.error?.message}`).toBe(true);
    }
  });
  it("slugs are unique", () => {
    const slugs = GAMES.map((g) => g.id ?? slugify(g.title));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("has the 83 games split across PS5, PS4 and PC", () => {
    expect(GAMES).toHaveLength(83);
    expect(GAMES.filter((g) => g.platform === "PS5")).toHaveLength(24);
    expect(GAMES.filter((g) => g.platform === "PS4")).toHaveLength(30);
    expect(GAMES.filter((g) => g.platform === "PC")).toHaveLength(29);
  });
});

describe("generated dataset (run `npm run data` after editing games.js)", () => {
  it("the lite file that ships with the app matches the full dataset", () => {
    expect(lite).toEqual(toLiteDataset(dataset));
  });

  const slugs = new Set(dataset.games.map((g) => g.slug));

  it("is in sync with games.js", () => {
    expect(dataset.games.map((g) => g.title)).toEqual(GAMES.map((g) => g.title));
  });

  it("every game has valid sorting and layout", () => {
    for (const g of dataset.games) {
      expect(GENRE_KEYS).toContain(g.primaryGenre);
      expect(MOOD_KEYS).toContain(g.primaryMood);
      expect(g.tags).toContain(g.primaryGenre);
      expect(g.pos3d).toHaveLength(3);
      expect(g.pos3d.every(Number.isFinite)).toBe(true);
      expect(g.neighbors).toHaveLength(3);
      for (const n of g.neighbors) {
        expect(slugs.has(n)).toBe(true);
        expect(n).not.toBe(g.slug);
      }
    }
  });

  it("journey lists every game once", () => {
    expect([...dataset.journey].sort()).toEqual([...slugs].sort());
  });

  it("genre sanity checks", () => {
    const by = Object.fromEntries(dataset.games.map((g) => [g.slug, g.primaryGenre]));
    expect(by["fifa-18"]).toBe("sports");
    expect(by["cricket-19"]).toBe("sports");
    expect(by["need-for-speed-heat"]).toBe("racing");
    expect(by["tekken-7"]).toBe("fighting");
    expect(by["resident-evil-2"]).toBe("horror");
  });
});
