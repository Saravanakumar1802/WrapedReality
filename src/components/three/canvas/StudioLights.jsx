import { useEffect, useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { theme } from "@/theme";

/** Reflection map resolution (per cube face) and capture range, as drei's <Environment> used. */
const RESOLUTION = 256;
const NEAR = 0.1;
const FAR = 1000;

/**
 * Builds the softbox "studio" that discs and glossy cases reflect: a few emissive
 * panels and a ring around the origin, captured once into a cube map.
 * Equivalent to drei's <Environment frames={1}> + <Lightformer>s, without the
 * HDR/EXR loaders that component pulls in (this site never loads an HDRI).
 *
 * @param {THREE.WebGLRenderer} gl
 * @returns {THREE.WebGLCubeRenderTarget}
 */
export function captureStudio(gl) {
  const s = theme.scene;
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(s.background);
  const disposables = [];
  const panel = (geometry, { color, intensity, position, scale }) => {
    // Lightformer: unlit, double-sided, colour scaled past white by its intensity, aimed at the origin.
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
    material.color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (Array.isArray(scale)) mesh.scale.set(scale[0], scale[1], scale[2] ?? 1);
    else mesh.scale.setScalar(scale);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    disposables.push(geometry, material);
  };
  for (const l of s.lightformers) panel(new THREE.PlaneGeometry(1, 1), l);
  panel(new THREE.RingGeometry(0.25, 0.5, 64), { color: theme.holo.stops[1], intensity: 1.5, position: [2, 3, 4], scale: 2 });

  const target = new THREE.WebGLCubeRenderTarget(RESOLUTION);
  target.texture.type = THREE.HalfFloatType;
  const cubeCamera = new THREE.CubeCamera(NEAR, FAR, target);
  const autoClear = gl.autoClear;
  gl.autoClear = true;
  cubeCamera.update(gl, studio);
  gl.autoClear = autoClear;
  disposables.forEach((d) => d.dispose());
  return target;
}

/**
 * Studio lighting: ambient + key + rim + fill, and the captured softbox studio
 * as the scene's environment (reflections). No HDRI download, fully themeable.
 * `direct` scales the key/rim lights for scenes that bring their own (the shelf).
 */
export default function StudioLights({ envIntensity = 1, direct = 1 }) {
  const s = theme.scene;
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const target = useMemo(() => captureStudio(gl), [gl]);
  useEffect(() => () => target.dispose(), [target]);

  useLayoutEffect(() => {
    const prev = { env: scene.environment, intensity: scene.environmentIntensity };
    scene.environment = target.texture;
    scene.environmentIntensity = envIntensity;
    return () => {
      scene.environment = prev.env;
      scene.environmentIntensity = prev.intensity;
    };
  }, [scene, target, envIntensity]);

  return (
    <>
      <ambientLight color={s.ambient.color} intensity={s.ambient.intensity} />
      <directionalLight color={s.key.color} intensity={s.key.intensity * direct} position={[3, 5, 6]} />
      <directionalLight color={s.rim.color} intensity={s.rim.intensity * direct} position={[-5, 2, -4]} />
      <pointLight color={s.fill.color} intensity={s.fill.intensity} position={[4, -2, 3]} distance={14} />
    </>
  );
}
