/**
 * Canvas art for retail-accurate PS4/PS5 cases and discs.
 *
 * Reference (researched): PS5 inserts carry a white top banner with the black PS5
 * logo; PS4 inserts carry a PlayStation-blue banner with the white PS4 logo. The
 * banner is ~8% of the insert height with the logo at roughly half its height,
 * left-aligned. Spines repeat the banner as a header block. Discs are Blu-ray:
 * printed label art, a clear centre ring, a mirror band, and the platform logo.
 *
 * Real cover art comes from the build pipeline (Steam / Wikipedia / IGDB); a
 * designed fallback is drawn only when no art exists. All colours come from the theme.
 */
import { theme, platformTheme } from "@/theme";
import { hashString, mulberry32 } from "@/lib/math.js";
import { GENRES } from "@/data/taxonomy.js";
import { hexToRgb, rgba } from "@/lib/color.js";
import { SITE } from "@/lib/site.js";

export const BAND_RATIO = 0.082; // banner height / insert height
const BLURAY = "/brand/bluray.png";
const PS_SYMBOL = "/brand/playstation.png";
const PLAYSTATION = new Set(["PS5", "PS4", "PS2"]);
/** Printed format line on discs that don't carry a Blu-ray logo. */
const DISC_FORMAT = { PC: "DVD-ROM", PS2: "DVD-ROM" };

function fontStack(varName, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}
/** Canvas font stacks. Printed matter (covers, spines, discs) uses the theme's `print` face. */
export const fonts = () => ({
  print: fontStack("--font-print", "system-ui, sans-serif"),
  body: fontStack("--font-body", "system-ui, sans-serif"),
  mono: fontStack("--font-mono", "ui-monospace, monospace"),
});

/** @type {Promise<void> | null} */
let fontsReady = null;
/**
 * Make sure canvas text renders with the real fonts (not fallbacks).
 * Resolved once per page: `document.fonts.load()` can take seconds to settle
 * even when the faces are already loaded, and every case build used to wait on it.
 */
export function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  fontsReady ??= (async () => {
    const f = fonts();
    try {
      await Promise.all([
        document.fonts.load(`800 64px ${f.print}`),
        document.fonts.load(`700 condensed 64px ${f.print}`),
        document.fonts.load(`600 32px ${f.body}`),
        document.fonts.load(`500 24px ${f.mono}`),
      ]);
    } catch {
      /* fall back silently */
    }
  })();
  return fontsReady;
}

const imageCache = new Map();
/** @returns {Promise<HTMLImageElement | null>} */
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      }),
    );
  }
  return imageCache.get(src);
}

export function createCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const tintCache = new Map();
/** A logo recoloured to a flat colour (logos ship black on transparent). */
function tinted(img, color) {
  const key = `${img.src}|${color}`;
  if (!tintCache.has(key)) {
    const c = createCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c);
  }
  return tintCache.get(key);
}

/** Loads every brand asset needed for a platform. */
export async function loadBrand(platform) {
  const pt = platformTheme(platform);
  // PC games ship on DVD in plain black cases: no PlayStation symbol, no Blu-ray logo
  const console_ = PLAYSTATION.has(platform);
  const [mark, bluray, symbol] = await Promise.all([
    loadImage(pt.mark),
    console_ ? loadImage(BLURAY) : null,
    console_ ? loadImage(PS_SYMBOL) : null,
  ]);
  return { mark, bluray, symbol, format: DISC_FORMAT[platform] ?? null };
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function drawImageCover(ctx, img, x, y, w, h, focusY = 0.5) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * focusY, dw, dh);
}

/** Draws a logo scaled to a target height (or width cap), returns drawn width. */
function drawMark(ctx, mark, color, x, y, height, maxWidth = Infinity) {
  if (!mark) return 0;
  const src = tinted(mark, color);
  let h = height;
  let w = (mark.naturalWidth / mark.naturalHeight) * h;
  if (w > maxWidth) {
    w = maxWidth;
    h = (mark.naturalHeight / mark.naturalWidth) * w;
  }
  ctx.drawImage(src, x, y - h / 2, w, h);
  return w;
}

