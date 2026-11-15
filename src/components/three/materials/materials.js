/** Shared, theme-driven materials. Created lazily, one per platform/variant. */
import * as THREE from "three";
import { theme, platformTheme } from "@/theme";
import { rgba } from "@/lib/color.js";
import { mulberry32 } from "@/lib/math.js";

const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

/** Glossy case plastic. */
export const shellMaterial = (platform) =>
  memo(`shell:${platform}`, () => {
    const pt = platformTheme(platform);
    return new THREE.MeshPhysicalMaterial({
      color: pt.shell,
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
  });

export const shellInnerMaterial = (platform) =>
  memo(
    `inner:${platform}`,
    () => new THREE.MeshStandardMaterial({ color: platformTheme(platform).shellInner, roughness: 0.55, metalness: 0 }),
  );

/** Clear outer sleeve over the printed insert. Cheap: no transmission pass. */
export const sleeveMaterial = () =>
  memo(
    "sleeve",
    () =>
      new THREE.MeshPhysicalMaterial({
        color: theme.scene.sleeve.color,
        transparent: true,
        opacity: theme.scene.sleeve.opacity,
        roughness: 0.05,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        depthWrite: false,
      }),
  );

/**
 * Zones of a Blu-ray's data side, as fractions of the disc radius (60 mm):
 * spindle hole → clear hub → stacking ring → mirror band (etched codes) →
 * data area → clear outer rim.
 */
export const DISC_ZONES = Object.freeze({ hole: 0.125, hubEnd: 0.275, stack: 0.29, mirrorEnd: 0.375, dataEnd: 0.962 });

/** Paints the data side: zones, hairline grooves, and the etched mastering ring. */
function drawDiscData(size = 1024) {
  const d = theme.scene.disc;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const R = size / 2;
  const ring = (r0, r1, fill) => {
    ctx.beginPath();
    ctx.arc(R, R, r1 * R, 0, Math.PI * 2);
    ctx.arc(R, R, r0 * R, 0, Math.PI * 2, true);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const z = DISC_ZONES;
  ctx.fillStyle = d.dataSide;
  ctx.fillRect(0, 0, size, size);

  // data area: the recorded region is a shade darker than the unused outer part
  const data = ctx.createRadialGradient(R, R, z.mirrorEnd * R, R, R, z.dataEnd * R);
  data.addColorStop(0, rgba(d.etch, 0.38));
  data.addColorStop(0.78, rgba(d.etch, 0.3));
  data.addColorStop(0.785, rgba(d.mirror, 0.12));
  data.addColorStop(1, rgba(d.mirror, 0.2));
  ring(z.mirrorEnd, z.dataEnd, data);

  // hairline grooves so the surface is never a flat fill
  const rnd = mulberry32(120);
  for (let i = 0; i < 260; i++) {
    const r = z.mirrorEnd + rnd() * (z.dataEnd - z.mirrorEnd);
    ctx.beginPath();
    ctx.arc(R, R, r * R, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(rnd() > 0.5 ? d.mirror : d.etch, 0.05 + rnd() * 0.08);
    ctx.lineWidth = 0.6 + rnd();
    ctx.stroke();
  }

  ring(z.dataEnd, 1, d.clear); // clear outer rim
  ring(z.stack, z.mirrorEnd, d.mirror); // mirror band
  ring(z.hole, z.hubEnd, d.clear); // clear hub
  ring(z.hubEnd, z.stack, d.hub); // raised stacking ring
  for (const r of [z.hubEnd, z.stack, z.mirrorEnd, z.dataEnd]) {
    ctx.beginPath();
    ctx.arc(R, R, r * R, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(d.etch, 0.55);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // etched mastering text + barcode around the mirror band
  const midR = ((z.stack + z.mirrorEnd) / 2) * R;
  const etch = (text, startAngle) => {
    ctx.font = `600 ${Math.round(R * 0.03)}px ui-monospace, monospace`;
    ctx.fillStyle = d.etch;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let angle = startAngle;
    for (const ch of text) {
      const w = ctx.measureText(ch).width + R * 0.006;
      angle += w / 2 / midR;
      ctx.save();
      ctx.translate(R + Math.cos(angle) * midR, R + Math.sin(angle) * midR);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      angle += w / 2 / midR;
    }
  };
  etch("BD-ROM  50GB  DUAL LAYER", -Math.PI * 0.95);
  etch("MASTERED FOR PLAYSTATION", Math.PI * 0.05);
  // barcode: radial ticks of varying width
  for (let i = 0, ang = Math.PI * 0.62; i < 46; i++) {
    const w = (0.6 + rnd() * 2.2) / midR;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(R, R, midR, ang, ang + w);
      ctx.strokeStyle = d.etch;
      ctx.lineWidth = R * 0.05;
      ctx.stroke();
    }
    ang += w + 1 / midR;
  }
  return c;
}

/** GLSL: the anisotropic rainbow streak a disc's spiral track throws under a light. */
const DIFFRACTION = /* glsl */ `
  {
    vec3 dT = normalize(vDiscTangent);
    vec3 dV = normalize(vViewPosition);
    float dr = length(vMapUv - 0.5) * 2.0;
    float dBand = smoothstep(${DISC_ZONES.mirrorEnd.toFixed(3)}, ${(DISC_ZONES.mirrorEnd + 0.012).toFixed(3)}, dr)
      * (1.0 - smoothstep(${(DISC_ZONES.dataEnd - 0.012).toFixed(3)}, ${DISC_ZONES.dataEnd.toFixed(3)}, dr));
    vec3 dSum = vec3(0.0);
    // three fixed lamps (view space): overhead key, side fill, low kicker
    vec3 dL[3];
    dL[0] = normalize(vec3(0.25, 0.85, 0.5));
    dL[1] = normalize(vec3(-0.75, 0.2, 0.6));
    dL[2] = normalize(vec3(0.6, -0.5, 0.6));
    for (int i = 0; i < 3; i++) {
      vec3 dH = normalize(dL[i] + dV);
      float dAlong = abs(dot(dT, dH));          // 0 where the track runs across the half vector
      float dFace = max(0.0, dot(normal, dL[i]));
      float dCore = pow(1.0 - dAlong, 90.0);    // the white streak
      float dFan = pow(1.0 - dAlong, 14.0);     // the coloured fan either side of it
      // grating: colour depends on how far off the streak you are, and a little on radius
      vec3 dHue = 0.5 + 0.5 * cos(6.2831853 * (dAlong * 7.0 + dr * 0.6 + vec3(0.0, 0.33, 0.67)));
      // only the key lamp throws a full rainbow; the others add thin white glints
      float dKey = i == 0 ? 1.0 : 0.0;
      dSum += (vec3(dCore) * mix(0.45, 1.1, dKey) + dHue * dFan * 0.42 * dKey) * dFace;
    }
    // A mirror in a dark room shows nothing, so the printed zones (hub, mirror band,
    // etched codes) keep a floor of their own colour; the data area stays darker.
    outgoingLight += diffuseColor.rgb * mix(0.5, 0.2, dBand);
    outgoingLight += dSum * dBand;
  }
`;

/**
 * Data side of the disc, modelled on a real Blu-ray: a dark blue-violet mirror
 * with a clear hub, stacking ring, etched mirror band, and a diffraction
 * streak that fans into a rainbow and sweeps round as the disc turns.
 */
export const discDataMaterial = () =>
  memo("disc:data", () => {
    const d = theme.scene.disc;
    const map = new THREE.CanvasTexture(drawDiscData());
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const material = new THREE.MeshPhysicalMaterial({
      map,
      metalness: 1,
      roughness: 0.1,
      iridescence: d.iridescence,
      iridescenceIOR: d.iridescenceIOR,
      iridescenceThicknessMinimum: d.iridescenceThickness[0],
      iridescenceThicknessMaximum: d.iridescenceThickness[1],
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      side: THREE.FrontSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vDiscTangent;")
        // the track runs round the disc: its direction is perpendicular to the radius
        .replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\nvDiscTangent = normalMatrix * normalize(vec3(-position.y, position.x, 0.0));",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vDiscTangent;")
        .replace("#include <opaque_fragment>", DIFFRACTION + "\n#include <opaque_fragment>");
    };
    return material;
  });

export const discEdgeMaterial = () =>
  memo(
    "disc:edge",
    () => new THREE.MeshPhysicalMaterial({ color: theme.scene.disc.hub, metalness: 0.6, roughness: 0.2, side: THREE.DoubleSide }),
  );

/** Printed label side; map is set per disc, so this one is not shared. */
export function discLabelMaterial(map) {
  return new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.38,
    metalness: 0.1,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    iridescence: 0.25,
    iridescenceIOR: 1.5,
    transparent: true,
    alphaTest: 0.02,
  });
}

export const hubMaterial = (platform) =>
  memo(
    `hub:${platform}`,
    () => new THREE.MeshPhysicalMaterial({ color: platformTheme(platform).shellInner, roughness: 0.25, clearcoat: 0.8 }),
  );

/** A light source you can see. `boost` > 1 pushes it past white so bloom catches it. */
export const ledMaterial = (color, boost = 1) =>
  memo(`led:${color}:${boost}`, () => {
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    m.color.multiplyScalar(boost);
    return m;
  });
