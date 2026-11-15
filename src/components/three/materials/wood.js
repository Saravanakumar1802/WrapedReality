/**
 * Procedural timber for the shelf cabinet: no image downloads, fully themeable
 * (colours come from theme.scene.shelf). One canvas is drawn once and shared;
 * each cabinet part gets a cheap texture clone with its own repeat/rotation.
 *
 * The drawing mimics flat-sawn walnut: broad tonal bands, hundreds of fine grain
 * lines that wander together, short dark pores, and a few cathedral arches.
 * Every wave uses a whole number of cycles across the canvas so it tiles.
 */
import * as THREE from "three";
import { theme } from "@/theme";
import { mulberry32 } from "@/lib/math.js";
import { rgba } from "@/lib/color.js";
import { createCanvas } from "@/components/three/art/art.js";

const W = 1024;
const H = 512;
const TAU = Math.PI * 2;

let source = null;

function drawWood() {
  const s = theme.scene.shelf;
  const rnd = mulberry32(7411);
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.fillStyle = s.wood;
  ctx.fillRect(0, 0, W, H);

  // A shared, slow wander that every grain line follows (so lines never cross).
  const waves = Array.from({ length: 4 }, (_, i) => ({ cycles: i + 1, amp: (10 + rnd() * 16) / (i + 1), phase: rnd() * TAU }));
  const wander = (x, y) => waves.reduce((sum, w) => sum + Math.sin((x / W) * TAU * w.cycles + w.phase + y * 0.006) * w.amp, 0);

  const strand = (y, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let x = -16; x <= W + 16; x += 16) {
      const yy = y + wander(x, y);
      if (x === -16) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  };

  // broad tonal bands (growth rings cut along the board)
  for (let i = 0; i < 34; i++) {
    strand(rnd() * H, 10 + rnd() * 46, rgba(rnd() > 0.5 ? s.woodLight : s.woodDark, 0.05 + rnd() * 0.1));
  }
  // fine grain
  for (let i = 0; i < 520; i++) {
    strand(rnd() * H, 0.5 + rnd() * 1.4, rgba(rnd() > 0.22 ? s.woodDark : s.woodLight, 0.06 + rnd() * 0.24));
  }
  // cathedral arches: a few long ellipses, typical of flat-sawn boards
  for (let i = 0; i < 3; i++) {
    const cx = rnd() * W;
    const cy = rnd() * H;
    for (let k = 1; k < 7; k++) {
      ctx.strokeStyle = rgba(s.woodDark, 0.1);
      ctx.lineWidth = 1 + rnd();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70 * k + rnd() * 16, 5 * k + rnd() * 3, 0, 0, TAU);
      ctx.stroke();
    }
  }
  // pores: short dark dashes along the grain
  ctx.strokeStyle = rgba(s.woodDark, 0.34);
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const len = 3 + rnd() * 11;
    ctx.lineWidth = 0.5 + rnd() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y + wander(x, y));
    ctx.lineTo(x + len, y + wander(x + len, y));
    ctx.stroke();
  }
  return c;
}

const cache = new Map();

/**
 * A lacquered timber material.
 * @param {string} key cache key (one per cabinet part)
 * @param {{ repeat?: [number, number], vertical?: boolean, tone?: string, offset?: number }} [opts]
 *   repeat: texture tiling along/across the grain · vertical: grain runs up the part
 *   tone: multiply colour (darker parts in shadow) · offset: shifts the pattern so parts don't match
 */
export function woodMaterial(key, { repeat = [1, 1], vertical = false, tone, offset = 0 } = {}) {
  const id = `${key}|${repeat}|${vertical}|${tone}|${offset}`;
  if (cache.has(id)) return cache.get(id);
  source ??= drawWood();

  const make = (colorSpace) => {
    const t = new THREE.CanvasTexture(source);
    t.colorSpace = colorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.offset.set(offset, offset * 0.37);
    if (vertical) {
      t.center.set(0.5, 0.5);
      t.rotation = Math.PI / 2;
    }
    t.anisotropy = 8;
    return t;
  };

  const material = new THREE.MeshPhysicalMaterial({
    map: make(THREE.SRGBColorSpace),
    bumpMap: make(THREE.NoColorSpace),
    bumpScale: 0.6,
    color: tone ?? theme.colors.text,
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.35, // satin lacquer
    clearcoatRoughness: 0.45,
  });
  cache.set(id, material);
  return material;
}

/** A brass label plate with engraved text (one per shelf row). */
export function plateTexture(text, font) {
  const s = theme.scene.shelf;
  const c = createCanvas(512, 64);
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, rgba(s.plate, 1));
  g.addColorStop(0.5, rgba(theme.colors.text, 0.9));
  g.addColorStop(1, rgba(s.plate, 1));
  ctx.fillStyle = s.plate;
  ctx.fillRect(0, 0, 512, 64);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 64);
  ctx.globalAlpha = 1;
  // brushed finish
  const rnd = mulberry32(99);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rgba(rnd() > 0.5 ? theme.colors.text : s.plateText, 0.05);
    ctx.fillRect(0, rnd() * 64, 512, 0.6 + rnd());
  }
  ctx.fillStyle = s.plateText;
  ctx.font = `700 34px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "3px";
  ctx.fillText(text, 256, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let hexPanels = null;
/**
 * Height map for the room wall: a honeycomb of acoustic panels. Used as a bump
 * map only, so the coloured room lights rake across the seams.
 */
export function hexPanelTexture() {
  if (hexPanels) return hexPanels;
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgb(150,150,150)";
  ctx.fillRect(0, 0, size, size);
  // pointy-top hexagons; 4 columns × 4.6 rows tile exactly across the canvas
  const r = size / 4 / Math.sqrt(3);
  const w = Math.sqrt(3) * r;
  ctx.strokeStyle = "rgb(20,20,20)";
  ctx.lineWidth = 7;
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 5; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0);
      const cy = row * r * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  hexPanels = new THREE.CanvasTexture(c);
  hexPanels.wrapS = hexPanels.wrapT = THREE.RepeatWrapping;
  hexPanels.anisotropy = 4;
  return hexPanels;
}