function grain(ctx, x, y, w, h, seed, alpha) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < (w * h) / 110; i++) {
    const v = rnd() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x + rnd() * w, y + rnd() * h, 1.3, 1.3);
  }
  ctx.restore();
}

export function wrapLines(ctx, text, maxWidth, maxLines = 99) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

/** Shrinks a title until it fits a box. */
function fitTitle(ctx, text, font, maxW, maxH, start, min = 14, lh = 0.92) {
  let size = start;
  while (size > min) {
    ctx.font = font(size);
    const lines = wrapLines(ctx, text, maxW, 4);
    if (!lines.some((l) => ctx.measureText(l).width > maxW) && lines.length * size * lh <= maxH) return { lines, size };
    size -= 2;
  }
  ctx.font = font(min);
  return { lines: wrapLines(ctx, text, maxW, 4), size: min };
}

/** Designed fallback art (only when no real cover exists). */
function fallbackArt(ctx, game, x, y, w, h) {
  const [a, b] = game.palette;
  const rnd = mulberry32(hashString(game.slug));
  const bg = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  bg.addColorStop(0, a);
  bg.addColorStop(1, theme.colors.void);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 3; i++) {
    const cx = x + w * (0.2 + rnd() * 0.6);
    const cy = y + h * (0.15 + rnd() * 0.5);
    const r = w * (0.4 + rnd() * 0.5);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(i % 2 ? a : b, 0.6));
    g.addColorStop(1, rgba(i % 2 ? a : b, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  const shade = ctx.createLinearGradient(x, y + h * 0.4, x, y + h);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, theme.cover.shade);
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, h);
  grain(ctx, x, y, w, h, hashString(game.slug), theme.cover.noiseOpacity);

  const f = fonts();
  const pad = w * 0.08;
  const { lines, size } = fitTitle(
    ctx,
    game.title.toUpperCase(),
    (s) => `800 ${s}px ${f.print}`,
    w - pad * 2,
    h * 0.36,
    Math.round(w * 0.14),
  );
  ctx.font = `800 ${size}px ${f.print}`;
  ctx.fillStyle = theme.cover.titleColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const lh = size * 0.92;
  const baseY = y + h - pad - (lines.length - 1) * lh;
  lines.forEach((l, i) => ctx.fillText(l, x + pad, baseY + i * lh));
  ctx.font = `600 ${Math.round(w * 0.034)}px ${f.body}`;
  ctx.fillStyle = rgba(theme.colors.text, 0.75);
  ctx.fillText(GENRES[game.primaryGenre]?.label ?? "", x + pad, baseY - lh - size * 0.05);
}

