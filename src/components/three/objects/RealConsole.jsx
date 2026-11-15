/**
 * A downloaded console / laptop model (public/models/*.glb, built by `npm run models`).
 *
 * The file is centred and scaled from the bounds measured at build time, so any
 * source model lands on the stage at the same size. Some materials are brought
 * to life by name:
 *   - status lights (the PS5's blue strip) glow when the machine is powered on
 *   - RGB zones (the ROG laptop's light bar and key legends) run a rainbow wave,
 *     dim while off and at full brightness when on, like Aura Sync's "rainbow" effect
 *   - screens show an image (`view.screen`) that fades up when powered on
 * Every model also gets a soft light behind it in the machine's colour
 * (cycling through the rainbow for RGB machines).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { theme } from "@/theme";

const LIGHT_MATERIAL = /translucent_glossy_blue|indikator|\bled\b/i;
const RGB_MATERIAL = /lightbar|rgb/i;
const SCREEN_MATERIAL = /^layar$|screen|display/i;

const RGB_IDLE = 0.35; // RGB brightness while the machine is off
const RGB_SPEED = 0.11; // rainbow cycles per second

export const preloadConsoleModel = (url) => useGLTF.preload(url, false, true);

/** Rainbow wave across the material's own surface (local position → hue, shifted over time). */
function makeRgb(material, uniforms) {
  material.toneMapped = false;
  material.emissive = new THREE.Color(0xffffff);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRgbPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRgbPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vRgbPos;
        uniform float uRgbTime;
        uniform float uRgbLevel;
        vec3 rgbHue(float h) {
          return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rgbH = fract((vRgbPos.x * 0.32 - vRgbPos.z * 0.12) - uRgbTime);
        totalEmissiveRadiance = mix(vec3(1.0), rgbHue(rgbH), 0.88) * uRgbLevel * 2.4;`,
      );
  };
  material.customProgramCacheKey = () => "rgb-wave";
  material.needsUpdate = true;
}

/** Draws `src` into a 16:10 canvas (cover crop) and returns it as a texture for a glTF screen. */
function screenTexture(src) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 800;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true; // this screen's UVs run bottom-up (checked against the source image)
  texture.anisotropy = 8;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) * 0.4, w, h);
    // panel vignette, like a real display seen slightly off-axis
    const g = ctx.createRadialGradient(640, 400, 200, 640, 400, 760);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    texture.needsUpdate = true;
  };
  img.src = src;
  return texture;
}

/** @param {{ info: { url: string, bounds: { min: number[], max: number[] }, view: { size: number, rotation: number[], screen?: string } }, powered: boolean, color: string, rgb?: boolean }} props */
export default function RealConsole({ info, powered, color, rgb = false }) {
  const { scene } = useGLTF(info.url, false, true); // meshopt-compressed, no Draco

  const { offset, scale } = useMemo(() => {
    const { min, max } = info.bounds;
    const size = max.map((v, i) => v - min[i]);
    return { offset: min.map((v, i) => -(v + size[i] / 2)), scale: info.view.size / Math.max(...size) };
  }, [info]);

  const uniforms = useMemo(() => ({ uRgbTime: { value: 0 }, uRgbLevel: { value: RGB_IDLE } }), []);
  const screenMap = useMemo(() => (info.view.screen ? screenTexture(info.view.screen) : null), [info.view.screen]);
  useEffect(() => () => screenMap?.dispose(), [screenMap]);

  // Sort the model's materials into lights / RGB zones / screens, once.
  const parts = useMemo(() => {
    const found = { lights: new Set(), rgb: new Set(), screens: new Set() };
    scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const name = m.name ?? "";
        if (RGB_MATERIAL.test(name)) found.rgb.add(m);
        else if (SCREEN_MATERIAL.test(name)) found.screens.add(m);
        else if (LIGHT_MATERIAL.test(name)) found.lights.add(m);
      }
    });
    const on = new THREE.Color(color);
    for (const m of found.lights) {
      m.toneMapped = false;
      m.emissive = on.clone();
      m.emissiveIntensity = 0;
    }
    for (const m of found.rgb) makeRgb(m, uniforms);
    for (const m of found.screens) {
      m.color = new THREE.Color(0x000000);
      m.metalness = 0;
      m.roughness = 0.55; // matte-ish panel: soft reflections, no hot spot from the stage lights
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveMap = screenMap;
      m.emissiveIntensity = 0;
      m.toneMapped = true;
      m.needsUpdate = true;
    }
    return { lights: [...found.lights], screens: [...found.screens] };
  }, [scene, color, uniforms, screenMap]);

  const level = useRef(0);
  const back = useRef(/** @type {THREE.PointLight | null} */ (null));
  const glow = useMemo(() => new THREE.Color(color), [color]);
  useFrame((state, dt) => {
    level.current += ((powered ? 1 : 0) - level.current) * (1 - Math.exp(-dt * 3.5));
    const v = level.current;
    for (const m of parts.lights) m.emissiveIntensity = v * 3.2;
    for (const m of parts.screens) m.emissiveIntensity = v * 1.15;
    uniforms.uRgbTime.value = state.clock.elapsedTime * RGB_SPEED;
    uniforms.uRgbLevel.value = RGB_IDLE + (1 - RGB_IDLE) * v;
    if (back.current) {
      if (rgb) back.current.color.setHSL((state.clock.elapsedTime * RGB_SPEED) % 1, 0.9, 0.55);
      back.current.intensity = rgb ? 2 + v * 5 : v * 26; // RGB under-glow: a hint on the pedestal, not a floodlight
    }
  });

  const r = info.view.rotation;
  return (
    <group rotation={[r[0], r[1], r[2]]} scale={scale}>
      <primitive object={scene} position={offset} />
      {/* glow under the machine, lighting the pedestal (position is in model space, so it is divided by the scale) */}
      <pointLight
        ref={back}
        color={glow}
        intensity={0}
        distance={rgb ? 3.2 : 7}
        decay={rgb ? 2 : 1.4}
        position={[0, -1.1 / scale, 0.4 / scale]}
      />
    </group>
  );
}

/** Theme colour for a machine's "on" light. */
export const consoleOnColor = (platform) => theme.scene.consoles[platform.toLowerCase()]?.on ?? theme.colors.accent;
