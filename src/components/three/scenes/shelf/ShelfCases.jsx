import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CASE, SHELF, createSlotPicker } from "@/lib/layout.js";
import { hashString, mulberry32 } from "@/lib/math.js";
import { platformTheme } from "@/theme";
import CompileGate from "@/components/three/canvas/CompileGate.jsx";
import { createSpineMaterial } from "./spineMaterial.js";

/** How far a hovered / focused case slides out of the row. */
export const PULL = 0.34;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
/** From a case's centre to its spine face (in the case's own space). */
const SPINE_OFFSET = new THREE.Matrix4().makeTranslation(0, 0, CASE.width / 2 + 0.0015);
const tmpObj = new THREE.Object3D();
const tmpMat = new THREE.Matrix4();
const tmpColor = new THREE.Color();

/**
 * Every case on the shelf as two instanced meshes (bodies + printed spines): two
 * draw calls for the whole library. Picking uses one invisible plane over the
 * spines and simple arithmetic (`createSlotPicker`), so there are no dead gaps
 * between cases and no per-case raycasting on every pointer move.
 *
 * @param {{ layout: any, atlas: any, hidden: Set<number>, focusedIdx: number, active: boolean, reduced: boolean,
 *   onHover: (index: number) => void, onPress: (index: number) => void, onPick: (index: number) => void,
 *   onDirty: () => void }} props
 *   `active` = false while a case is out (the shelf stops reacting).
 */
