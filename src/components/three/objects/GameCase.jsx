import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CASE } from "@/lib/layout.js";
import { prefersReducedMotion } from "@/lib/env.js";
import { CORNER, LID_THICKNESS, TRAY_DEPTH, getCaseGeometries } from "@/components/three/geometry/caseGeometry.js";
import { hubMaterial, shellInnerMaterial, shellMaterial, sleeveMaterial } from "@/components/three/materials/materials.js";
import { useCaseTextures } from "@/components/three/art/textures.js";
import Disc from "./Disc.jsx";
import { sfx } from "@/lib/sound.js";

const W = CASE.width;
const H = CASE.height;
const Z_BACK = -CASE.depth / 2;
const Z_FLOOR = Z_BACK + 0.004;
const Z_LID = Z_BACK + TRAY_DEPTH + 0.008; // hinge plane (clears the tray bevel)
const LID_OPEN = -2.88; // ≈ 165°
const DISC_REST = { x: 0, y: -0.02, z: Z_FLOOR + 0.022 };
const DISC_INSPECT = { x: 0, y: 0.06, z: 0.95 };

/**
 * A detailed PS4/PS5-style case. Stages: "closed" → "open" → "inspect".
 * Placement (position/rotation of the whole case) is controlled by the parent.
 *
 * @param {{ game: any, stage: "closed" | "open" | "inspect", takeaway?: string,
 *   onCaseClick?: () => void, onDiscClick?: () => void, discRef?: any }} props
 */
export default function GameCase({ game, stage, takeaway = "", onCaseClick, onDiscClick, discRef }) {
  const geo = getCaseGeometries();
  const tex = useCaseTextures(game, takeaway);
  const body = useRef(null);
  const lid = useRef(null);
  const disc = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const d = (s) => (reduced || first.current ? 0 : s);
    const tl = gsap.timeline({ defaults: { ease: "power3.inOut" } });
    const open = stage !== "closed";
    if (!first.current) (open ? sfx.open : sfx.back)();
    tl.to(lid.current.rotation, { y: open ? LID_OPEN : 0, duration: d(1.05) }, 0);
    tl.to(body.current.position, { x: open ? W / 2 : 0, duration: d(1.05) }, 0);
    if (stage === "inspect") {
      if (!first.current) sfx.disc();
      tl.to(disc.current.position, { ...DISC_INSPECT, duration: d(0.9), ease: "expo.out" }, d(0.15));
      tl.to(disc.current.rotation, { x: -0.18, duration: d(0.9), ease: "expo.out" }, d(0.15));
    } else {
      tl.to(disc.current.position, { ...DISC_REST, duration: d(0.6) }, 0);
      tl.to(disc.current.rotation, { x: 0, duration: d(0.6) }, 0);
      discRef?.current?.reset();
    }
    first.current = false;
    return () => {
      tl.kill();
    };
  }, [stage, discRef]);

  const pointer = (on) => (e) => {
    e.stopPropagation();
    document.body.style.cursor = on ? "pointer" : "";
  };
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  const handleCase = (e) => {
    e.stopPropagation();
    if (e.delta > 6) return; // that was the end of a drag (spinning the case), not a click
    onCaseClick?.();
  };
  const handleDisc = (e) => {
    if (stage === "inspect") return; // rotation handles input
    e.stopPropagation();
    onDiscClick?.();
  };

  const shell = shellMaterial(game.platform);
  const inner = shellInnerMaterial(game.platform);

  return (
    <group ref={body}>
      {/* ── Tray (back half) ─────────────────────────────── */}
      <group onClick={handleCase} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
        <mesh geometry={geo.trayFrame} material={shell} castShadow />
        <mesh geometry={geo.floor} material={inner} position-z={Z_FLOOR} />
        <mesh geometry={geo.floor} material={shell} position-z={Z_BACK - 0.003} rotation-y={Math.PI} />
        {tex && (
          <mesh geometry={geo.artPlane} position-z={Z_BACK - 0.0045} rotation-y={Math.PI}>
            <meshStandardMaterial map={tex.back} roughness={0.5} />
          </mesh>
        )}
        <mesh geometry={geo.sleevePlane} material={sleeveMaterial()} position-z={Z_BACK - 0.0055} rotation-y={Math.PI} />
        {/* spine (hinge side) */}
        {tex && (
          <mesh geometry={geo.spinePlane} position={[-W / 2 - 0.0048, 0, Z_BACK + CASE.depth / 2]} rotation-y={-Math.PI / 2}>
            <meshStandardMaterial map={tex.spine} roughness={0.45} />
          </mesh>
        )}
        {/* disc well + centre hub with 12 petal clips */}
        <mesh geometry={geo.discWell} material={hubMaterial(game.platform)} position={[DISC_REST.x, DISC_REST.y, Z_FLOOR + 0.001]} />
        <group position={[DISC_REST.x, DISC_REST.y, Z_FLOOR + 0.013]}>
          <mesh geometry={geo.hub} material={hubMaterial(game.platform)} />
          <mesh geometry={geo.hubRing} material={hubMaterial(game.platform)} position-z={-0.004} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <mesh
                key={i}
                geometry={geo.petal}
                material={shell}
                position={[Math.cos(a) * 0.052, Math.sin(a) * 0.052, 0.006]}
                rotation-z={a + Math.PI / 2}
              />
            );
          })}
        </group>
      </group>

      {/* ── Disc ─────────────────────────────────────────── */}
      <group ref={disc} position={[DISC_REST.x, DISC_REST.y, DISC_REST.z]}>
        <Disc
          ref={discRef}
          label={tex?.label ?? null}
          rotatable={stage === "inspect"}
          onClick={handleDisc}
          onPointerOver={stage === "open" ? pointer(true) : undefined}
          onPointerOut={stage === "open" ? pointer(false) : undefined}
        />
      </group>

      {/* ── Lid (front cover), pivoting on the spine hinge ───────── */}
      <group ref={lid} position={[-W / 2, 0, Z_LID]}>
        <group onClick={handleCase} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
          <mesh geometry={geo.lid} material={shell} castShadow />
          {tex && (
            <mesh geometry={geo.artPlane} position={[W / 2, 0, LID_THICKNESS + 0.0042]}>
              <meshStandardMaterial map={tex.cover} roughness={0.42} />
            </mesh>
          )}
          <mesh geometry={geo.sleevePlane} material={sleeveMaterial()} position={[W / 2, 0, LID_THICKNESS + 0.0058]} />
          {/* inside of the lid: printed insert + manual clips */}
          {/* Distinct keys: reusing one <mesh> across branches makes R3F reset the removed
              `material` prop to a default white material, hiding the insert. */}
          {tex ? (
            <mesh key="insert" geometry={geo.artPlane} position={[W / 2, 0, -0.0042]} rotation-y={Math.PI}>
              <meshStandardMaterial map={tex.insert} roughness={0.6} />
            </mesh>
          ) : (
            <mesh key="insert-blank" geometry={geo.floor} material={inner} position={[W / 2, 0, -0.004]} rotation-y={Math.PI} />
          )}
          {/* PS4 keep cases have manual clips inside the lid; PS5 cases don't */}
          {game.platform === "PS4" && (
            <>
              <mesh geometry={geo.clip} material={shell} position={[W / 2, H / 2 - 0.05, -0.012]} />
              <mesh geometry={geo.clip} material={shell} position={[W / 2, -H / 2 + 0.05, -0.012]} />
            </>
          )}
        </group>
      </group>
    </group>
  );
}

export const CASE_CORNER = CORNER;
