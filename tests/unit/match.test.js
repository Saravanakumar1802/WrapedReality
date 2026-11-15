import { describe, expect, it } from "vitest";
import { bestGameForTitle, parseTimestamp } from "@/lib/match.js";
import { GAMES } from "@/data/games.js";
import { slugify } from "@/lib/math.js";

const games = GAMES.map((g) => ({ ...g, slug: slugify(g.title) }));

describe("YouTube title matching", () => {
  it.each([
    ["Spider-Man 2 PS5 Full Game Part 1", "marvels-spider-man-2"],
    ["Marvel's Spider-Man Remastered Walkthrough #3", "marvels-spider-man"],
    ["RDR2 Arthur's last ride", "red-dead-redemption-2"],
    ["GTA 5 Online heist with friends", "grand-theft-auto-v"],
    ["God of War Ragnarok ending", "god-of-war-ragnarok"],
    ["Ghost of Tsushima Iki Island", "ghost-of-tsushima"],
    ["Resident Evil 3 Nemesis boss", "resident-evil-3"],
    ["Black Ops 3 zombies", "call-of-duty-black-ops-iii"],
  ])("%s", (title, slug) => {
    expect(bestGameForTitle(title, games)).toBe(slug);
  });

  it("returns null for unrelated titles", () => {
    expect(bestGameForTitle("My new gaming setup tour", games)).toBeNull();
  });

  it("parses timestamps", () => {
    expect(parseTimestamp("12:34")).toBe(754);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp(90)).toBe(90);
    expect(Number.isNaN(parseTimestamp("ab:cd"))).toBe(true);
  });
});
