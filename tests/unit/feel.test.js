import { describe, expect, it } from "vitest";
import { keywordFeelSearch } from "@/lib/feel.js";
import dataset from "@/data/generated/games.json";

const find = (slug) => dataset.games.find((g) => g.slug === slug);

describe("feel-search keyword fallback", () => {
  it("finds scary games for a scary feeling", () => {
    const hits = keywordFeelSearch("monsters in the dark", dataset.games);
    expect(hits.length).toBeGreaterThan(0);
    expect(find(hits[0].slug).primaryMood).toBe("fear");
  });
  it("finds racing for cars", () => {
    const hits = keywordFeelSearch("fast cars", dataset.games);
    expect(find(hits[0].slug).shelves).toContain("racing");
  });
  it("empty query gives no results", () => {
    expect(keywordFeelSearch("   ", dataset.games)).toEqual([]);
  });
});
