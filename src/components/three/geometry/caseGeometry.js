/**
 * Procedural geometry for a PS4/PS5-style game case + disc (unit = 10 cm).
 * Real Blu-ray keep case: 135 × 171.5 × 12 mm; printed insert ≈129 × 165 mm.
 * Disc: Ø120 mm, 15 mm hole, 1.2 mm thick.
 * Geometries are created once and shared by every case (no per-case allocation).
 */
import * as THREE from "three";
import { CASE } from "@/lib/layout.js";

export const DISC = Object.freeze({ radius: 0.6, hole: 0.075, thickness: 0.012, stackRing: 0.17 });
export const LID_THICKNESS = 0.016;
export const TRAY_DEPTH = CASE.depth - LID_THICKNESS; // 0.122
export const CORNER = 0.055;

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedRectPath(w, h, r) {
  const shape = roundedRect(w, h, r);
  const path = new THREE.Path();
  path.setFromPoints(shape.getPoints(6));
  return path;
}

/** Planar UVs in [0,1] over the shape's bounding box (so textures map cleanly). */
function planarUVs(geometry, w, h) {
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

let cache = null;

/** Lazily built, shared geometry set. */
export function getCaseGeometries() {
  if (cache) return cache;
  const { width: w, height: h } = CASE;
  const wall = 0.022;

  // Tray: rounded frame (outer minus inner) extruded to tray depth
  const frameShape = roundedRect(w, h, CORNER);
  frameShape.holes.push(roundedRectPath(w - wall * 2, h - wall * 2, CORNER * 0.6));
  const trayFrame = new THREE.ExtrudeGeometry(frameShape, {
    depth: TRAY_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 6,
  });
  trayFrame.translate(0, 0, -CASE.depth / 2);

  // Tray floor (back plate)
  const floor = planarUVs(new THREE.ShapeGeometry(roundedRect(w - 0.004, h - 0.004, CORNER), 6), w, h);

  // Lid plate (front cover) — extruded, pivot at the hinge (left edge, x = 0)
  const lid = new THREE.ExtrudeGeometry(roundedRect(w, h, CORNER), {
    depth: LID_THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 6,
  });
  lid.translate(w / 2, 0, 0);

  // Faces that carry printed artwork
  const artW = w - 0.06;
  const artH = h - 0.065;
  const artPlane = planarUVs(new THREE.ShapeGeometry(roundedRect(artW, artH, CORNER * 0.5), 6), artW, artH);
  const sleevePlane = planarUVs(new THREE.ShapeGeometry(roundedRect(w - 0.012, h - 0.012, CORNER * 0.9), 6), w, h);
  const spinePlane = new THREE.PlaneGeometry(CASE.depth - 0.014, h - 0.05);

  // Centre hub with 12 petal clips
  const hub = new THREE.CylinderGeometry(0.072, 0.078, 0.026, 40, 1);
  hub.rotateX(Math.PI / 2);
  const petal = new THREE.BoxGeometry(0.016, 0.044, 0.02);
  const hubRing = new THREE.TorusGeometry(0.12, 0.008, 8, 48);
  const discWell = new THREE.RingGeometry(DISC.radius + 0.004, DISC.radius + 0.022, 96);

  // Manual clips on the inside of the lid
  const clip = new THREE.BoxGeometry(0.12, 0.022, 0.016);

  // Disc parts
  const discFace = new THREE.RingGeometry(DISC.hole, DISC.radius, 128, 1);
  const discEdge = new THREE.CylinderGeometry(DISC.radius, DISC.radius, DISC.thickness, 128, 1, true);
  discEdge.rotateX(Math.PI / 2);
  const discInnerEdge = new THREE.CylinderGeometry(DISC.hole, DISC.hole, DISC.thickness, 48, 1, true);
  discInnerEdge.rotateX(Math.PI / 2);

  cache = {
    trayFrame,
    floor,
    lid,
    artPlane,
    sleevePlane,
    spinePlane,
    hub,
    petal,
    hubRing,
    discWell,
    clip,
    discFace,
    discEdge,
    discInnerEdge,
  };
  return cache;
}
