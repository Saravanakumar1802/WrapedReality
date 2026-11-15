import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { CASE } from "@/lib/layout.js";
import { theme } from "@/theme";

/** Rows you are not looking at keep a faint glow. */
const ROW_LIGHT_FLOOR = 0.1;
/** Light sets: rows alternate between them, so two cover any camera position. */
const SETS = 2;

// Area lights need their lookup tables registered once before first render.
RectAreaLightUniformsLib.init();

/** How much the camera is looking at row `index` (1 = framed, 0 = a row or more away). */
export function rowFocus(progress, rowCount, index) {
  const at = progress * Math.max(0, rowCount - 1);
  return Math.max(0, 1 - Math.abs(at - index) * 1.6);
}

/** Dimmer-style easing: switching on is a touch slower than switching off. */
function easeLevel(current, target, dt, reduced) {
  if (reduced) return target;
  const speed = target > current ? 2.4 : 4;
  return current + (target - current) * (1 - Math.exp(-dt * speed));
}

/**
 * One row's LED strip: a diffused strip under the board above plus its soft
 * halo. It brightens as the camera arrives (bloom catches it) and keeps a faint
 * glow otherwise. Purely emissive: it adds no light to the scene's shaders.
 */
export function RowStrip({ index, rowCount, camRef, reduced, y, front, width }) {
  const s = theme.scene.shelf;
  const level = useRef(0);
  const strip = useMemo(() => new THREE.MeshBasicMaterial({ color: s.lamp, toneMapped: false }), [s.lamp]);
  const diffuser = useMemo(
    () => new THREE.MeshBasicMaterial({ color: s.lamp, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }),
    [s.lamp],
  );
  useEffect(() => () => [strip, diffuser].forEach((m) => m.dispose()), [strip, diffuser]);
  const lampColor = useMemo(() => new THREE.Color(s.lamp), [s.lamp]);

  useFrame((_, dt) => {
    const target = ROW_LIGHT_FLOOR + (1 - ROW_LIGHT_FLOOR) * rowFocus(camRef.current?.progress ?? 0, rowCount, index);
    level.current = easeLevel(level.current, target, dt, reduced);
    const v = level.current;
    strip.color.copy(lampColor).multiplyScalar(0.25 + v * 2.6); // > 1 when on, so bloom catches it
    diffuser.opacity = v * 0.22;
  });

  const z = front - 0.06;
  return (
    <>
      {/* aluminium channel + opal diffuser */}
      <mesh position={[0, y - 0.012, z]} material={strip}>
        <boxGeometry args={[width - 0.16, 0.014, 0.034]} />
      </mesh>
      {/* the soft halo right under the strip */}
      <mesh position={[0, y - 0.05, z + 0.02]} rotation-x={-Math.PI / 2} material={diffuser} renderOrder={2}>
        <planeGeometry args={[width - 0.1, 0.16]} />
      </mesh>
    </>
  );
}

/**
 * The light the strips throw onto the spines: a soft area light washing down
 * the row plus small fills in front.
 *
 * Only the row in view (and the one you are moving to) is ever lit, so instead
 * of a light set per row (whose cost grows with every row, in every shader) two
 * sets follow the camera: even rows use set 0, odd rows set 1. Adjacent rows
 * always use different sets, and a set only jumps rows while it is dark.
 *
 * @param {{ rows: { y: number, spineY: number }[], camRef: any, reduced: boolean, front: number, width: number, lampXs: number[] }} props
 *   rows[i].y = underside of the board above row i; spineY = the row's centre
 */
export function RowLights({ rows, camRef, reduced, front, width, lampXs }) {
  const s = theme.scene.shelf;
  const areas = useRef(/** @type {(THREE.RectAreaLight | null)[]} */ ([]));
  const fills = useRef(/** @type {(THREE.PointLight | null)[][]} */ ([[], []]));
  const state = useRef(Array.from({ length: SETS }, () => ({ row: -1, level: 0 })));
  const z = front - 0.06;

  useLayoutEffect(() => {
    state.current.forEach((st) => (st.row = -1)); // re-place after a layout change
  }, [rows]);

  useFrame((_, dt) => {
    const progress = camRef.current?.progress ?? 0;
    for (let k = 0; k < SETS; k++) {
      const st = state.current[k];
      // this set's nearest row
      let best = -1;
      let focus = 0;
      for (let r = k; r < rows.length; r += SETS) {
        const f = rowFocus(progress, rows.length, r);
        if (best === -1 || f > focus) ((best = r), (focus = f));
      }
      if (best === -1) continue;
      const target = ROW_LIGHT_FLOOR + (1 - ROW_LIGHT_FLOOR) * focus;
      st.level = easeLevel(st.level, target, dt, reduced);
      const area = areas.current[k];
      if (best !== st.row) {
        st.row = best;
        const row = rows[best];
        if (area) {
          area.position.set(0, row.y - 0.02, z);
          area.lookAt(0, row.spineY - CASE.height * 0.15, CASE.width / 2);
        }
        fills.current[k].forEach((f, i) => f?.position.set(lampXs[i], row.y - 0.12, front + 0.25));
      }
      if (area) area.intensity = st.level * s.lampIntensity * 9;
      fills.current[k].forEach((f) => f && (f.intensity = st.level * s.lampIntensity));
    }
  });

  return (
    <>
      {Array.from({ length: Math.min(SETS, rows.length) }, (_, k) => (
        <group key={k}>
          <rectAreaLight ref={(el) => (areas.current[k] = el)} color={s.lamp} intensity={0} width={width - 0.2} height={0.05} />
          {lampXs.map((x, i) => (
            <pointLight key={x} ref={(el) => (fills.current[k][i] = el)} color={s.lamp} intensity={0} distance={3.4} decay={1.6} />
          ))}
        </group>
      ))}
    </>
  );
}
