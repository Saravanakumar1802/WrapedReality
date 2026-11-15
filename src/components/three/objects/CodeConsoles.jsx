/**
 * Procedural console models (unit = 10 cm, built to the real outer dimensions):
 *   PS5  (2020)  390 × 104 × 260 mm, standing: black core between two white plates
 *   PS4  (2013)  275 × 53 × 305 mm, lying: a slanted slab split by a gap and a light bar
 *   PS2  (2000)  301 × 78 × 182 mm, lying: ridged top, tray, ports and the blue logo tile
 *
 * No model downloads: a few KB of code, themeable (theme.scene.consoles), and
 * every status light is live: `powered` eases it from standby to on.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { theme } from "@/theme";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Materials shared by every console (created once per colour/finish). */
const cache = new Map();
function plastic(color, { gloss = false, rough } = {}) {
  const key = `${color}|${gloss}|${rough}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: rough ?? (gloss ? 0.08 : 0.55),
        metalness: 0,
        clearcoat: gloss ? 1 : 0.15,
        clearcoatRoughness: gloss ? 0.04 : 0.5,
      }),
    );
  }
  return cache.get(key);
}

/**
 * A status light. Returns a material whose colour eases between `off` and `on`
 * (brighter than white when on, so bloom picks it up). `pulse` makes it breathe
 * for the first seconds after power-on, like a console booting.
 */
function useLed(powered, off, on, { boost = 2.4, boot } = {}) {
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const colors = useMemo(
    () => ({ off: new THREE.Color(off), on: new THREE.Color(on), boot: new THREE.Color(boot ?? on) }),
    [off, on, boot],
  );
  const state = useRef({ level: 0, since: 0 });
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    state.current.since = 0;
  }, [powered]);
  useFrame((_, dt) => {
    const s = state.current;
    s.since += dt;
    s.level += ((powered ? 1 : 0) - s.level) * (1 - Math.exp(-dt * 5));
    // boot: the boot colour pulses for ~2.4 s, then settles on the ready colour
    const booting = powered ? 1 - smooth(1.8, 2.6, s.since) : 0;
    const pulse = 0.7 + 0.3 * Math.sin(s.since * 7);
    material.color
      .copy(colors.off)
      .multiplyScalar(0.9)
      .lerp(colors.on, s.level * (1 - booting))
      .lerp(colors.boot, s.level * booting)
      .multiplyScalar(1 + s.level * (boost - 1) * (booting ? pulse : 1));
  });
  return material;
}

// ── PlayStation 5 ──────────────────────────────────────────────────────

/** One of the two white plates: a thin sheet that tapers, slants at the top and flares outward. */
function ps5PlateGeometry(side) {
  const W = 2.72;
  const H = 3.96;
  const g = new THREE.BoxGeometry(W, H, 0.05, 32, 48, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let u = pos.getX(i) / (W / 2);
    let v = pos.getY(i) / (H / 2);
    // round the outline: push the square onto a superellipse
    const f = Math.abs(u) ** 9 + Math.abs(v) ** 9;
    if (f > 1) {
      const k = f ** (-1 / 9);
      u *= k;
      v *= k;
    }
    let x = (u * W) / 2;
    let y = (v * H) / 2;
    x *= 1 - 0.07 * smooth(0, -1, v); // a little narrower at the foot
    y += 0.17 * u * smooth(0.1, 1, v); // the front corner sweeps up higher than the back
    // the collar: plates hug the core low down and flare away from it at the top
    let offset = 0.355 + 0.22 * Math.max(0, v) ** 2.4 + 0.045 * u * u;
    if (side > 0) offset += 0.075 * smooth(-0.02, -0.3, v) * (1 - smooth(-0.82, -1, v)); // disc drive bulge
    pos.setXYZ(i, x, y, pos.getZ(i) + side * offset);
  }
  g.computeVertexNormals();
  return g;
}

let ps5Geo = null;
function ps5Geometries() {
  ps5Geo ??= {
    plateL: ps5PlateGeometry(-1),
    plateR: ps5PlateGeometry(1),
    core: new RoundedBoxGeometry(2.44, 3.66, 0.62, 5, 0.16),
    stand: new THREE.CylinderGeometry(0.66, 0.72, 0.06, 56),
    ledTop: new THREE.BoxGeometry(2.2, 0.022, 0.026),
    ledFront: new THREE.BoxGeometry(0.026, 1.5, 0.026),
    usbA: new THREE.BoxGeometry(0.02, 0.13, 0.05),
    usbC: new THREE.BoxGeometry(0.02, 0.085, 0.03),
    slot: new THREE.BoxGeometry(0.02, 1.25, 0.022),
    button: new THREE.BoxGeometry(0.02, 0.2, 0.03),
    vent: new THREE.BoxGeometry(2.1, 0.02, 0.05),
  };
  return ps5Geo;
}

export function PS5({ powered }) {
  const c = theme.scene.consoles.ps5;
  const geo = ps5Geometries();
  const led = useLed(powered, c.standby, c.ready, { boot: c.on, boost: 2.6 });
  const plate = plastic(c.plate, { rough: 0.42 });
  const core = plastic(c.body, { rough: 0.22 }); // piano black, but not a mirror
  const port = plastic(c.port);
  const front = 1.222; // x of the glossy front edge
  return (
    <group>
      <mesh geometry={geo.core} material={core} />
      <mesh geometry={geo.plateL} material={plate} />
      <mesh geometry={geo.plateR} material={plate} />
      <mesh geometry={geo.stand} material={core} position={[0, -1.9, 0]} />

      {/* light strips in the gap between core and plates */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geo.ledTop} material={led} position={[0.05, 1.845, s * 0.33]} />
          <mesh geometry={geo.ledFront} material={led} position={[front - 0.01, 1.08, s * 0.33]} />
        </group>
      ))}
      {/* top vents */}
      {[-0.12, 0, 0.12].map((z) => (
        <mesh key={z} geometry={geo.vent} material={port} position={[0, 1.832, z]} />
      ))}
      {/* front edge: USB-A, USB-C, disc slot, power + eject */}
      <mesh geometry={geo.usbA} material={port} position={[front, -0.35, -0.06]} />
      <mesh geometry={geo.usbC} material={port} position={[front, -0.62, -0.06]} />
      <mesh geometry={geo.slot} material={port} position={[front, -0.95, 0.2]} />
      <mesh geometry={geo.button} material={port} position={[front, -1.5, -0.08]} />
      <mesh geometry={geo.button} material={port} position={[front, -1.5, 0.12]} scale={[1, 0.6, 1]} />
    </group>
  );
}

// ── PlayStation 4 ──────────────────────────────────────────────────────

const PS4_SLANT = 0.52; // the body leans: z shifts by this much per unit of height

/** A box whose vertices lean back with height (the PS4's parallelogram profile). */
function slantedBox(w, h, d, y = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i) + y;
    pos.setY(i, py);
    pos.setZ(i, pos.getZ(i) - py * PS4_SLANT);
  }
  g.computeVertexNormals();
  return g;
}

let ps4Geo = null;
function ps4Geometries() {
  const W = 2.75;
  const D = 3.05;
  const layer = 0.225;
  const gap = 0.08;
  const glossW = W * 0.34;
  ps4Geo ??= {
    bottom: slantedBox(W, layer, D, -(gap + layer) / 2),
    gap: slantedBox(W - 0.1, gap, D - 0.1, 0),
    topGloss: slantedBox(glossW, layer, D, (gap + layer) / 2).translate(-(W - glossW) / 2, 0, 0),
    topMatte: slantedBox(W - glossW - 0.03, layer, D, (gap + layer) / 2).translate((glossW + 0.03) / 2, 0, 0),
    // the light bar sits in the seam between the glossy and matte halves of the top
    bar: slantedBox(0.022, layer * 0.96, D * 0.985, (gap + layer) / 2).translate(-W / 2 + glossW + 0.004, 0.004, 0),
    usb: new THREE.BoxGeometry(0.13, 0.045, 0.03),
    slot: new THREE.BoxGeometry(1.2, 0.02, 0.03),
    glossX: -(W - glossW) / 2,
  };
  return ps4Geo;
}

export function PS4({ powered }) {
  const c = theme.scene.consoles.ps4;
  const geo = ps4Geometries();
  const led = useLed(powered, c.standby, c.ready, { boot: c.on, boost: 2.8 });
  const matte = plastic(c.matte, { rough: 0.62 });
  const gloss = plastic(c.gloss, { gloss: true });
  const port = plastic(c.port);
  const frontZ = 3.05 / 2 - 0.05; // front of the recessed gap
  return (
    <group>
      <mesh geometry={geo.bottom} material={matte} />
      <mesh geometry={geo.gap} material={plastic(c.gap, { gloss: true })} />
      <mesh geometry={geo.topGloss} material={gloss} />
      <mesh geometry={geo.topMatte} material={matte} />
      <mesh geometry={geo.bar} material={led} />
      {/* in the gap: disc slot on the left, two USB ports on the right */}
      <mesh geometry={geo.slot} material={port} position={[-0.55, 0, frontZ + 0.012]} />
      <mesh geometry={geo.usb} material={port} position={[0.75, 0, frontZ + 0.012]} />
      <mesh geometry={geo.usb} material={port} position={[1.0, 0, frontZ + 0.012]} />
    </group>
  );
}

// ── PlayStation 2 ──────────────────────────────────────────────────────

let ps2Geo = null;
function ps2Geometries() {
  ps2Geo ??= {
    lower: new RoundedBoxGeometry(2.9, 0.36, 1.72, 2, 0.02),
    upper: new RoundedBoxGeometry(3.01, 0.42, 1.82, 2, 0.02),
    ridgeTop: new THREE.BoxGeometry(0.07, 0.028, 1.82),
    ridgeFront: new THREE.BoxGeometry(0.07, 0.42, 0.028),
    tray: new THREE.BoxGeometry(1.34, 0.15, 0.02),
    port: new THREE.BoxGeometry(0.44, 0.13, 0.02),
    card: new THREE.BoxGeometry(0.44, 0.06, 0.02),
    logo: new THREE.BoxGeometry(0.2, 0.15, 0.022),
    dot: new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20).rotateX(Math.PI / 2),
    usb: new THREE.BoxGeometry(0.12, 0.045, 0.02),
  };
  return ps2Geo;
}

const PS2_RIDGES = Array.from({ length: 13 }, (_, i) => -1.4 + i * 0.145);

export function PS2({ powered }) {
  const c = theme.scene.consoles.ps2;
  const geo = ps2Geometries();
  const power = useLed(powered, c.standby, c.on, { boost: 2.6 });
  const eject = useLed(powered, c.port, c.eject, { boost: 2.6 });
  const logo = useLed(powered, c.logo, c.logo, { boost: 1.8 });
  const body = plastic(c.body, { rough: 0.5 });
  const tray = plastic(c.tray, { rough: 0.35 });
  const port = plastic(c.port, { rough: 0.7 });
  const z = 0.86 + 0.012; // front face of the lower section
  return (
    <group>
      <mesh geometry={geo.lower} material={body} position={[0, -0.2, 0]} />
      <mesh geometry={geo.upper} material={body} position={[0, 0.19, 0]} />
      {/* the ridges that wrap over the top and down the front */}
      {PS2_RIDGES.map((x) => (
        <group key={x}>
          <mesh geometry={geo.ridgeTop} material={body} position={[x, 0.41, 0]} />
          <mesh geometry={geo.ridgeFront} material={body} position={[x, 0.19, 0.918]} />
        </group>
      ))}
      {/* disc tray with the blue logo tile at its end */}
      <mesh geometry={geo.tray} material={tray} position={[-0.72, -0.12, z]} />
      <mesh geometry={geo.logo} material={logo} position={[0.07, -0.12, z]} />
      {/* two controller ports, each with a memory card slot above it */}
      {[0.5, 1.0].map((x) => (
        <group key={x}>
          <mesh geometry={geo.card} material={port} position={[x, -0.1, z]} />
          <mesh geometry={geo.port} material={port} position={[x, -0.26, z]} />
        </group>
      ))}
      <mesh geometry={geo.usb} material={port} position={[-0.2, -0.3, z]} />
      <mesh geometry={geo.usb} material={port} position={[-0.45, -0.3, z]} />
      {/* reset (power light) and eject */}
      <mesh geometry={geo.dot} material={power} position={[1.36, -0.1, z]} />
      <mesh geometry={geo.dot} material={eject} position={[1.36, -0.26, z]} />
    </group>
  );
}

/**
 * What the showcase needs to frame each model: `scale` to a common visual size,
 * `tilt` so flat consoles show their top, `yaw` for the most recognisable angle.
 */
export const CONSOLE_MODELS = Object.freeze({
  PS5: { Model: PS5, scale: 0.86, tilt: 0.04, yaw: -0.98, lift: 0.1 },
  PS4: { Model: PS4, scale: 1.12, tilt: 0.42, yaw: -0.5, lift: 0 },
  PS2: { Model: PS2, scale: 1.08, tilt: 0.36, yaw: -0.45, lift: 0 },
});
