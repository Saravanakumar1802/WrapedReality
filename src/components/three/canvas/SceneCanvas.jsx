import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { theme } from "@/theme";
import { hasWebGL2, isCoarsePointer, isLowEndDevice } from "@/lib/env.js";
import { useUI } from "@/lib/store.js";
import { isBootDone, onBootDone } from "@/lib/boot.js";
import Effects from "./Effects.jsx";
import CanvasBoundary from "./CanvasBoundary.jsx";
import { SceneCompiler, setComposerActive } from "./CompileGate.jsx";
import styles from "./SceneCanvas.module.css";

const DEFAULT_CAMERA = { position: [0, 0, 6], fov: 35, near: 0.1, far: 100 };
// Stable objects: R3F re-applies these props whenever their identity changes.
const GL = { antialias: true, powerPreference: "high-performance", stencil: false };
const GL_TRANSPARENT = { ...GL, alpha: true };
/**
 * Measure the layout size, not the on-screen box: several canvases sit inside
 * elements that GSAP scales on scroll (the home hero shrinks into a card). The
 * default measurement includes transforms, so every scroll frame resized the
 * canvas and reallocated its buffers (≈0.7 s each on Windows). Pointer events use
 * element-local offsets, so scroll position doesn't need tracking either.
 */
const RESIZE = { offsetSize: true, scroll: false, debounce: { scroll: 0, resize: 80 } };
const RAYCASTER = { params: { Mesh: {}, LOD: {}, Sprite: {}, Points: { threshold: 0.35 }, Line: { threshold: 0.1 } } };

/**
 * Shared canvas wrapper:
 *  - draws nothing until the scene's shaders have compiled in the background
 *    (no multi-second freeze on the first frame, see CompileGate.jsx)
 *  - renders only while on screen and the tab is visible (frameloop "never" otherwise)
 *  - caps DPR at 2, drops quality (DPR + bloom) on slow devices via PerformanceMonitor
 *  - shows `fallback` when WebGL2 is unavailable
 */
export default function SceneCanvas({
  children,
  camera = DEFAULT_CAMERA,
  fallback = null,
  effects = true,
  className = "",
  shadows = false,
  transparent = false,
  onCreated,
}) {
  const wrap = useRef(null);
  const [supported, setSupported] = useState(/** @type {boolean | null} */ (null));
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  // Behind the boot loader the scene renders once and then waits.
  const [booted, setBooted] = useState(isBootDone);
  useEffect(() => onBootDone(() => setBooted(true)), []);
  const [compiled, setCompiled] = useState(false);
  const markCompiled = useCallback(() => setCompiled(true), []);
  const quality = useUI((s) => s.quality);
  const setQuality = useUI((s) => s.setQuality);

  useEffect(() => {
    // Capability detection must run on the client after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(hasWebGL2());
    if (isLowEndDevice()) setQuality("low");
  }, [setQuality]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    const vis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const handleCreated = useCallback(
    (state) => {
      state.gl.setClearColor(new THREE.Color(theme.scene.background), transparent ? 0 : 1);
      state.gl.toneMapping = THREE.ACESFilmicToneMapping;
      // Reading shader logs forces each compile to finish on the main thread; only worth it while developing.
      state.gl.debug.checkShaderErrors = import.meta.env.DEV;
      // Ask once now, while the GPU is idle: the first query blocks until queued work (shader compiles) finishes.
      state.gl.capabilities.getMaxAnisotropy();
      onCreated?.(state);
    },
    [transparent, onCreated],
  );

  const running = onScreen && tabVisible && compiled;
  const maxDpr = quality === "low" ? 1.25 : 2;

  return (
    <div ref={wrap} className={`${styles.wrap} ${className}`} data-transparent={transparent} aria-hidden="true">
      {supported === false && fallback}
      {supported && (
        <CanvasBoundary fallback={fallback}>
          <Canvas
            dpr={[1, maxDpr]}
            camera={camera}
            // PCF ("percentage"): three converts the old soft-PCF type to this on the first shadow frame
            // anyway, and changing it after shaders compile forces them all to compile again.
            shadows={shadows ? "percentage" : false}
            frameloop={!running ? "never" : booted ? "always" : "demand"}
            gl={transparent ? GL_TRANSPARENT : GL}
            onCreated={handleCreated}
            raycaster={RAYCASTER}
            resize={RESIZE}
          >
            <ComposerFlag active={effects} />
            <PerformanceMonitor onDecline={() => setQuality("low")} flipflops={2} />
            <Suspense fallback={null}>
              {children}
              <SceneCompiler onReady={markCompiled} />
            </Suspense>
            {/* On dense touch screens (DPR ≥ 2) pixels are already tiny: skip the costly MSAA pass. */}
            {effects && <Effects quality={quality} multisampling={isCoarsePointer() ? 0 : 4} />}
          </Canvas>
        </CanvasBoundary>
      )}
    </div>
  );
}

/** Lets the background shader compiler build the variants the composer will use (see CompileGate.jsx). */
function ComposerFlag({ active }) {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => setComposerActive(gl, active), [gl, active]);
  return null;
}
