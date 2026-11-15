import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { CASE, computeShelfLayout, perRowForAspect, shelfView } from "@/lib/layout.js";
import { theme } from "@/theme";
import { prefersReducedMotion } from "@/lib/env.js";
import { sfx } from "@/lib/sound.js";
import { useSpineAtlas } from "@/components/three/art/textures.js";
import { loadCaseTextures, prefetchCaseTextures } from "@/components/three/art/caseTextureCache.js";
import GameCase from "@/components/three/objects/GameCase.jsx";
import StudioLights from "@/components/three/canvas/StudioLights.jsx";
import CompileGate from "@/components/three/canvas/CompileGate.jsx";
import Cabinet from "./Cabinet.jsx";
import ShelfCases from "./ShelfCases.jsx";
import CaseFlyer, { PRESENT_DISTANCE } from "./CaseFlyer.jsx";

const FOV = 35;
const HALF_TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const NO_RAYCAST = () => null;
const tmpLook = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const STAGE_TO_CASE = { out: "closed", open: "open", inspect: "inspect" };

/**
 * The shelf: a walnut cabinet, one platform per row, every game spine-out.
 * The camera frames about one row (so spines are big) and travels down the
 * cabinet as the page scrolls; it also leans with the pointer.
 *
 * Interaction state lives in the parent (src/lib/shelfMachine.js); this scene
 * only renders it: which case is out, which are still flying home, the stage.
 *
 * @param {{ games: any[], platforms: string[], selected: string | null, stage: "out" | "open" | "inspect",
 *   leaving: string[], focused: string | null, insetsRef: { current: { right: number, bottom: number } },
 *   onSelect: (slug: string) => void, onHover: (slug: string | null) => void, onCaseClick: () => void,
 *   onDiscClick: () => void, onReturned: (slug: string) => void, onBackdrop: () => void, discRef: any,
 *   trackRef: { current: HTMLElement | null }, onRows?: (rows: number) => void, onFocusRow?: (row: number, rows: number) => void,
 *   neighbours?: string[] }} props `neighbours`: slugs to prefetch while a case is out.
 */
