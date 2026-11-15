import { useLayoutEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/** Longest a scene waits for background compilation before rendering anyway. */
const COMPILE_CAP_MS = 8000;

/** Renderers whose frames go through the post-processing composer. */
const composed = new WeakSet();
/** Any off-screen target will do: programs only depend on "canvas vs. render target". */
let offscreen = null;

/** Tell the compiler whether this renderer draws through an EffectComposer. */
export function setComposerActive(gl, active) {
  if (active) composed.add(gl);
  else composed.delete(gl);
}

/**
 * `renderer.compileAsync` for the program variant the scene will actually use.
 *
 * three.js bakes the output target into each program: drawn to the canvas it
 * applies tone mapping and sRGB; drawn into a render target (what the bloom
 * composer does) it does neither. Compiling for the canvas when frames go
 * through the composer builds the wrong variant, and every material then
 * compiles again, synchronously, on the first real frame.
 *
 * @returns {Promise<unknown>}
 */
export function compileForScene(gl, object, camera, scene) {
  if (!gl.compileAsync) return Promise.resolve();
  const previous = gl.getRenderTarget();
  if (composed.has(gl)) {
    offscreen ??= new THREE.WebGLRenderTarget(1, 1);
    gl.setRenderTarget(offscreen);
  }
  try {
    // program parameters are captured synchronously here; only the waiting is async
    return gl.compileAsync(object, camera, scene).catch(() => {});
  } finally {
    gl.setRenderTarget(previous);
  }
}

/**
 * Mounts its children hidden, compiles their shaders off the main thread
 * (KHR_parallel_shader_compile where available), then shows them.
 *
 * Why: three.js compiles a material the first time it draws it, synchronously.
 * With physically based materials and several lights, one shader can take a
 * second or more on Windows (ANGLE translates every shader to Direct3D),
 * freezing the page mid-animation. Gated content appears a moment later instead.
 *
 * Only for meshes: lights inside a hidden group are not counted at compile time.
 *
 * @param {{ children: import("react").ReactNode, deps?: any[], onReady?: () => void }} props
 *   `deps`: recompile (and re-hide) when these change, e.g. a new material.
 */
export default function CompileGate({ children, deps = [], onReady }) {
  const group = useRef(/** @type {THREE.Group | null} */ (null));
  const { gl, camera, scene } = useThree();
  const [ready, setReady] = useState(false);
  const latest = useRef(onReady);
  useLayoutEffect(() => {
    latest.current = onReady;
  });

  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    let alive = true;
    setReady(false);
    compileForScene(gl, g, camera, scene).then(() => {
      if (!alive) return;
      setReady(true);
      latest.current?.();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, scene, ...deps]);

  return (
    <group ref={group} visible={ready}>
      {children}
    </group>
  );
}

/**
 * Compiles a whole scene off the main thread before its first frame. Lives
 * inside the canvas's Suspense boundary, so it runs once everything that
 * suspends (models, textures) has arrived.
 * @param {{ onReady: () => void }} props
 */
export function SceneCompiler({ onReady }) {
  const { gl, camera, scene } = useThree();
  const done = useRef(false);
  useLayoutEffect(() => {
    if (done.current) return;
    done.current = true;
    // never hold the scene back for long: after the cap it renders (and compiles) as before
    const cap = new Promise((resolve) => setTimeout(resolve, COMPILE_CAP_MS));
    Promise.race([compileForScene(gl, scene, camera, scene), cap]).then(onReady);
  }, [gl, camera, scene, onReady]);
  return null;
}
