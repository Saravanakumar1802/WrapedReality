/**
 * Pure layout maths for the 3D scenes (unit = 10 cm).
 * PS4/PS5 games ship in Blu-ray keep cases: 135 × 171.5 × 12 mm.
 */
import { mulberry32, hashString } from "./math.js";
import { GENRE_KEYS } from "../data/taxonomy.js";

export const CASE = Object.freeze({ width: 1.35, height: 1.715, depth: 0.12 });
export const SHELF = Object.freeze({
  gap: 0.012, // air between neighbouring cases (they sit almost touching, like a real shelf)
  rowGap: 0.4, // clearance above a row of cases, including the board
  boardThickness: 0.09,
  sideMargin: 0.45, // cabinet sides + breathing room at the ends of a row
  depth: CASE.width + 0.42, // front-to-back depth of a board
});

/**
 * Lays cases spine-out on rows. Rows are grouped by platform; a platform with
 * more games than `perRow` wraps onto further rows.
 * @param {{ slug: string, platform: string }[]} games already in display order
 * @param {{ perRow: number, platforms: string[] }} opts
 * @returns {{ slots: { slug: string, platform: string, row: number, col: number, position: [number, number, number] }[],
 *   rows: { platform: string, y: number, width: number, count: number }[], width: number, height: number }}
 */
export function computeShelfLayout(games, { perRow, platforms }) {
  const pitch = CASE.depth + SHELF.gap;
  const rowHeight = CASE.height + SHELF.rowGap;
  const groups = platforms.map((p) => ({ platform: p, items: games.filter((g) => g.platform === p) })).filter((g) => g.items.length);

  /** @type {{ platform: string, items: typeof games }[]} */
  const rowDefs = [];
  for (const g of groups) {
    for (let i = 0; i < g.items.length; i += perRow) {
      rowDefs.push({ platform: g.platform, items: g.items.slice(i, i + perRow) });
    }
  }

  const height = rowDefs.length * rowHeight;
  const top = height / 2 - rowHeight / 2;
  const slots = [];
  const rows = [];
  let maxWidth = 0;

  rowDefs.forEach((rowDef, row) => {
    const count = rowDef.items.length;
    const width = count * pitch;
    maxWidth = Math.max(maxWidth, width);
    const y = top - row * rowHeight;
    rows.push({ platform: rowDef.platform, y, width, count });
    rowDef.items.forEach((g, col) => {
      const x = -width / 2 + pitch / 2 + col * pitch;
      slots.push({ slug: g.slug, platform: g.platform, row, col, position: [x, y, 0] });
    });
  });

  return { slots, rows, width: maxWidth, height };
}

/**
 * How the shelf camera frames the cabinet: one row fills most of the view so the
 * spines are large and readable; the page scroll travels from row to row.
 * @param {number} aspect viewport width / height
 * @returns {{ viewHeight: number, viewWidth: number, rowFraction: number }} in scene units
 */
export function shelfView(aspect) {
  // Phones are tall and narrow: show a little more than one row so spines keep a usable width.
  const rowFraction = aspect < 0.8 ? 0.5 : aspect < 1.2 ? 0.62 : 0.78;
  const viewHeight = (CASE.height + SHELF.rowGap) / rowFraction;
  return { viewHeight, viewWidth: viewHeight * aspect, rowFraction };
}

/** Cases per row: as many as fit across the camera's view (see shelfView), capped at 30. */
export function perRowForAspect(aspect, total) {
  const pitch = CASE.depth + SHELF.gap;
  const fit = Math.floor((shelfView(aspect).viewWidth - SHELF.sideMargin) / pitch);
  return Math.max(1, Math.min(total, 30, Math.max(6, fit)));
}

/**
 * Fallback 3D positions when embeddings/UMAP are unavailable: genres sit on a
 * Fibonacci sphere, games cluster around their primary genre with seeded jitter.
 */
export function clusterPositions(games, radius = 8) {
  const centres = genreCentres(radius);
  return games.map((g) => {
    const c = centres[g.primaryGenre] ?? [0, 0, 0];
    const rnd = mulberry32(hashString(g.slug));
    return c.map((x) => Math.round((x + (rnd() - 0.5) * 3.2) * 1000) / 1000);
  });
}

export function genreCentres(radius = 8) {
  const n = GENRE_KEYS.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Object.fromEntries(
    GENRE_KEYS.map((k, i) => {
      const y = 1 - (i / Math.max(1, n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      return [k, [Math.cos(th) * r * radius, y * radius * 0.6, Math.sin(th) * r * radius]];
    }),
  );
}

/** Average position per group key → label anchors. */
export function groupCentroids(items, keyOf, posOf) {
  /** @type {Record<string, { sum: number[], n: number }>} */
  const acc = {};
  for (const it of items) {
    const k = keyOf(it);
    const p = posOf(it);
    acc[k] ??= { sum: [0, 0, 0], n: 0 };
    acc[k].sum = acc[k].sum.map((s, i) => s + p[i]);
    acc[k].n++;
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.sum.map((s) => s / v.n)]));
}

/**
 * Gap-free picking: which slot is at a point on the spine plane?
 * Every case owns the full pitch around it (its width plus half the air on each
 * side), so a tap between two spines still lands on the nearer one. This is
 * O(1) per pointer event, unlike raycasting every case's geometry.
 *
 * @param {ReturnType<typeof computeShelfLayout>} layout
 * @returns {(x: number, y: number) => number} slot index, or -1 when off the cases
 */
export function createSlotPicker(layout) {
  const pitch = CASE.depth + SHELF.gap;
  const reach = CASE.height / 2 + SHELF.rowGap * 0.25; // a little above and below the cases
  const rowStart = [];
  layout.slots.forEach((s, i) => (rowStart[s.row] ??= i));
  return (x, y) => {
    let row = -1;
    let best = Infinity;
    layout.rows.forEach((r, i) => {
      const d = Math.abs(y - r.y);
      if (d <= reach && d < best) ((best = d), (row = i));
    });
    if (row === -1) return -1;
    const r = layout.rows[row];
    const col = Math.round((x - (-r.width / 2 + pitch / 2)) / pitch);
    if (col < 0 || col >= r.count) return -1;
    return rowStart[row] + col;
  };
}

/**
 * Where to present a case pulled off the shelf so it sits centred in the part of
 * the screen the details panel leaves free, as large as fits.
 *
 * @param {{ distance: number, fov: number, aspect: number,
 *   insets?: { right?: number, bottom?: number }, width: number, height: number, fill?: number }} o
 *   insets are fractions (0..1) of the stage covered by the panel; width/height
 *   are the case's size in scene units for the current stage (an open case is
 *   twice as wide).
 * @returns {{ x: number, y: number, scale: number }} offset from the view centre (scene units) + scale (≤ 1)
 */
export function presentCase({ distance, fov, aspect, insets = {}, width, height, fill = 0.86 }) {
  const viewH = 2 * distance * Math.tan(((fov / 2) * Math.PI) / 180);
  const viewW = viewH * aspect;
  const right = Math.min(0.7, Math.max(0, insets.right ?? 0));
  const bottom = Math.min(0.7, Math.max(0, insets.bottom ?? 0));
  const freeW = viewW * (1 - right);
  const freeH = viewH * (1 - bottom);
  const scale = Math.min(1, (freeW * fill) / width, (freeH * fill) / height);
  return { x: right ? -(right / 2) * viewW : 0, y: (bottom / 2) * viewH, scale };
}