export default function ShelfScene({
  games,
  platforms,
  selected,
  stage,
  leaving,
  focused,
  insetsRef,
  onSelect,
  onHover,
  onCaseClick,
  onDiscClick,
  onReturned,
  onBackdrop,
  discRef,
  trackRef,
  onRows,
  onFocusRow,
  neighbours = [],
}) {
  const { size, camera, gl } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const perRow = perRowForAspect(aspect, Math.max(1, games.length));
  const layout = useMemo(() => computeShelfLayout(games, { perRow, platforms }), [games, perRow, platforms]);
  const slotBySlug = useMemo(() => new Map(layout.slots.map((s, i) => [s.slug, { ...s, i }])), [layout]);
  const gameBySlug = useMemo(() => new Map(games.map((g) => [g.slug, g])), [games]);
  const atlas = useSpineAtlas(games);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const wide = aspect > 1.15;
  const rowCount = layout.rows.length;

  useEffect(() => onRows?.(rowCount), [rowCount, onRows]);

  // ── Camera: frames ~one row, travels with the page scroll ─────
  const rig = useMemo(() => {
    const view = shelfView(aspect);
    const dist = view.viewHeight / (2 * HALF_TAN) + CASE.width / 2; // measured from the spines
    const top = layout.rows[0]?.y ?? 0;
    const bottom = layout.rows[rowCount - 1]?.y ?? 0;
    return { dist, top, bottom, lift: view.viewHeight * 0.05 };
  }, [aspect, layout, rowCount]);

  const cam = useRef({ progress: 0, frozen: 0, intro: 1, px: 0, py: 0 });

  useLayoutEffect(() => {
    camera.position.set(0, rig.top + rig.lift, rig.dist * (reduced ? 1 : 1.35));
    camera.lookAt(0, rig.top, 0);
  }, [camera, rig, reduced]);

  useFrame((state, dt) => {
    const c = cam.current;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5);
    // where the page is within the tall scroll track (0 = top row, 1 = bottom row)
    const el = trackRef?.current;
    let live = 0;
    if (el) {
      const r = el.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      live = range > 4 ? Math.min(1, Math.max(0, -r.top / range)) : 0;
    }
    // while a case is out, the camera holds still (the case floats in front of it)
    if (selected) live = c.frozen;
    else c.frozen = live;
    c.progress += (live - c.progress) * k;
    c.intro += (0 - c.intro) * (reduced ? 1 : 1 - Math.exp(-dt * 2.2));
    const lean = selected || reduced ? 0 : 1;
    c.px += (state.pointer.x * lean - c.px) * k * 0.6;
    c.py += (state.pointer.y * lean - c.py) * k * 0.6;

    const rowY = THREE.MathUtils.lerp(rig.top, rig.bottom, c.progress);
    camera.position.set(c.px * 0.55, rowY + rig.lift + c.py * 0.16, rig.dist * (1 + c.intro * 0.35));
    camera.lookAt(tmpLook.set(c.px * 0.08, rowY, 0));
  });

  // Keyboard focus on another row scrolls the page there.
  const focusedRow = focused ? (slotBySlug.get(focused)?.row ?? -1) : -1;
  useEffect(() => {
    if (focusedRow >= 0) onFocusRow?.(focusedRow, rowCount);
  }, [focusedRow, rowCount, onFocusRow]);

  // ── Shadows: re-rendered only when something that casts one moves ──
  // The cabinet is static, so redrawing a 2048² shadow map every frame was pure cost.
  const flying = Boolean(selected) || leaving.length > 0;
  const shadowDirty = useRef(true);
  const markShadows = useCallback(() => void (shadowDirty.current = true), []);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    shadowDirty.current = true;
    return () => void (gl.shadowMap.autoUpdate = true);
  }, [gl, layout]);
  useFrame(() => {
    if (shadowDirty.current || flying) {
      gl.shadowMap.needsUpdate = true;
      shadowDirty.current = false;
    }
  });

  // ── Which cases are off the shelf ──
  const hidden = useMemo(() => {
    const set = new Set();
    for (const slug of [selected, ...leaving]) {
      const i = slug ? slotBySlug.get(slug)?.i : undefined;
      if (i != null) set.add(i);
    }
    return set;
  }, [selected, leaving, slotBySlug]);

  // ── Prefetch: the art for a case starts loading before it is needed ──
  const prefetch = useCallback((slug) => slug && prefetchCaseTextures(gameBySlug.get(slug), "", gl), [gameBySlug, gl]);
  useEffect(() => {
    if (!selected) return;
    const id = setTimeout(() => neighbours.forEach(prefetch), 900); // after the fly-out settles
    return () => clearTimeout(id);
  }, [selected, neighbours, prefetch]);

  // ── Warm-up: compile the detailed case's shaders once, hidden, right away ──
  // Otherwise the first click pays for shader compilation mid-flight. It runs in
  // parallel with the rest of the scene's compilation (behind the boot loader).
  const [warm, setWarm] = useState(/** @type {any} */ (null));
  const [caseShadersReady, setCaseShadersReady] = useState(false);
  const warmed = useRef(false);
  useEffect(() => {
    if (warmed.current || !games.length) return;
    warmed.current = true;
    const first = games[0];
    loadCaseTextures(first, "", gl)
      .then(() => setWarm(first))
      .catch(() => {});
  }, [games, gl]);

  // ── Dimmer behind the case: click it to put the case back ──
  const dim = useRef(/** @type {THREE.MeshBasicMaterial | null} */ (null));
  const dimMesh = useRef(/** @type {THREE.Mesh | null} */ (null));
  useEffect(() => {
    if (!dim.current) return;
    const tween = gsap.to(dim.current, { opacity: selected ? 0.7 : 0, duration: reduced ? 0 : selected ? 0.6 : 0.45 });
    return () => {
      tween.kill();
    };
  }, [selected, reduced]);
  useFrame(() => {
    const m = dimMesh.current;
    if (!m) return;
    camera.getWorldDirection(tmpDir);
    m.position.copy(camera.position).addScaledVector(tmpDir, PRESENT_DISTANCE + 0.8); // between the case and the spines
    m.quaternion.copy(camera.quaternion);
  });

  const handleHover = useCallback(
    (i) => {
      const slug = i >= 0 ? layout.slots[i]?.slug : null;
      onHover(slug ?? null);
      if (slug) {
        sfx.hover();
        prefetch(slug);
      }
    },
    [layout, onHover, prefetch],
  );
  const handlePress = useCallback((i) => prefetch(layout.slots[i]?.slug), [layout, prefetch]);
  const handlePick = useCallback((i) => layout.slots[i] && onSelect(layout.slots[i].slug), [layout, onSelect]);

  const focusedIdx = focused && !selected ? (slotBySlug.get(focused)?.i ?? -1) : -1;
  const flyers = [...leaving.filter((s) => s !== selected), ...(selected ? [selected] : [])];

  return (
    <>
      <fog attach="fog" args={[theme.scene.fog, rig.dist + 4, rig.dist + 22]} />
      <StudioLights envIntensity={0.55} direct={0.3} />
      <Cabinet layout={layout} compact={!wide} camRef={cam} reduced={reduced} />

      <ShelfCases
        layout={layout}
        atlas={atlas}
        hidden={hidden}
        focusedIdx={focusedIdx}
        active={!selected}
        reduced={reduced}
        onHover={handleHover}
        onPress={handlePress}
        onPick={handlePick}
        onDirty={markShadows}
      />

      <mesh
        ref={dimMesh}
        renderOrder={1}
        raycast={selected ? THREE.Mesh.prototype.raycast : NO_RAYCAST}
        onClick={(e) => {
          if (!selected || e.delta > 8) return;
          e.stopPropagation();
          onBackdrop();
        }}
      >
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial ref={dim} color={theme.colors.void} transparent opacity={0} depthWrite={false} />
      </mesh>

      {flyers.map((slug) => {
        const game = gameBySlug.get(slug);
        const slot = slotBySlug.get(slug);
        if (!game || !slot) return null;
        const isSelected = slug === selected;
        return (
          <CaseFlyer
            key={slug}
            game={game}
            slot={slot}
            mode={isSelected ? "out" : "back"}
            stage={isSelected ? STAGE_TO_CASE[stage] : "closed"}
            insetsRef={insetsRef}
            reduced={reduced}
            onReturned={onReturned}
            onCaseClick={isSelected ? onCaseClick : undefined}
            onDiscClick={isSelected ? onDiscClick : undefined}
            discRef={isSelected ? discRef : undefined}
            gate={!caseShadersReady}
          />
        );
      })}

      {/* hidden copy used once to compile the detailed case's shaders */}
      {warm && (
        <CompileGate
          onReady={() => {
            setWarm(null);
            setCaseShadersReady(true);
          }}
        >
          <GameCase game={warm} stage="closed" />
        </CompileGate>
      )}
    </>
  );
}
