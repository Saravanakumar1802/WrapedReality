import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { themes, theme, themeToCssVars, themeCss } from "@/theme";
import { GENRE_KEYS, MOOD_KEYS, PLATFORMS } from "@/data/taxonomy.js";

const SRC = path.resolve(import.meta.dirname, "../../src");
// Only the theme itself and game identity data may contain literal colours.
const ALLOWED = [path.join(SRC, "theme"), path.join(SRC, "data")];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe("central theme", () => {
  it.each(Object.entries(themes))("%s defines every genre, mood and platform", (_, t) => {
    for (const k of GENRE_KEYS) expect(t.genres[k], `genre ${k}`).toMatch(/^#/);
    for (const k of MOOD_KEYS) expect(t.moods[k], `mood ${k}`).toMatch(/^#/);
    for (const p of PLATFORMS) expect(t.platforms[p], `platform ${p}`).toBeTruthy();
  });

  it("all themes share the same token keys, so switching can't break anything", () => {
    const shape = (t) => JSON.stringify(Object.keys(themeToCssVars(t)).sort());
    const base = shape(theme);
    for (const t of Object.values(themes)) expect(shape(t)).toBe(base);
  });

  it("produces CSS variables", () => {
    const css = themeCss();
    expect(css).toContain("--color-ink:");
    expect(css).toContain("--platform-ps5-shell:");
    expect(css).toContain("--genre-action:");
    expect(css).toContain("--mood-peace:");
  });

  it("no hardcoded hex colours outside src/theme and src/data", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      if (!/\.(jsx?|css)$/.test(file)) continue;
      if (ALLOWED.some((a) => file.startsWith(a))) continue;
      const m = fs.readFileSync(file, "utf8").match(/#[0-9a-fA-F]{3,8}\b/g);
      if (m) offenders.push(`${path.relative(SRC, file)}: ${m.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });
});
