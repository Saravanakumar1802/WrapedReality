import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { theme } from "@/theme";
import { ledMaterial } from "@/components/three/materials/materials.js";
import { hexPanelTexture } from "@/components/three/materials/wood.js";
import { updateLocalLights, withLocalLights } from "@/components/three/materials/localLights.js";

/**
 * The room around the cabinet, lit like a gaming setup: a wall of hexagonal
 * acoustic panels, a neon tube either side, and an RGB wash behind the cabinet
 * that drifts slowly through the theme's room colours.
 *
 * The wash and tube lights sit behind the cases' spines, so they can only ever
 * reach the wall and the timber. They are "local lights" (materials/localLights.js):
 * evaluated by those materials alone, not by every case, spine and disc shader.
 */
export default function Room({ outerW, height, midY, wallZ, reduced }) {
  const s = theme.scene.shelf;
  const room = theme.scene.room;
  const scene = useThree((state) => state.scene);
  const wallSize = [outerW + 60, height + 60];
  const wall = useMemo(() => {
    const bump = hexPanelTexture().clone();
    bump.repeat.set(wallSize[0] / 1.5, wallSize[1] / 1.725);
    bump.needsUpdate = true;
    return withLocalLights(new THREE.MeshStandardMaterial({ color: s.wall, roughness: 0.82, bumpMap: bump, bumpScale: 2.2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallSize[0], wallSize[1], s.wall]);
  useEffect(() => () => (wall.bumpMap?.dispose(), wall.dispose()), [wall]);

  const tubeX = outerW / 2 + 0.34;
  const tubeH = Math.max(1.6, height * 0.84);
  const tubes = useMemo(
    () => [
      { x: -tubeX, color: room.tubeLeft },
      { x: tubeX, color: room.tubeRight },
    ],
    [tubeX, room.tubeLeft, room.tubeRight],
  );

  /** World-space light rig: three wash lights (colour animated) + one per neon tube. */
  const lights = useMemo(() => {
    const wash = [
      [-outerW / 2 - 0.15, midY + height * 0.3],
      [outerW / 2 + 0.15, midY - height * 0.3],
      [0, midY + height / 2 + 0.5],
    ].map(([x, y]) => ({
      position: new THREE.Vector3(x, y, wallZ + 0.5),
      color: new THREE.Color(1, 1, 1),
      intensity: room.wash,
      distance: 7,
      decay: 1.5,
    }));
    const tube = tubes.map((t) => ({
      position: new THREE.Vector3(t.x, midY, wallZ + 0.37),
      color: new THREE.Color(t.color),
      intensity: room.wash * 0.5,
      distance: 4.5,
      decay: 1.6,
    }));
    return { wash, all: [...wash, ...tube] };
  }, [outerW, midY, height, wallZ, room.wash, tubes]);

  // each wash light sits at a different point of the same slow colour cycle
  const palette = useMemo(() => room.rgb.map((c) => new THREE.Color(c)), [room.rgb]);
  useFrame((state) => {
    const t = reduced ? 0 : state.clock.elapsedTime * 0.07;
    lights.wash.forEach((l, i) => {
      const f = (t + i / lights.wash.length) % 1;
      const at = f * palette.length;
      const a = Math.floor(at) % palette.length;
      l.color.copy(palette[a]).lerp(palette[(a + 1) % palette.length], at - Math.floor(at));
    });
  });

  // Positions go to the shaders in view space, so write them once the camera for this frame is final.
  useEffect(() => {
    const previous = scene.onBeforeRender;
    scene.onBeforeRender = (renderer, sc, camera, target) => {
      updateLocalLights(lights.all, camera);
      previous?.(renderer, sc, camera, target);
    };
    return () => {
      scene.onBeforeRender = previous;
      updateLocalLights([], /** @type {any} */ ({ matrixWorldInverse: new THREE.Matrix4() }));
    };
  }, [scene, lights]);

  return (
    <group>
      <mesh position={[0, midY, wallZ]} material={wall} receiveShadow>
        <planeGeometry args={wallSize} />
      </mesh>

      {/* neon tubes on the wall either side of the cabinet (their light is local, see above) */}
      {tubes.map((t) => (
        <mesh key={t.x} position={[t.x, midY, wallZ + 0.07]} material={ledMaterial(t.color, 2.4)}>
          <capsuleGeometry args={[0.02, tubeH, 4, 12]} />
        </mesh>
      ))}
    </group>
  );
}
