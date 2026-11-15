import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import GameCase from "@/components/three/objects/GameCase.jsx";
import StudioLights from "@/components/three/canvas/StudioLights.jsx";
import { theme } from "@/theme";
import { prefersReducedMotion } from "@/lib/env.js";

export const CASE_CAMERA = { position: [0, 0.1, 4.6], fov: 35, near: 0.1, far: 50 };

const TURN = Math.PI * 2;

/**
 * Single-case stage (home hero + game page). The case floats and leans toward
 * the pointer; while it is closed you can grab it and spin it all the way round
 * (with inertia) to see the spine and back. A new game spins in with one full turn.
 * Stages are driven by the parent (closed → open → inspect).
 */
export default function CaseViewerScene({ game, stage, takeaway, onCaseClick, onDiscClick, discRef }) {
  const root = useRef(/** @type {import("three").Group | null} */ (null));
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  // Open case is twice as wide → shrink on narrow screens so it always fits.
  const closed = stage === "closed";
  const scale = aspect < 0.8 ? (closed ? 1.05 : 0.62) : aspect < 1.2 ? (closed ? 1.3 : 0.86) : closed ? 1.3 : 1;

  /** Free spin from dragging: `yaw` is where the hand left it, `v` the remaining momentum. */
  const spin = useRef({ yaw: 0, v: 0, id: -1, x: 0 });

  // A new game arrives with one full turn (skipped on the very first render and for reduced motion).
  const seen = useRef(/** @type {string | null} */ (null));
  useEffect(() => {
    const g = root.current;
    if (g && seen.current && seen.current !== game.slug && !reduced) g.rotation.y -= TURN;
    seen.current = game.slug;
    spin.current.yaw = 0;
    spin.current.v = 0;
  }, [game.slug, reduced]);

  // Window-level move/up so a drag keeps working when the pointer leaves the case.
  useEffect(() => {
    const move = (e) => {
      const s = spin.current;
      if (e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      s.x = e.clientX;
      s.v = dx * 0.012;
      s.yaw += s.v;
    };
    const up = (e) => {
      if (e.pointerId !== spin.current.id) return;
      spin.current.id = -1;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    const s = spin.current;
    const k = Math.min(1, dt * 4);
    const still = stage === "inspect" || reduced;
    if (s.id === -1) {
      // momentum after release, then (once it is open) settle back to face the camera
      s.yaw += s.v;
      s.v *= Math.pow(0.03, dt);
      if (!closed) s.yaw += (Math.round(s.yaw / TURN) * TURN - s.yaw) * k;
    }
    const sway = closed && s.id === -1 ? Math.sin(state.clock.elapsedTime * 0.5) * 0.12 + 0.18 : 0;
    const ry = (still ? 0 : state.pointer.x * 0.22 + sway) + s.yaw;
    const rx = still ? 0 : -state.pointer.y * 0.12;
    g.rotation.y += (ry - g.rotation.y) * k;
    g.rotation.x += (rx - g.rotation.x) * k;
    g.position.y = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.8) * 0.03;
    g.scale.setScalar(g.scale.x + (scale - g.scale.x) * k);
  });

  const grab = (e) => {
    if (!closed) return; // an open case is for clicking, not spinning
    spin.current.id = e.pointerId;
    spin.current.x = e.clientX;
    spin.current.v = 0;
    document.body.style.cursor = "grabbing";
  };

  return (
    <>
      <StudioLights envIntensity={1} />
      <group ref={root} onPointerDown={grab}>
        <GameCase game={game} stage={stage} takeaway={takeaway} onCaseClick={onCaseClick} onDiscClick={onDiscClick} discRef={discRef} />
      </group>
      <ContactShadows
        position={[0, -1.02, 0]}
        opacity={0.55}
        scale={6}
        blur={2.6}
        far={2}
        color={theme.colors.void}
        frames={reduced ? 1 : Infinity}
        resolution={256}
      />
    </>
  );
}