export default function ShelfCases({ layout, atlas, hidden, focusedIdx, active, reduced, onHover, onPress, onPick, onDirty }) {
  const count = layout.slots.length;
  const bodies = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const labels = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const anim = useRef(new Float32Array(count)); // 0..1 pull-out per instance
  const hoverIdx = useRef(-1);
  const pick = useMemo(() => createSlotPicker(layout), [layout]);

  const bodyGeo = useMemo(() => new RoundedBoxGeometry(CASE.depth, CASE.height, CASE.width, 3, 0.014), []);
  const labelGeo = useMemo(() => new THREE.PlaneGeometry(CASE.depth - 0.02, CASE.height - 0.07), []);
  const bodyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }), []);
  const labelMat = useMemo(() => (atlas ? createSpineMaterial(atlas) : null), [atlas]);
  useEffect(() => () => [bodyGeo, labelGeo, bodyMat].forEach((x) => x.dispose()), [bodyGeo, labelGeo, bodyMat]);
  useEffect(() => () => labelMat?.dispose(), [labelMat]);

  const { aCell, aGlow } = useMemo(
    () => ({
      aCell: new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2),
      aGlow: new THREE.InstancedBufferAttribute(new Float32Array(count), 1),
    }),
    [count],
  );
  // No two cases sit perfectly flush on a real shelf: a few millimetres of seeded push-back each.
  const jitter = useMemo(() => layout.slots.map((s) => mulberry32(hashString(s.slug))() * -0.035), [layout]);

  useLayoutEffect(() => {
    labelGeo.setAttribute("aCell", aCell);
    labelGeo.setAttribute("aGlow", aGlow);
  }, [labelGeo, aCell, aGlow]);

  useEffect(() => {
    anim.current = new Float32Array(count);
    if (bodies.current) bodies.current.userData.ready = false;
  }, [count, layout, atlas]);

  useEffect(() => {
    if (!atlas) return;
    layout.slots.forEach((s, i) => {
      const idx = atlas.index.get(s.slug) ?? 0;
      aCell.setXY(i, idx % atlas.cols, atlas.rows - 1 - Math.floor(idx / atlas.cols));
    });
    aCell.needsUpdate = true;
  }, [atlas, layout, aCell]);

  // Layout effect: the colours must exist before the scene's shaders are compiled (instance colour is a shader variant).
  useLayoutEffect(() => {
    const m = bodies.current;
    if (!m) return;
    layout.slots.forEach((s, i) => m.setColorAt(i, tmpColor.set(platformTheme(s.platform).shell)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [layout]);

  // A case that left the shelf (or came back) must be re-written even if it isn't animating.
  const hiddenKey = [...hidden].sort((a, b) => a - b).join();

  useFrame((_, dt) => {
    const b = bodies.current;
    const l = labels.current;
    if (!b) return;
    const k = reduced ? 1 : 1 - Math.pow(0.0005, dt);
    const fresh = !b.userData.ready || b.userData.hiddenKey !== hiddenKey || b.userData.hadLabels !== Boolean(l);
    let dirty = false;
    for (let i = 0; i < count; i++) {
      const target = active && (i === hoverIdx.current || i === focusedIdx) ? 1 : 0;
      const cur = anim.current[i];
      const next = Math.abs(target - cur) < 0.001 ? target : cur + (target - cur) * k;
      anim.current[i] = next;
      if (next === cur && !fresh) continue;
      dirty = true;
      if (hidden.has(i)) {
        b.setMatrixAt(i, HIDDEN);
        l?.setMatrixAt(i, HIDDEN);
        aGlow.setX(i, 0);
        continue;
      }
      const [x, y, z] = layout.slots[i].position;
      tmpObj.position.set(x, y, z + jitter[i] + next * PULL);
      tmpObj.rotation.set(0, next * -0.1, 0);
      tmpObj.updateMatrix();
      b.setMatrixAt(i, tmpObj.matrix);
      // the printed spine sits on the case's own front face, so it turns with the case
      l?.setMatrixAt(i, tmpMat.multiplyMatrices(tmpObj.matrix, SPINE_OFFSET));
      aGlow.setX(i, next);
    }
    if (dirty) {
      b.instanceMatrix.needsUpdate = true;
      if (l) l.instanceMatrix.needsUpdate = true;
      aGlow.needsUpdate = true;
      b.userData.ready = true;
      b.userData.hiddenKey = hiddenKey;
      b.userData.hadLabels = Boolean(l);
      onDirty();
    }
  });

  // ── picking ──
  const indexAt = (e) => {
    const i = pick(e.point.x, e.point.y);
    return i >= 0 && !hidden.has(i) ? i : -1;
  };
  const setHover = (i) => {
    if (i === hoverIdx.current) return;
    hoverIdx.current = i;
    onHover(i);
    document.body.style.cursor = i >= 0 ? "pointer" : "";
  };
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  useEffect(() => {
    if (!active) {
      hoverIdx.current = -1;
      document.body.style.cursor = "";
    }
  }, [active]);

  const top = layout.rows[0]?.y ?? 0;
  const bottom = layout.rows[layout.rows.length - 1]?.y ?? 0;
  const planeH = top - bottom + CASE.height + SHELF.rowGap;
  const planeW = Math.max(layout.width, 1) + 0.4;

  return (
    <>
      <instancedMesh ref={bodies} args={[bodyGeo, bodyMat, count]} frustumCulled={false} castShadow receiveShadow raycast={() => null} />
      {labelMat && (
        <CompileGate deps={[labelMat]}>
          <instancedMesh ref={labels} args={[labelGeo, labelMat, count]} frustumCulled={false} receiveShadow raycast={() => null} />
        </CompileGate>
      )}

      {/* invisible hit plane over the spines */}
      <mesh
        visible={false}
        position={[0, (top + bottom) / 2, CASE.width / 2 + 0.01]}
        onPointerMove={(e) => {
          if (!active) return;
          e.stopPropagation();
          setHover(e.pointerType === "touch" ? -1 : indexAt(e));
        }}
        onPointerOut={() => setHover(-1)}
        onPointerDown={(e) => {
          if (!active) return;
          const i = indexAt(e);
          if (i >= 0) onPress(i); // starts loading its art ~100 ms before the click lands
        }}
        onClick={(e) => {
          if (!active || e.delta > 8) return; // the end of a drag / scroll, not a tap
          e.stopPropagation();
          const i = indexAt(e);
          if (i >= 0) onPick(i);
        }}
      >
        <planeGeometry args={[planeW, planeH]} />
      </mesh>
    </>
  );
}
