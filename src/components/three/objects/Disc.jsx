import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { DISC, getCaseGeometries } from "@/components/three/geometry/caseGeometry.js";
import { discDataMaterial, discEdgeMaterial, discLabelMaterial } from "@/components/three/materials/materials.js";
import { prefersReducedMotion } from "@/lib/env.js";

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const tmpQ = new THREE.Quaternion();

/**
 * A Ø120 mm disc: printed label (front, +z), iridescent data side (back), clear rims.
 * - `rotatable`: drag to rotate with inertia; double-click flips it.
 * - `idleSpin`: slow spin around its own axis when not being dragged (rad/s).
 * Exposes { flip(), reset() } via ref.
 */
const Disc = forwardRef(function Disc({ label, rotatable = false, idleSpin = 0, onClick, onPointerOver, onPointerOut }, ref) {
  const geo = getCaseGeometries();
  const spin = useRef(/** @type {THREE.Group | null} */ (null));
  const drag = useRef({ active: false, x: 0, y: 0, vx: 0, vy: 0, id: -1 });
  const reduced = useMemo(() => prefersReducedMotion(), []);

  const labelMat = useMemo(() => (label ? discLabelMaterial(label) : null), [label]);
  useEffect(() => () => labelMat?.dispose(), [labelMat]);

  const api = useMemo(
    () => ({
      flip() {
        if (!spin.current) return;
        const proxy = { a: 0 };
        let last = 0;
        gsap.to(proxy, {
          a: Math.PI,
          duration: reduced ? 0 : 0.9,
          ease: "power3.inOut",
          onUpdate: () => {
            tmpQ.setFromAxisAngle(AXIS_Y, proxy.a - last);
            spin.current?.quaternion.premultiply(tmpQ);
            last = proxy.a;
          },
        });
      },
      reset() {
        if (!spin.current) return;
        const from = spin.current.quaternion.clone();
        const to = new THREE.Quaternion();
        const proxy = { t: 0 };
        drag.current.vx = drag.current.vy = 0;
        gsap.to(proxy, {
          t: 1,
          duration: reduced ? 0 : 0.7,
          ease: "power3.out",
          onUpdate: () => spin.current?.quaternion.slerpQuaternions(from, to, proxy.t),
        });
      },
    }),
    [reduced],
  );
  useImperativeHandle(ref, () => api, [api]);

  // Window-level move/up so a drag keeps working outside the disc.
  useEffect(() => {
    if (!rotatable) return;
    const move = (e) => {
      const d = drag.current;
      if (!d.active || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.vx = dx * 0.0085;
      d.vy = dy * 0.0085;
      tmpQ.setFromAxisAngle(AXIS_Y, d.vx);
      spin.current?.quaternion.premultiply(tmpQ);
      tmpQ.setFromAxisAngle(AXIS_X, d.vy);
      spin.current?.quaternion.premultiply(tmpQ);
    };
    const up = (e) => {
      if (e.pointerId === drag.current.id) {
        drag.current.active = false;
        document.body.style.cursor = "";
      }
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      drag.current.active = false;
      document.body.style.cursor = "";
    };
  }, [rotatable]);

  useFrame((_, dt) => {
    const g = spin.current;
    if (!g) return;
    const d = drag.current;
    if (!d.active && (Math.abs(d.vx) > 1e-4 || Math.abs(d.vy) > 1e-4)) {
      // inertia with frame-rate independent damping
      const damp = Math.pow(0.04, dt);
      d.vx *= damp;
      d.vy *= damp;
      tmpQ.setFromAxisAngle(AXIS_Y, d.vx);
      g.quaternion.premultiply(tmpQ);
      tmpQ.setFromAxisAngle(AXIS_X, d.vy);
      g.quaternion.premultiply(tmpQ);
    }
    if (idleSpin && !d.active && !reduced) {
      tmpQ.setFromAxisAngle(AXIS_Z, idleSpin * Math.min(dt, 0.05));
      g.quaternion.multiply(tmpQ);
    }
  });

  const onDown = rotatable
    ? (e) => {
        e.stopPropagation();
        drag.current = { active: true, x: e.clientX, y: e.clientY, vx: 0, vy: 0, id: e.pointerId };
        document.body.style.cursor = "grabbing";
      }
    : undefined;

  const t = DISC.thickness / 2;
  return (
    <group
      ref={spin}
      onPointerDown={onDown}
      onDoubleClick={
        rotatable
          ? (e) => {
              e.stopPropagation();
              api.flip();
            }
          : undefined
      }
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {labelMat ? (
        <mesh key="label" geometry={geo.discFace} material={labelMat} position-z={t + 0.0005} />
      ) : (
        <mesh key="label-blank" geometry={geo.discFace} material={discEdgeMaterial()} position-z={t + 0.0005} />
      )}
      <mesh geometry={geo.discFace} material={discDataMaterial()} position-z={-t - 0.0005} rotation-y={Math.PI} />
      <mesh geometry={geo.discEdge} material={discEdgeMaterial()} />
      <mesh geometry={geo.discInnerEdge} material={discEdgeMaterial()} />
    </group>
  );
});

export default Disc;
