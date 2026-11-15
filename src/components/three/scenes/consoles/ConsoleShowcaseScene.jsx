import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import StudioLights from "@/components/three/canvas/StudioLights.jsx";
import { CONSOLE_MODELS } from "@/components/three/objects/CodeConsoles.jsx";
import RealConsole, { consoleOnColor, preloadConsoleModel } from "@/components/three/objects/RealConsole.jsx";
import realModels from "@/data/generated/models.json";
import { theme } from "@/theme";
import { prefersReducedMotion } from "@/lib/env.js";

export const CONSOLE_CAMERA = { position: [0, 0.2, 9.4], fov: 35, near: 0.1, far: 60 };

/** Machines with RGB lighting: their pedestal ring cycles through the rainbow too. */
const RGB_MACHINES = new Set(["ROG"]);
const rainbow = new THREE.Color();

const SPACING = 9; // distance between consoles on the rail (off-screen when not active)

/**
 * The console turntable. One console is on stage at a time; the page scroll
 * (`motion.current.position`, 0..n-1, fractional while travelling) slides the
 * rail and spins each console through a half-turn as it arrives and leaves.
 * Dragging adds a free spin with inertia (`motion.current.yaw / pitch`), and
 * the model leans a little toward the pointer.
 *
 * @param {{ platforms: string[], power: Record<string, boolean>, accents: Record<string, string>,
 *   motion: { current: { position: number, yaw: number, pitch: number, dragging: boolean } },
 *   onToggle: (platform: string) => void, loadModels: boolean }} props
 *
 * `loadModels`: fetch the downloaded models (set once the section is near the
 * viewport, so they never compete with the hero for bandwidth). Until a model
 * has loaded, the code-built console stands in for it.
 */
export default function ConsoleShowcaseScene({ platforms, power, accents, motion, onToggle, loadModels }) {
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const wide = aspect > 1.15;
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const groups = useRef(/** @type {(THREE.Group | null)[]} */ ([]));
  const ring = useRef(/** @type {THREE.Group | null} */ (null));
  const ringMat = useRef(/** @type {THREE.MeshBasicMaterial | null} */ (null));
  const glow = useRef(/** @type {THREE.MeshBasicMaterial | null} */ (null));
  const eased = useRef({ position: 0, yaw: 0, pitch: 0, px: 0, py: 0 });
  useEffect(() => {
    if (!loadModels) return;
    for (const p of platforms) if (realModels[p]) preloadConsoleModel(realModels[p].url);
  }, [loadModels, platforms]);

  /** How each console sits on the stage: the downloaded model's own framing, or the code-built one's. */
  const frames = useMemo(
    () =>
      Object.fromEntries(
        platforms.map((p) => {
          const real = loadModels && realModels[p];
          const cfg = CONSOLE_MODELS[p] ?? { scale: 1, tilt: 0, yaw: 0, lift: 0 };
          return [p, real ? { scale: 1, tilt: real.view.tilt, yaw: real.view.yaw, lift: real.view.lift } : cfg];
        }),
      ),
    [platforms, loadModels],
  );

  const accentColors = useMemo(() => platforms.map((p) => new THREE.Color(accents[p] ?? theme.colors.accent)), [platforms, accents]);

  // On wide screens the console stands to the right of the copy; on phones it is centred above it.
  const anchor = wide ? [aspect * 1.25, -0.1] : [0, 1.0];
  const fit = wide ? 1 : Math.min(0.9, aspect * 1.05);

  useFrame((state, dt) => {
    const m = motion.current;
    const e = eased.current;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
    e.position += (m.position - e.position) * k;
    e.yaw += (m.yaw - e.yaw) * k;
    e.pitch += (m.pitch - e.pitch) * k;
    e.px += (state.pointer.x - e.px) * k * 0.5;
    e.py += (state.pointer.y - e.py) * k * 0.5;
    const t = state.clock.elapsedTime;

    platforms.forEach((p, i) => {
      const g = groups.current[i];
      if (!g) return;
      const cfg = frames[p];
      const off = i - e.position; // 0 = on stage
      g.visible = Math.abs(off) < 0.98;
      if (!g.visible) return;
      const idle = reduced || m.dragging ? 0 : Math.sin(t * 0.4 + i) * 0.14;
      g.position.set(anchor[0] + off * SPACING, anchor[1] + cfg.lift + (reduced ? 0 : Math.sin(t * 0.9 + i) * 0.05), -Math.abs(off) * 2.5);
      g.rotation.set(cfg.tilt + e.pitch - e.py * 0.1, cfg.yaw + e.yaw + idle + off * Math.PI + e.px * 0.22, 0);
      g.scale.setScalar(cfg.scale * fit * (1 - Math.abs(off) * 0.25));
    });

    // the pedestal ring takes the colour of the console on stage
    const a = Math.min(platforms.length - 1, Math.max(0, Math.round(e.position)));
    if (ring.current && ringMat.current && glow.current) {
      const target = RGB_MACHINES.has(platforms[a]) ? rainbow.setHSL((t * 0.11) % 1, 0.9, 0.6) : accentColors[a];
      ringMat.current.color.lerp(target, k * 0.5);
      glow.current.color.lerp(target, k * 0.5);
      ring.current.rotation.z = t * 0.15;
      ring.current.position.set(anchor[0], anchor[1] - 1.82 * fit, 0);
      ring.current.scale.setScalar(fit * 0.82);
    }
  });

  return (
    <>
      <StudioLights envIntensity={1.1} direct={0.8} />
      {/* showroom fill from the camera side, so white plastic reads as white */}
      <directionalLight color={theme.scene.key.color} intensity={2.6} position={[-2.5, 3.5, 9]} />
      <pointLight color={theme.scene.key.color} intensity={30} distance={14} position={[anchor[0] + 2, 3, 6]} />
      {platforms.map((p, i) => {
        const Model = CONSOLE_MODELS[p]?.Model;
        const real = loadModels && realModels[p];
        // machines with no code-built stand-in (the laptop) show nothing until their file arrives
        const fallback = Model ? <Model powered={Boolean(power[p])} /> : null;
        return (
          <group
            key={p}
            ref={(el) => (groups.current[i] = el)}
            visible={i === 0}
            onClick={(e) => {
              e.stopPropagation();
              if (e.delta < 6) onToggle(p); // a click, not the end of a drag
            }}
            onPointerOver={() => (document.body.style.cursor = "grab")}
            onPointerOut={() => (document.body.style.cursor = "")}
          >
            {real ? (
              <Suspense fallback={fallback}>
                <RealConsole info={real} powered={Boolean(power[p])} color={consoleOnColor(p)} rgb={RGB_MACHINES.has(p)} />
              </Suspense>
            ) : (
              fallback
            )}
          </group>
        );
      })}

      {/* pedestal: a thin light ring with a soft pool inside it, lying flat under the console */}
      <group ref={ring} rotation-x={-Math.PI / 2 + 0.2}>
        <mesh>
          <torusGeometry args={[2.3, 0.012, 8, 120]} />
          <meshBasicMaterial ref={ringMat} color={theme.colors.accent} toneMapped={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[1.7, 1.74, 96]} />
          <meshBasicMaterial color={theme.colors.text} transparent opacity={0.25} toneMapped={false} />
        </mesh>
        <mesh position-z={-0.02}>
          <circleGeometry args={[2.3, 64]} />
          <meshBasicMaterial
            ref={glow}
            color={theme.colors.accent}
            transparent
            opacity={0.07}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </>
  );
}
