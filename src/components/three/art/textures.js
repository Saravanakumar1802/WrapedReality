import { useEffect, useState } from "react";
import { createCanvas, drawDiscLabel, drawSpine, ensureFonts, loadBrand, loadImage } from "./art.js";
import { canvasTexture } from "./canvasTexture.js";
import { caseTextureKey, loadCaseTextures, peekCaseTextures, retainCaseTextures } from "./caseTextureCache.js";

/**
 * All textures for one detailed case, from the shared cache (see caseTextureCache.js).
 * Renders with the finished set on the first frame when it was prefetched;
 * otherwise returns null until the set is ready.
 */
export function useCaseTextures(game, takeaway = "") {
  const key = caseTextureKey(game, takeaway);
  const [state, setState] = useState(() => ({ key, tex: peekCaseTextures(game, takeaway) }));
  useEffect(() => {
    let alive = true;
    const ready = peekCaseTextures(game, takeaway);
    // a different game: show its finished set right away, or wait for it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s.key === key && s.tex === ready ? s : { key, tex: ready }));
    let release = () => {};
    loadCaseTextures(game, takeaway)
      .then((tex) => {
        if (!alive) return;
        release = retainCaseTextures(key);
        setState({ key, tex });
      })
      .catch(() => {});
    return () => {
      alive = false;
      release();
    };
  }, [game, takeaway, key]);
  return state.key === key ? state.tex : null;
}

/** Disc label only (hero disc, mini discs). */
export function useDiscLabel(game, size = 1024) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    (async () => {
      const [, img, brand] = await Promise.all([ensureFonts(), loadImage(game.cover), loadBrand(game.platform)]);
      if (!alive) return;
      const c = createCanvas(size, size);
      drawDiscLabel(c.getContext("2d"), game, size, img, brand);
      made = canvasTexture(c);
      setTex(made);
    })();
    return () => {
      alive = false;
      made?.dispose();
      setTex(null);
    };
  }, [game, size]);
  return tex;
}

/** Atlas cell for one spine. The printed area of a spine is about 1 : 16. */
export const SPINE_CELL = { w: 128, h: 2080 };
/** Fraction of a cell (each side) that is never sampled, so mipmaps can't bleed between spines. */
export const SPINE_PAD = 8 / 128;
const ATLAS_MAX = 4096; // safe texture size on every WebGL2 device

/**
 * Columns × rows for n spines in one texture: the grid that needs the least
 * shrinking (k = 1 means full resolution), so spines stay as sharp as possible
 * however big the library gets.
 */
export function atlasGrid(n, max = ATLAS_MAX) {
  let best = { cols: 1, rows: Math.max(1, n), k: 0 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const rows = Math.ceil(n / cols);
    const k = Math.min(1, max / (rows * SPINE_CELL.h), max / (cols * SPINE_CELL.w));
    if (k > best.k + 1e-9 || (Math.abs(k - best.k) < 1e-9 && cols * rows < best.cols * best.rows)) best = { cols, rows, k };
  }
  return best;
}

/**
 * One atlas holding every spine (real art slices + real logos) → a single texture
 * for the instanced shelf. Uses the small thumbnails to keep loading light.
 */
export function useSpineAtlas(games) {
  const [atlas, setAtlas] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    (async () => {
      const platforms = [...new Set(games.map((g) => g.platform))];
      const [, imgs, brands] = await Promise.all([
        ensureFonts(),
        Promise.all(games.map((g) => loadImage(g.thumb ?? g.cover))),
        Promise.all(platforms.map(loadBrand)),
      ]);
      if (!alive) return;
      const brandBy = Object.fromEntries(platforms.map((p, i) => [p, brands[i]]));
      const { cols, rows, k } = atlasGrid(games.length);
      const cell = { w: Math.floor(SPINE_CELL.w * k), h: Math.floor(SPINE_CELL.h * k) };
      const c = createCanvas(cols * cell.w, rows * cell.h);
      const ctx = c.getContext("2d");
      const index = new Map();
      games.forEach((g, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        drawSpine(ctx, g, col * cell.w, row * cell.h, cell.w, cell.h, imgs[i], brandBy[g.platform]);
        index.set(g.slug, i);
      });
      const texture = canvasTexture(c, 16); // mipmapped + max anisotropy: text stays crisp at grazing angles
      made = { texture, cols, rows, index };
      setAtlas(made);
    })();
    return () => {
      alive = false;
      made?.texture.dispose();
      setAtlas(null);
    };
  }, [games]);
  return atlas;
}
