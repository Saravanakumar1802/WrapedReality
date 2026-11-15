/**
 * Central theme registry.
 * ---------------------------------------------------------------------------
 * Change ACTIVE_THEME to switch the entire site (CSS + 3D scenes) at once.
 * Font files are self-hosted via @fontsource imports in src/main.jsx.
 *
 * @typedef {{ label: string, name: string, shell: string, shellInner: string, band: string,
 *   bandText: string, spineText: string, led: string, mark: string, markTone: "light" | "dark" }} PlatformTheme
 * @typedef {{
 *   name: string, colorScheme: "dark" | "light",
 *   colors: Record<string, string>,
 *   holo: { stops: string[], gradient: string, linear: string },
 *   platforms: Record<string, PlatformTheme>,
 *   genres: Record<string, string>, moods: Record<string, string>,
 *   fonts: Record<string, string>, radii: Record<string, string>, shadows: Record<string, string>,
 *   motion: Record<string, string | number>, scene: Record<string, any>, cover: Record<string, any>,
 *   space: { stars: string[], dust: string, tint: string, count: number, dustCount: number }
 * }} Theme
 */
import eclipse from "./themes/eclipse.js";
import nebula from "./themes/nebula.js";

export const themes = {
  eclipse,
  nebula,
};

/** 👉 Switch the theme here. */
export const ACTIVE_THEME = "eclipse";

/** @type {Theme} */
export const theme = themes[ACTIVE_THEME];

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * Flattens the theme into CSS custom properties.
 * e.g. colors.textMuted → --color-text-muted, platforms.PS5.shell → --platform-ps5-shell
 * @param {Theme} t
 * @returns {Record<string, string>}
 */
export function themeToCssVars(t = theme) {
  /** @type {Record<string, string>} */
  const vars = {};
  for (const [k, v] of Object.entries(t.colors)) vars[`--color-${kebab(k)}`] = v;
  t.holo.stops.forEach((c, i) => (vars[`--holo-${i + 1}`] = c));
  vars["--holo-gradient"] = t.holo.gradient;
  vars["--holo-linear"] = t.holo.linear;
  for (const [p, def] of Object.entries(t.platforms)) {
    for (const [k, v] of Object.entries(def)) {
      if (k === "label" || k === "name" || k === "mark" || k === "markTone") continue;
      vars[`--platform-${p.toLowerCase()}-${kebab(k)}`] = v;
    }
  }
  for (const [k, v] of Object.entries(t.genres)) vars[`--genre-${k}`] = v;
  for (const [k, v] of Object.entries(t.moods)) vars[`--mood-${k}`] = v;
  for (const [k, v] of Object.entries(t.fonts)) vars[`--font-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(t.radii)) vars[`--radius-${k}`] = v;
  for (const [k, v] of Object.entries(t.shadows)) vars[`--shadow-${k}`] = v;
  vars["--ease-out"] = String(t.motion.cssEaseOut);
  vars["--ease-in-out"] = String(t.motion.cssEaseInOut);
  vars["--dur-fast"] = `${t.motion.fast}s`;
  vars["--dur-base"] = `${t.motion.base}s`;
  vars["--dur-slow"] = `${t.motion.slow}s`;
  return vars;
}

/** Serialises the vars into a `:root{}` rule for the root layout. */
export function themeCss(t = theme) {
  const body = Object.entries(themeToCssVars(t))
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `:root{${body}color-scheme:${t.colorScheme};}`;
}

/** Colour for a genre or mood key, with a safe fallback. */
export const genreColor = (key) => theme.genres[key] ?? theme.colors.accent;
export const moodColor = (key) => theme.moods[key] ?? theme.colors.accent;
export const platformTheme = (p) => theme.platforms[p] ?? theme.platforms.PS5;
