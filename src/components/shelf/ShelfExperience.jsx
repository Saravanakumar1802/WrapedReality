import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { ShelfCanvas } from "@/components/three/canvas/lazy.jsx";
import { PLATFORMS, GENRES } from "@/data/taxonomy.js";
import { getLenis } from "@/components/ui/SmoothScroll.jsx";
import { safeStorage } from "@/lib/env.js";
import { initialShelfState, neighbours, shelfReducer } from "@/lib/shelfMachine.js";
import { useSwipe } from "@/hooks/useSwipe.js";
import CasePanel from "./CasePanel.jsx";
import ShelfListView from "./ShelfListView.jsx";
import styles from "./ShelfExperience.module.css";

const SORTS = {
  az: { label: "A to Z", fn: (a, b) => a.title.localeCompare(b.title) },
  genre: { label: "Genre", fn: (a, b) => a.primaryGenre.localeCompare(b.primaryGenre) || a.title.localeCompare(b.title) },
  year: { label: "Release year", fn: (a, b) => (a.year ?? 0) - (b.year ?? 0) || a.title.localeCompare(b.title) },
};

const ANNOUNCE = {
  out: (t) => `${t} pulled off the shelf.`,
  open: (t) => `${t} case opened.`,
  inspect: (t) => `Holding the ${t} disc.`,
};

const NO_INSETS = { right: 0, bottom: 0 };

/**
 * The interactive shelf page body.
 *
 * State machine (src/lib/shelfMachine.js): browsing → out → open → inspect, with
 * Esc / the backdrop / swipe-down stepping back. While a case is out you can
 * flip straight to the previous or next case (buttons, ← →, or a sideways swipe):
 * the old case flies home while the new one comes out.
 *
 * The camera frames about one row, so cases are large. The wrapper is a tall
 * scroll track (one extra screen-ish per row) with the stage pinned inside it:
 * scrolling the page moves the camera down the cabinet, row by row. While a case
 * is out the page is held still, so nothing moves under it.
 * @param {{ games: any[], heading: string, intro?: string, nav?: import('react').ReactNode }} props
 */
