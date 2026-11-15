import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { storeNameMatches, logoIsDark } from "../../scripts/covers.mjs";
import dataset from "@/data/generated/games.json";

const PUBLIC = path.resolve(import.meta.dirname, "../../public");

describe("Steam store-name matching (cover art)", () => {
  it.each([
    ["Ghost of Tsushima", "Ghost of Tsushima DIRECTOR'S CUT", true],
    ["The Last of Us Part II", "The Last of Us™ Part II Remastered", true],
    ["Middle-earth: Shadow of Mordor", "Middle-earth™: Shadow of Mordor™", true],
    ["Watch Dogs 2", "Watch_Dogs® 2", true],
    ["Ghost Recon Wildlands", "Tom Clancy's Ghost Recon® Wildlands", true],
    ["Ratchet & Clank", "Ratchet & Clank: Rift Apart", false],
    ["Red Dead Redemption 2", "Deadrock Redemption 2", false],
    ["Marvel's Spider-Man", "Marvel's Spider-Man 2", true], // ranked below the exact match by the fetcher
  ])("%s vs %s", (ours, theirs, ok) => {
    expect(storeNameMatches(ours, theirs)).toBe(ok);
  });
});

describe("generated art paths", () => {
  it("every referenced image exists on disk", () => {
    for (const g of dataset.games) {
      for (const key of ["cover", "thumb", "hero", "logo"]) {
        if (g[key]) expect(fs.existsSync(path.join(PUBLIC, g[key])), `${g.slug} ${key}`).toBe(true);
      }
    }
  });
  it("brand assets exist", () => {
    for (const f of ["ps5-mark.png", "ps4-mark.png", "playstation.png", "bluray.png"]) {
      expect(fs.existsSync(path.join(PUBLIC, "brand", f))).toBe(true);
    }
  });
});

describe("dark logo detection", () => {
  /** A transparent PNG: a dark plate (optionally with light lettering) on clear background. */
  async function logo(sharp, { plate, letters }) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
      <rect x="10" y="10" width="180" height="80" fill="${plate}"/>
      ${letters ? `<rect x="30" y="30" width="140" height="40" fill="${letters}"/>` : ""}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
  it("a black logo is shown in white", async () => {
    const sharp = (await import("sharp")).default;
    expect(await logoIsDark(sharp, await logo(sharp, { plate: "#111111" }))).toBe(true);
  });
  it("white lettering on a black plate keeps its colours (Red Dead Redemption 2)", async () => {
    const sharp = (await import("sharp")).default;
    expect(await logoIsDark(sharp, await logo(sharp, { plate: "#000000", letters: "#FFFFFF" }))).toBe(false);
  });
});
