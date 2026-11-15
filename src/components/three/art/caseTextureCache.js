/**
 * Printed textures for one detailed case (cover, back, spine, insert, disc label),
 * built once and shared.
 *
 * Why a cache: pulling a case off the shelf used to draw five large canvases and
 * upload five mipmapped textures in the same frame the flight animation started,
 * which is exactly when a dropped frame is most visible. Now:
 *  - drawing is spread over several frames (one canvas per frame),
 *  - it can start early (`prefetchCaseTextures` on hover / press / neighbours),
 *  - GPU uploads are spread over frames too when a renderer is given,
 *  - recently used sets stay warm, so reopening a case is instant.
 */
import { hashString } from "@/lib/math.js";
import { isCoarsePointer, isLowEndDevice } from "@/lib/env.js";
import { createCanvas, drawBack, drawCover, drawDiscLabel, drawInsert, drawSpine, ensureFonts, loadBrand, loadImage } from "./art.js";
import { canvasTexture } from "./canvasTexture.js";

/** Insert proportions: 129 × 165 mm printed area under the sleeve. */
const COVER = { w: 1032, h: 1320 };

/** Idle (unused) sets kept warm. Each set is roughly 16 MB of GPU memory, so phones keep fewer. */
const maxIdle = () => (isCoarsePointer() || isLowEndDevice() ? 2 : 4);

/** @typedef {{ cover: any, back: any, spine: any, insert: any, label: any }} CaseTextures */
/** @type {Map<string, { promise: Promise<CaseTextures>, value: CaseTextures | null, refs: number, used: number }>} */
const entries = new Map();

export const caseTextureKey = (game, takeaway = "") => `${game.slug}:${takeaway ? hashString(takeaway) : 0}`;

/** Resolves after the browser has painted a frame, so long work never blocks two frames in a row. */
const nextFrame = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === "undefined") return setTimeout(resolve, 0);
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

async function build(game, takeaway) {
  const [, img, brand] = await Promise.all([ensureFonts(), loadImage(game.cover), loadBrand(game.platform)]);
  const paint = async (w, h, draw) => {
    await nextFrame();
    const c = createCanvas(w, h);
    draw(c.getContext("2d"), c);
    return canvasTexture(c);
  };
  // Cover first: it is what the visitor sees as the case flies out.
  const cover = await paint(COVER.w, COVER.h, (ctx, c) => drawCover(ctx, game, c.width, c.height, img, brand));
  const spine = await paint(128, 2080, (ctx, c) => drawSpine(ctx, game, 0, 0, c.width, c.height, img, brand));
  const back = await paint(640, 820, (ctx, c) => drawBack(ctx, game, c.width, c.height, img, brand));
  const label = await paint(1024, 1024, (ctx, c) => drawDiscLabel(ctx, game, c.width, img, brand));
  const insert = await paint(640, 820, (ctx, c) => drawInsert(ctx, game, c.width, c.height, img, takeaway));
  return { cover, spine, back, label, insert };
}

/** Uploads textures to the GPU one per frame (instead of all on first render). */
async function upload(gl, tex) {
  if (!gl?.initTexture) return;
  for (const t of Object.values(tex)) {
    await nextFrame();
    gl.initTexture(t);
  }
}

function evict() {
  const idle = [...entries].filter(([, e]) => e.refs === 0 && e.value).sort((a, b) => a[1].used - b[1].used);
  while (idle.length > maxIdle()) {
    const [key, e] = /** @type {[string, any]} */ (idle.shift());
    Object.values(e.value).forEach((t) => t.dispose());
    entries.delete(key);
  }
}

/**
 * Starts (or joins) building one case's textures.
 * @param {any} game lite game record
 * @param {string} [takeaway] printed on the insert
 * @param {any} [gl] a THREE.WebGLRenderer, to pre-upload the textures
 * @returns {Promise<CaseTextures>}
 */
export function loadCaseTextures(game, takeaway = "", gl = null) {
  const key = caseTextureKey(game, takeaway);
  const hit = entries.get(key);
  if (hit) {
    hit.used = performance.now();
    return hit.promise;
  }
  const entry = { value: null, refs: 0, used: performance.now(), promise: /** @type {any} */ (null) };
  entry.promise = build(game, takeaway).then(
    (tex) => {
      entry.value = tex;
      upload(gl, tex);
      evict();
      return tex;
    },
    (err) => {
      entries.delete(key);
      throw err;
    },
  );
  entries.set(key, entry);
  return entry.promise;
}

/** Fire-and-forget warm-up (hover, press, neighbours of the open case). */
export function prefetchCaseTextures(game, takeaway = "", gl = null) {
  if (game?.slug) loadCaseTextures(game, takeaway, gl).catch(() => {});
}

/** The finished set if it is already built (lets a case render fully on its first frame). */
export const peekCaseTextures = (game, takeaway = "") => entries.get(caseTextureKey(game, takeaway))?.value ?? null;

/** A mounted case holds a reference so its textures are never evicted while visible. */
export function retainCaseTextures(key) {
  const e = entries.get(key);
  if (e) e.refs++;
  return () => {
    const cur = entries.get(key);
    if (cur && cur.refs > 0) cur.refs--;
    evict();
  };
}

/** Test hook: drop everything. */
export function clearCaseTextureCache() {
  entries.forEach((e) => e.value && Object.values(e.value).forEach((t) => t.dispose()));
  entries.clear();
}
