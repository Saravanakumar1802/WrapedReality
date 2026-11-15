import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { CASE, presentCase } from "@/lib/layout.js";
import GameCase from "@/components/three/objects/GameCase.jsx";
import CompileGate from "@/components/three/canvas/CompileGate.jsx";
import { sfx } from "@/lib/sound.js";
import { PULL } from "./ShelfCases.jsx";

/** How far in front of the camera a pulled-out case floats (scene units). */
export const PRESENT_DISTANCE = 3.4;
/** Apparent width of an open case, in case widths (lid + tray + perspective on the leaning lid). */
const OPEN_SPREAD = 2.55;
/** The open lid sits nearer the camera than the tray, so nudge the pair right to look centred. */
const OPEN_SHIFT = 0.16;
const SLOT_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
const tmp = {
  dir: new THREE.Vector3(),
  right: new THREE.Vector3(),
  up: new THREE.Vector3(),
  front: new THREE.Vector3(),
  slot: new THREE.Vector3(),
  look: new THREE.Object3D(),
};

/**
 * One case travelling between its slot and the presentation spot.
 *
 * Flight is a single number `t` (0 = in its slot, 1 = presented) tweened by GSAP.
 * The presentation spot is recomputed every frame from the camera and the space
 * the details panel leaves free, so the case stays centred and fully visible when
 * the panel grows, the phone rotates, or the case opens (an open case is twice as
 * wide). Reversing mid-flight just tweens `t` the other way, from wherever it is.
 *
 * @param {{ game: any, slot: { position: number[] }, mode: "out" | "back", stage: "closed" | "open" | "inspect",
 *   insetsRef: { current: { right: number, bottom: number } }, reduced: boolean,
 *   onReturned: (slug: string) => void, onCaseClick?: () => void, onDiscClick?: () => void, discRef?: any, gate?: boolean }} props
 *   `gate`: the case's shaders may not be compiled yet (warm-up still running): show it once they are,
 *   rather than freezing the page while they compile.
 */
export default function CaseFlyer({
  game,
  slot,
  mode,
  stage,
  insetsRef,
  reduced,
  onReturned,
  onCaseClick,
  onDiscClick,
  discRef,
  gate = false,
}) {
  const group = useRef(/** @type {THREE.Group | null} */ (null));
  const flight = useRef({ t: 0, scale: 1, open: 0 });
  const { camera, size } = useThree();

  useEffect(() => {
    const out = mode === "out";
    if (out) sfx.slide();
    const tween = gsap.to(flight.current, {
      t: out ? 1 : 0,
      duration: reduced ? 0 : out ? 0.9 : 0.6,
      ease: out ? "expo.out" : "power2.inOut",
      onComplete: () => !out && onReturned(game.slug),
    });
    return () => {
      tween.kill();
    };
  }, [mode, reduced, game.slug, onReturned]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const f = flight.current;
    const cam = /** @type {THREE.PerspectiveCamera} */ (camera);
    const open = stage !== "closed";
    const ease = reduced ? 1 : Math.min(1, dt * 6);
    f.open += ((open ? 1 : 0) - f.open) * ease;
    const frame = presentCase({
      distance: PRESENT_DISTANCE,
      fov: cam.fov,
      aspect: size.width / Math.max(1, size.height),
      insets: insetsRef.current,
      // open: the lid swings out to 165° and leans toward the camera, so it reads wider than 2×
      width: open ? CASE.width * OPEN_SPREAD : CASE.width,
      height: CASE.height,
    });
    // the fit eases too, so opening the case is a smooth zoom-out, never a jump
    f.scale += (frame.scale - f.scale) * ease;

    cam.getWorldDirection(tmp.dir);
    tmp.right.crossVectors(tmp.dir, cam.up).normalize();
    tmp.up.crossVectors(tmp.right, tmp.dir).normalize();
    tmp.front
      .copy(cam.position)
      .addScaledVector(tmp.dir, PRESENT_DISTANCE)
      .addScaledVector(tmp.right, frame.x + OPEN_SHIFT * f.open * f.scale)
      .addScaledVector(tmp.up, frame.y);
    tmp.look.position.copy(tmp.front);
    tmp.look.lookAt(cam.position);

    const [x, y, z] = slot.position;
    tmp.slot.set(x, y, z + PULL);
    g.position.lerpVectors(tmp.slot, tmp.front, f.t);
    g.position.z += Math.sin(f.t * Math.PI) * 0.35; // arc out so it clears its neighbours
    g.quaternion.slerpQuaternions(SLOT_QUAT, tmp.look.quaternion, f.t);
    g.scale.setScalar(THREE.MathUtils.lerp(1, f.scale, f.t));
  });

  return (
    <group ref={group} position={[slot.position[0], slot.position[1], slot.position[2] + PULL]} quaternion={SLOT_QUAT}>
      {gate ? (
        <CompileGate>
          <GameCase game={game} stage={stage} onCaseClick={onCaseClick} onDiscClick={onDiscClick} discRef={discRef} />
        </CompileGate>
      ) : (
        <GameCase game={game} stage={stage} onCaseClick={onCaseClick} onDiscClick={onDiscClick} discRef={discRef} />
      )}
    </group>
  );
}