/** The retail banner: platform colour + real logo, left aligned. */
function drawBand(ctx, platform, brand, x, y, w, bandH) {
  const pt = platformTheme(platform);
  ctx.fillStyle = pt.band;
  ctx.fillRect(x, y, w, bandH);
  if (brand?.mark) {
    drawMark(ctx, brand.mark, pt.bandText, x + bandH * 0.42, y + bandH / 2, bandH * 0.5);
  } else {
    const f = fonts();
    ctx.fillStyle = pt.bandText;
    ctx.font = `800 ${Math.round(bandH * 0.5)}px ${f.print}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(pt.label, x + bandH * 0.42, y + bandH / 2);
  }
}

/** Front insert: banner + real cover art. */
export function drawCover(ctx, game, w, h, img, brand, { band = true } = {}) {
  const bandH = band ? Math.round(h * BAND_RATIO) : 0;
  ctx.clearRect(0, 0, w, h);
  if (img) {
    ctx.fillStyle = theme.colors.void;
    ctx.fillRect(0, bandH, w, h - bandH);
    drawImageCover(ctx, img, 0, bandH, w, h - bandH, 0.35);
  } else fallbackArt(ctx, game, 0, bandH, w, h - bandH);
  if (band) drawBand(ctx, game.platform, brand, 0, 0, w, bandH);
}

/**
 * Spine, as printed on a retail wrap (reads top to bottom):
 *   header block in the platform's banner colour with the platform logo turned 90°,
 *   the title in a narrow face over a dark slice of the cover art,
 *   the PlayStation symbol at the foot.
 * Fold creases and a sleeve highlight are baked in; the 3D material adds real gloss.
 */
export function drawSpine(ctx, game, x, y, w, h, img, brand) {
  const pt = platformTheme(game.platform);
  const f = fonts();
  const c = theme.cover;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // stock + a vertical slice from the centre of the cover, darkened so the title reads
  ctx.fillStyle = c.spineBase;
  ctx.fillRect(x, y, w, h);
  if (img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    ctx.drawImage(img, iw * 0.44, 0, iw * 0.12, ih, x, y, w, h);
    ctx.fillStyle = c.spineShade;
    ctx.fillRect(x, y, w, h);
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, game.palette[0]);
    g.addColorStop(1, c.spineBase);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  // header block with the real logo, rotated to run down the spine
  const blockH = Math.round(w * 3.1);
  ctx.fillStyle = pt.band;
  ctx.fillRect(x, y, w, blockH);
  ctx.save();
  ctx.translate(x + w / 2, y + blockH / 2);
  ctx.rotate(Math.PI / 2);
  if (brand?.mark) {
    const ratio = brand.mark.naturalWidth / brand.mark.naturalHeight;
    let mh = w * 0.5;
    let mw = mh * ratio;
    const maxLen = blockH * 0.8;
    if (mw > maxLen) {
      mw = maxLen;
      mh = mw / ratio;
    }
    ctx.drawImage(tinted(brand.mark, pt.bandText), -mw / 2, -mh / 2, mw, mh);
  } else {
    ctx.fillStyle = pt.bandText;
    ctx.font = `800 ${Math.round(w * 0.5)}px ${f.print}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pt.label, 0, 0);
  }
  ctx.restore();

  // title: bold, narrow, with a soft dark halo so it reads over any art
  const footH = w * 1.5;
  const maxLen = h - blockH - footH - w * 0.9;
  const text = game.title.toUpperCase();
  const font = (px) => `800 condensed ${px}px ${f.print}`;
  let size = Math.round(w * 0.6);
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxLen && size > 9) {
    size -= 1;
    ctx.font = font(size);
  }
  ctx.save();
  ctx.translate(x + w / 2, y + blockH + w * 0.45);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = pt.spineText;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.shadowColor = c.crease;
  ctx.shadowBlur = size * 0.35;
  ctx.fillText(text, 0, size * 0.04);
  ctx.shadowBlur = 0;
  ctx.fillText(text, 0, size * 0.04); // second pass keeps the glyph edges hard
  ctx.restore();

  // PlayStation symbol at the foot
  if (brand?.symbol) {
    const sw = w * 0.56;
    const sh = sw * (brand.symbol.naturalHeight / brand.symbol.naturalWidth);
    ctx.drawImage(tinted(brand.symbol, pt.spineText), x + (w - sw) / 2, y + h - footH / 2 - sh / 2, sw, sh);
  }

  // fold creases at both edges + a soft sleeve highlight
  const edge = ctx.createLinearGradient(x, 0, x + w, 0);
  edge.addColorStop(0, c.crease);
  edge.addColorStop(0.14, "rgba(0,0,0,0)");
  edge.addColorStop(0.3, c.gloss);
  edge.addColorStop(0.46, c.sheen);
  edge.addColorStop(0.86, "rgba(0,0,0,0)");
  edge.addColorStop(1, c.crease);
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Back insert: banner, blurred art, title, summary, PlayStation + Blu-ray marks. */
export function drawBack(ctx, game, w, h, img, brand) {
  const f = fonts();
  const bandH = Math.round(h * BAND_RATIO);
  ctx.save();
  ctx.filter = "blur(16px) saturate(1.2)";
  if (img) drawImageCover(ctx, img, -24, -24, w + 48, h + 48);
  else fallbackArt(ctx, game, 0, 0, w, h);
  ctx.restore();
  ctx.fillStyle = theme.colors.scrim;
  ctx.fillRect(0, 0, w, h);
  drawBand(ctx, game.platform, brand, 0, 0, w, bandH);

  const pad = w * 0.08;
  // art panel
  if (img) {
    const ph = h * 0.3;
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, bandH + pad, w - pad * 2, ph);
    ctx.clip();
    drawImageCover(ctx, img, pad, bandH + pad, w - pad * 2, ph, 0.3);
    ctx.restore();
  }
  let yy = bandH + pad + (img ? h * 0.3 + pad * 0.8 : pad);
  ctx.fillStyle = theme.colors.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const t = fitTitle(ctx, game.title.toUpperCase(), (s) => `800 ${s}px ${f.print}`, w - pad * 2, h * 0.12, Math.round(w * 0.075));
  ctx.font = `800 ${t.size}px ${f.print}`;
  t.lines.forEach((l, i) => ctx.fillText(l, pad, yy + i * t.size * 0.95));
  yy += t.lines.length * t.size * 0.95 + pad * 0.5;
  ctx.font = `500 ${Math.round(w * 0.04)}px ${f.body}`;
  ctx.fillStyle = rgba(theme.colors.text, 0.82);
  wrapLines(ctx, game.summary, w - pad * 2, 6).forEach((l, i) => ctx.fillText(l, pad, yy + i * w * 0.056));

  // footer strip with real marks
  const fy = h - pad * 1.4;
  if (brand?.symbol) drawMark(ctx, brand.symbol, theme.colors.text, pad, fy, w * 0.07);
  if (brand?.bluray) drawMark(ctx, brand.bluray, theme.colors.text, w - pad - w * 0.16, fy, w * 0.07, w * 0.16);
}

