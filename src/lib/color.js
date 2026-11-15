/** Tiny colour helpers shared by canvas art and WebGL code. */

/** "#RRGGBB" → [r, g, b] in 0..255 */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "#RRGGBB" → [r, g, b] in 0..1 (for shader uniforms) */
export const hexToVec3 = (hex) => hexToRgb(hex).map((v) => v / 255);

/** "#RRGGBB" + alpha → "rgba(r,g,b,a)" */
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