export default function ShelfExperience({ games, heading, intro, nav }) {
  const [sort, setSort] = useState("az");
  const [view, setView] = useState(/** @type {"3d" | "list"} */ ("3d"));
  const [state, dispatch] = useReducer(shelfReducer, initialShelfState);
  const { selected, stage, leaving, focused } = state;
  const [hovered, setHovered] = useState(/** @type {string | null} */ (null));
  const [rows, setRows] = useState(1);
  const discRef = useRef(null);
  const track = useRef(/** @type {HTMLDivElement | null} */ (null));
  const stageEl = useRef(/** @type {HTMLDivElement | null} */ (null));
  const panelEl = useRef(/** @type {HTMLElement | null} */ (null));
  const insetsRef = useRef(NO_INSETS);

  useEffect(() => {
    const saved = safeStorage.get("shelf:view", "3d");
    // restore a per-visitor preference after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "list") setView("list");
  }, []);

  const ordered = useMemo(() => [...games].sort(SORTS[sort].fn), [games, sort]);
  const platforms = useMemo(() => PLATFORMS.filter((p) => games.some((g) => g.platform === p)), [games]);
  // keyboard / prev-next order = visual order (by platform row, then sort)
  const visual = useMemo(() => platforms.flatMap((p) => ordered.filter((g) => g.platform === p)), [platforms, ordered]);
  const order = useMemo(() => visual.map((g) => g.slug), [visual]);
  const bySlug = useMemo(() => new Map(games.map((g) => [g.slug, g])), [games]);
  const current = selected ? bySlug.get(selected) : null;
  const near = neighbours(order, selected);
  const prefetchList = useMemo(() => [near.prev, near.next].filter(Boolean), [near.prev, near.next]);

  // ── actions ──
  const select = useCallback((slug) => dispatch({ type: "select", slug }), []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);
  const step = useCallback((dir) => dispatch({ type: "step", dir, order }), [order]);
  const goto = useCallback((s) => dispatch({ type: "goto", stage: s }), []);
  const onReturned = useCallback((slug) => dispatch({ type: "returned", slug }), []);
  const onCaseClick = useCallback(() => dispatch({ type: "toggleCase" }), []);
  const onDiscClick = useCallback(() => dispatch({ type: "goto", stage: "inspect" }), []);

  /** Keyboard focus moved to another row: scroll the page so the camera follows. */
  const onFocusRow = useCallback((row, total) => {
    const el = track.current;
    if (!el || total < 2) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const y = top + (row / (total - 1)) * (el.offsetHeight - window.innerHeight);
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { duration: 0.9 });
    else window.scrollTo({ top: y });
  }, []);

  // ── hold the page still while a case is out ──
  const isOut = Boolean(selected);
  useEffect(() => {
    if (!isOut) return;
    const lenis = getLenis();
    lenis?.stop();
    return () => lenis?.start();
  }, [isOut]);

  // ── how much of the stage the panel covers (the scene centres the case in the rest) ──
  useLayoutEffect(() => {
    const panel = panelEl.current;
    const host = stageEl.current;
    if (!panel || !host) {
      insetsRef.current = NO_INSETS;
      return;
    }
    const measure = () => {
      const s = host.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      if (!s.width || !s.height) return;
      const sheet = p.width > s.width * 0.6; // bottom sheet on phones, side card on wide screens
      insetsRef.current = sheet
        ? { right: 0, bottom: Math.max(0, s.bottom - p.top + 8) / s.height }
        : { right: Math.max(0, s.right - p.left + 16) / s.width, bottom: 0 };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(panel);
    ro.observe(host);
    return () => ro.disconnect();
  }, [current]);

  // ── touch gestures on the stage ──
  useSwipe(stageEl, { left: () => step(1), right: () => step(-1), down: back }, view === "3d" && isOut && stage !== "inspect");

  // ── keyboard: arrows move along the shelf (or between cases), Enter advances, Esc steps back ──
  useEffect(() => {
    if (view !== "3d") return;
    const onKey = (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.closest("input, textarea, select, dialog, [contenteditable]")) return;
      if (e.key === "Escape" && selected) {
        e.preventDefault();
        back();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (t.closest("button, a") && !selected) return; // let focused controls keep their arrows
        e.preventDefault();
        step(e.key === "ArrowRight" ? 1 : -1);
      } else if (e.key === "Enter" && !t.closest("button, a")) {
        if (selected) {
          e.preventDefault();
          dispatch({ type: "advance" });
        } else if (focused) {
          e.preventDefault();
          select(focused);
        }
      } else if ((e.key === "f" || e.key === "F") && selected && stage === "inspect") {
        discRef.current?.flip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, selected, stage, focused, back, step, select]);

  const switchView = (v) => {
    setView(v);
    safeStorage.set("shelf:view", v);
    if (v === "list") dispatch({ type: "reset" });
  };

  const info = current ?? (hovered ? bySlug.get(hovered) : null) ?? (focused ? bySlug.get(focused) : null);

  return (
    <div ref={track} className={styles.wrap} data-view={view} style={{ "--rows": rows }}>
      <div className={styles.pin}>
        <div className={`container ${styles.toolbar}`}>
          <div className={styles.titleBlock}>
            <h1 className={styles.h1}>{heading}</h1>
            {intro && <p className={`muted ${styles.intro}`}>{intro}</p>}
          </div>
          {nav}
          <div className={styles.controls}>
            <label className={styles.sort}>
              <span className="visually-hidden">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort games">
                {Object.entries(SORTS).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <div role="group" aria-label="View" className={styles.viewToggle}>
              <button type="button" className="chip" aria-pressed={view === "3d"} onClick={() => switchView("3d")}>
                Shelf
              </button>
              <button type="button" className="chip" aria-pressed={view === "list"} onClick={() => switchView("list")}>
                List
              </button>
            </div>
          </div>
        </div>

        {view === "3d" ? (
          <div ref={stageEl} className={styles.stage} data-selected={isOut}>
            <ShelfCanvas
              games={ordered}
              platforms={platforms}
              selected={selected}
              stage={stage}
              leaving={leaving}
              focused={focused}
              insetsRef={insetsRef}
              neighbours={prefetchList}
              onSelect={select}
              onHover={setHovered}
              onCaseClick={onCaseClick}
              onDiscClick={onDiscClick}
              onReturned={onReturned}
              onBackdrop={close}
              discRef={discRef}
              trackRef={track}
              onRows={setRows}
              onFocusRow={onFocusRow}
              fallback={
                <div className={styles.noGl}>
                  <p>The 3D shelf needs WebGL 2, which this browser doesn&apos;t support.</p>
                  <button type="button" className="btn" onClick={() => switchView("list")}>
                    Show the list instead
                  </button>
                </div>
              }
            />

            <p className="visually-hidden" aria-live="polite">
              {current ? ANNOUNCE[stage]?.(current.title) : ""}
            </p>

            {!current && (
              <div className={styles.peek} aria-hidden={!info}>
                {info ? (
                  <>
                    <strong>{info.title}</strong>
                    <span className="muted">
                      {info.platform}, {GENRES[info.primaryGenre]?.label}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`muted ${styles.hintFine}`}>
                      {rows > 1 ? "Scroll to move down the shelf. " : ""}Click a case to pull it out, or use <span className="kbd">←</span>{" "}
                      <span className="kbd">→</span> and <span className="kbd">Enter</span>.
                    </span>
                    <span className={`muted ${styles.hintCoarse}`}>
                      {rows > 1 ? "Scroll down the shelf, " : ""}tap a case to pull it out.
                    </span>
                  </>
                )}
              </div>
            )}

            {current && (
              <CasePanel
                ref={panelEl}
                game={current}
                stage={stage}
                position={{ index: near.index, total: order.length }}
                prev={near.prev ? bySlug.get(near.prev) : null}
                next={near.next ? bySlug.get(near.next) : null}
                onStage={goto}
                onStep={step}
                onBack={back}
                onClose={close}
                onFlip={() => discRef.current?.flip()}
                onReset={() => discRef.current?.reset()}
              />
            )}
          </div>
        ) : (
          <div className="container">
            <ShelfListView games={visual} platforms={platforms} />
          </div>
        )}
      </div>
    </div>
  );
}