/**
 * Disc label (front, printed side). Planar-mapped onto a ring: canvas centre is
 * the disc centre, canvas edge is the disc rim (Ø120 mm).
 */
export function drawDiscLabel(ctx, game, size, img, brand) {
  const f = fonts();
  const c = size / 2;
  const R = size / 2;
  const hole = R * (0.075 / 0.6); // 15 mm hole
  const clearR = R * (0.165 / 0.6); // clear stacking ring
  const mirrorR = R * (0.205 / 0.6); // mirror band edge (print starts here)
  ctx.clearRect(0, 0, size, size);

  // printed area
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R * 0.992, 0, Math.PI * 2);
  ctx.arc(c, c, mirrorR, 0, Math.PI * 2, true);
  ctx.clip("evenodd");
  if (img) {
    drawImageCover(ctx, img, 0, 0, size, size, 0.32);
  } else fallbackArt(ctx, game, 0, 0, size, size);
  // ink vignette near the rim, like screen-printed labels
  const v = ctx.createRadialGradient(c, c, R * 0.55, c, c, R);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // mirror band (silver) between clear ring and print
  const m = ctx.createRadialGradient(c, c, clearR, c, c, mirrorR);
  m.addColorStop(0, rgba(theme.scene.disc.hub, 0.95));
  m.addColorStop(0.5, rgba(theme.scene.disc.dataSide, 0.75));
  m.addColorStop(1, rgba(theme.scene.disc.hub, 0.95));
  ctx.fillStyle = m;
  ctx.beginPath();
  ctx.arc(c, c, mirrorR, 0, Math.PI * 2);
  ctx.arc(c, c, clearR, 0, Math.PI * 2, true);
  ctx.fill("evenodd");

  // clear plastic ring (mostly transparent)
  ctx.fillStyle = rgba(theme.scene.disc.hub, 0.22);
  ctx.beginPath();
  ctx.arc(c, c, clearR, 0, Math.PI * 2);
  ctx.arc(c, c, hole, 0, Math.PI * 2, true);
  ctx.fill("evenodd");

  const print = theme.scene.disc.print;
  // platform logo at the top of the label
  if (brand?.mark) {
    const mh = size * 0.05;
    const mw = (brand.mark.naturalWidth / brand.mark.naturalHeight) * mh;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = size * 0.01;
    drawMark(ctx, brand.mark, print, c - mw / 2, c - R * 0.66, mh);
    ctx.restore();
  }
  // Blu-ray mark at the bottom
  if (brand?.bluray) {
    const bw = size * 0.13;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = size * 0.008;
    drawMark(ctx, brand.bluray, print, c - bw / 2, c + R * 0.7, size * 0.07, bw);
    ctx.restore();
  } else if (brand?.format) {
    // DVD discs print their format as text where a Blu-ray disc has its logo
    ctx.save();
    ctx.fillStyle = print;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = size * 0.008;
    ctx.font = `800 condensed ${Math.round(size * 0.034)}px ${f.print}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brand.format, c, c + R * 0.7);
    ctx.restore();
  }

  // rim text
  const pt = platformTheme(game.platform);
  const text = `${game.title.toUpperCase()}  •  ${pt.name.toUpperCase()}  •  ${SITE.name.toUpperCase()}`;
  ctx.font = `600 ${Math.round(size * 0.019)}px ${f.body}`;
  ctx.fillStyle = rgba(print, 0.85);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const radius = R * 0.9;
  const total = ctx.measureText(text).width;
  let angle = Math.PI / 2 + total / radius / 2; // centred at the bottom, reading left→right
  for (const ch of text) {
    const cw = ctx.measureText(ch).width;
    angle -= cw / 2 / radius;
    ctx.save();
    ctx.translate(c + Math.cos(angle) * radius, c + Math.sin(angle) * radius);
    ctx.rotate(angle - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle -= cw / 2 / radius;
  }
}

/** Inside of the front cover: reverse print with the takeaway (or summary). */
export function drawInsert(ctx, game, w, h, img, takeaway = "") {
  const f = fonts();
  ctx.save();
  ctx.filter = "blur(22px) saturate(1.3)";
  if (img) drawImageCover(ctx, img, -30, -30, w + 60, h + 60);
  else fallbackArt(ctx, game, 0, 0, w, h);
  ctx.restore();
  ctx.fillStyle = rgba(theme.colors.void, 0.72);
  ctx.fillRect(0, 0, w, h);

  const pad = w * 0.1;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = theme.colors.text;
  const t = fitTitle(ctx, game.title.toUpperCase(), (s) => `800 ${s}px ${f.print}`, w - pad * 2, h * 0.22, Math.round(w * 0.1));
  ctx.font = `800 ${t.size}px ${f.print}`;
  t.lines.forEach((l, i) => ctx.fillText(l, pad, pad + i * t.size * 0.95));
  let yy = pad + t.lines.length * t.size * 0.95 + w * 0.05;

  const g = ctx.createLinearGradient(pad, 0, w - pad, 0);
  theme.holo.stops.forEach((s, i) => g.addColorStop(i / (theme.holo.stops.length - 1), s));
  ctx.fillStyle = g;
  ctx.fillRect(pad, yy, w * 0.25, Math.max(2, w * 0.006));
  yy += w * 0.06;

  ctx.font = `500 ${Math.round(w * 0.046)}px ${f.body}`;
  ctx.fillStyle = rgba(theme.colors.text, 0.88);
  wrapLines(ctx, takeaway || game.summary, w - pad * 2, 9).forEach((l, i) => ctx.fillText(l, pad, yy + i * w * 0.066));

  ctx.font = `500 ${Math.round(w * 0.032)}px ${f.mono}`;
  ctx.fillStyle = rgba(theme.colors.textMuted, 0.95);
  ctx.fillText(takeaway ? "MY TAKEAWAY" : "TAKEAWAY COMING SOON", pad, h - pad - w * 0.04);
}
