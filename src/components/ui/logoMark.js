/**
 * The WrapedReality mark, as SVG markup: a game disc with a "W" printed across
 * its label. The film (iridescent thin-film rainbow), grooves and the bow-tie
 * glint a disc throws under a lamp spin; the W, the clear stacking ring and the
 * spindle hole (sitting in the W's centre joint) hold still so the letter stays
 * readable.
 *
 * One source for both places the mark appears: the header logo (Logo.jsx) and
 * the boot loader, which vite.config.js injects into index.html before any
 * JavaScript runs. Colours are theme CSS variables. Pure string, no DOM.
 */

export const MARK_VIEWBOX = "0 0 48 48";

/** The W: geometric strokes, the middle peak ending at the disc's centre. */
export const W_PATH = "M9.5 14H14.6L18.3 27.2 21.6 17.6H26.4L29.7 27.2 33.4 14H38.5L32.2 34H27.4L24 24.2 20.6 34H15.8Z";

const GROOVES = [8, 10, 12, 14, 16, 18, 20];
const stop = (offset, v) => `<stop offset="${offset}" style="stop-color: var(${v})"/>`;

/**
 * @param {string} id unique prefix for gradient ids (several marks can share a page)
 * @returns {string} the inner markup of an <svg viewBox={MARK_VIEWBOX}>
 */
export function logoMarkMarkup(id) {
  const u = (name) => `${id}-${name}`;
  return [
    "<defs>",
    `<linearGradient id="${u("film")}" x1="0.1" y1="0" x2="0.9" y2="1">`,
    stop(0, "--holo-4"),
    stop(0.3, "--holo-3"),
    stop(0.55, "--holo-2"),
    stop(0.8, "--holo-1"),
    stop(1, "--holo-4"),
    "</linearGradient>",
    `<radialGradient id="${u("shade")}" cx="0.5" cy="0.5" r="0.5">`,
    '<stop offset="0.5" style="stop-color: var(--color-void); stop-opacity: 0"/>',
    '<stop offset="1" style="stop-color: var(--color-void); stop-opacity: 0.6"/>',
    "</radialGradient>",
    `<linearGradient id="${u("ink")}" x1="0" y1="0" x2="0" y2="1">`,
    stop(0, "--color-text"),
    stop(1, "--color-text-muted"),
    "</linearGradient>",
    "</defs>",
    '<g class="lm-disc">',
    '<g class="lm-spin">',
    `<circle cx="24" cy="24" r="21" fill="url(#${u("film")})"/>`,
    `<circle cx="24" cy="24" r="21" fill="url(#${u("shade")})"/>`,
    ...GROOVES.map((r) => `<circle class="lm-groove" cx="24" cy="24" r="${r}"/>`),
    '<path class="lm-glint" d="M24 24L35.5 6.4A21 21 0 0 1 41.8 12.8Z"/>',
    '<path class="lm-glint" d="M24 24L12.5 41.6A21 21 0 0 1 6.2 35.2Z"/>',
    "</g>",
    `<path class="lm-w" d="${W_PATH}" fill="url(#${u("ink")})"/>`,
    `<path class="lm-w-edge" d="${W_PATH}"/>`,
    '<circle class="lm-stack" cx="24" cy="24" r="5.4"/>',
    '<circle class="lm-hole" cx="24" cy="24" r="2.1"/>',
    '<circle class="lm-rim" cx="24" cy="24" r="20.7"/>',
    "</g>",
  ].join("");
}

/**
 * Shared styling for the mark's parts (scoped under `scope`). Used by the boot
 * loader's inline <style>; the header logo has the same rules in Logo.module.css.
 */
export function logoMarkCss(scope) {
  return `
${scope} .lm-spin { transform-origin: 24px 24px; animation: lm-spin 16s linear infinite; }
@keyframes lm-spin { to { transform: rotate(360deg); } }
${scope} .lm-groove { fill: none; stroke: var(--color-void); stroke-opacity: 0.16; stroke-width: 0.35; }
${scope} .lm-glint { fill: var(--color-text); opacity: 0.55; mix-blend-mode: screen; }
${scope} .lm-w-edge { fill: none; stroke: var(--color-void); stroke-opacity: 0.45; stroke-width: 0.7; stroke-linejoin: round; }
${scope} .lm-stack { fill: none; stroke: var(--color-text); stroke-opacity: 0.55; stroke-width: 0.5; }
${scope} .lm-hole { fill: var(--color-void); }
${scope} .lm-rim { fill: none; stroke: var(--color-text); stroke-opacity: 0.35; stroke-width: 0.6; }
@media (prefers-reduced-motion: reduce) { ${scope} .lm-spin { animation: none; } }
`;
}
