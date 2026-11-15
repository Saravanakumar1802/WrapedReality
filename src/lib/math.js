/** Small, dependency-free numeric helpers shared by the build pipeline and the browser. */

/** Dot product. For unit vectors this equals cosine similarity. */
export function dot(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function norm(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/** Returns a unit-length copy (zero vectors are returned unchanged). */
export function normalize(v) {
  const n = norm(v);
  if (n === 0) return Array.from(v);
  return Array.from(v, (x) => x / n);
}

/** Normalised mean of several vectors. */
export function centroid(vectors) {
  if (!vectors.length) return [];
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i] += v[i];
  return normalize(out.map((x) => x / vectors.length));
}

/**
 * Temperature softmax over an object of scores → relative match (sums to 1).
 * @param {Record<string, number>} scores
 * @param {number} temperature lower = sharper
 */
export function softmax(scores, temperature = 0.05) {
  const keys = Object.keys(scores);
  if (!keys.length) return {};
  const max = Math.max(...keys.map((k) => scores[k]));
  const exps = keys.map((k) => Math.exp((scores[k] - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return Object.fromEntries(keys.map((k, i) => [k, exps[i] / sum]));
}

/** Seeded PRNG (mulberry32) → stable layouts across builds. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fast 32-bit string hash (FNV-1a) — used for cache keys and seeds. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function distSq(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

/**
 * Minimum spanning tree (Prim, O(n²)) over points → edges as index pairs.
 * Used for the dotted constellation lines inside each genre.
 * @param {number[][]} points
 * @returns {[number, number][]}
 */
export function minimumSpanningTree(points) {
  const n = points.length;
  if (n < 2) return [];
  const inTree = new Array(n).fill(false);
  const best = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  best[0] = 0;
  /** @type {[number, number][]} */
  const edges = [];
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i;
    inTree[u] = true;
    if (parent[u] !== -1) edges.push([parent[u], u]);
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const d = distSq(points[u], points[v]);
      if (d < best[v]) {
        best[v] = d;
        parent[v] = u;
      }
    }
  }
  return edges;
}

/**
 * Indices of the k most similar vectors (by dot product), excluding `self`.
 * @param {number[][]} vectors unit vectors
 */
export function nearestNeighbors(vectors, self, k = 3) {
  return vectors
    .map((v, i) => ({ i, s: i === self ? -Infinity : dot(vectors[self], v) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.i);
}

/** Rescale points so the largest absolute coordinate equals `radius`, centred on the origin. */
export function fitToRadius(points, radius = 10) {
  if (!points.length) return [];
  const dim = points[0].length;
  const mean = new Array(dim).fill(0);
  for (const p of points) for (let i = 0; i < dim; i++) mean[i] += p[i] / points.length;
  const centred = points.map((p) => p.map((x, i) => x - mean[i]));
  let maxAbs = 0;
  for (const p of centred) for (const x of p) maxAbs = Math.max(maxAbs, Math.abs(x));
  const s = maxAbs === 0 ? 1 : radius / maxAbs;
  return centred.map((p) => p.map((x) => Math.round(x * s * 1000) / 1000));
}

export const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
export const lerp = (a, b, t) => a + (b - a) * t;

/** URL-safe slug. */
export function slugify(s) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lower-case alphanumeric tokens for fuzzy matching. */
export function tokens(s) {
  return slugify(s).split("-").filter(Boolean);
}

/** Formats seconds as m:ss or h:mm:ss. */
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
