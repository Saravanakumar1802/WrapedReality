import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import BoxArt from "@/components/ui/BoxArt.jsx";
import { getLenis } from "@/components/ui/SmoothScroll.jsx";
import { GENRES, MOODS } from "@/data/taxonomy.js";
import { genreColor, moodColor } from "@/theme";
import { FLIGHT, activeGroup, depthOpacity, flightPlan } from "@/lib/flight.js";
import { ScrollTrigger, gsap, scrollVelocity, useGSAP } from "@/lib/motion.js";
import { setSpaceTint } from "@/lib/space.js";
import { prefersReducedMotion } from "@/lib/env.js";
import styles from "./WorldsFlight.module.css";

const MODES = {
  genre: { label: "Genres", dict: GENRES, keyOf: (g) => g.primaryGenre, colorOf: genreColor, noun: "genre" },
  mood: { label: "Moods", dict: MOODS, keyOf: (g) => g.primaryMood, colorOf: moodColor, noun: "mood" },
};

/**
 * The archive as a flight: scroll to travel forward through every genre (or mood).
 * Each world opens with a gate you pass through, then its games stream past as
 * real cases. The star field takes on the colour of the world you are in.
 *
 * Every case is a real link in the DOM (keyboard + screen readers); the flight
 * is transforms only, written outside React, so scrolling stays at 60fps.
 * With reduced motion the same content renders as a plain grouped grid.
 */
export default function WorldsFlight({ games }) {
  const [mode, setMode] = useState(/** @type {keyof typeof MODES} */ ("genre"));
  const [reduced] = useState(() => prefersReducedMotion());
  const def = MODES[mode];

  const plan = useMemo(() => flightPlan(games, def.keyOf, Object.keys(def.dict)), [games, def]);
  const bySlug = useMemo(() => new Map(games.map((g) => [g.slug, g])), [games]);

  const switcher = (
    <div className={styles.modes} role="group" aria-label="Group the archive by">
      {Object.entries(MODES).map(([key, m]) => (
        <button key={key} type="button" className="chip" aria-pressed={mode === key} onClick={() => setMode(key)}>
          {m.label}
        </button>
      ))}
    </div>
  );

  if (reduced) return <WorldsGrid plan={plan} def={def} bySlug={bySlug} switcher={switcher} />;
  return <Flight key={mode} plan={plan} def={def} bySlug={bySlug} switcher={switcher} />;
}

function Flight({ plan, def, bySlug, switcher }) {
  const track = useRef(/** @type {HTMLDivElement | null} */ (null));
  const stage = useRef(/** @type {HTMLDivElement | null} */ (null));
  const layer = useRef(/** @type {HTMLDivElement | null} */ (null));
  const bar = useRef(/** @type {HTMLDivElement | null} */ (null));
  const nodes = useRef(new Map()); // key → element
  const camera = useRef(0);
  const size = useRef({ w: 1, h: 1 });
  const activeRef = useRef(plan.groups[0]?.key ?? null);
  const inside = useRef(false);
  const [active, setActive] = useState(plan.groups[0]?.key ?? null);

  /** Everything that flies: gates first, then games. */
  const stops = useMemo(
    () => [
      ...plan.groups.map((g) => ({ id: `gate:${g.key}`, depth: g.depth, x: 0, y: 0, gate: true })),
      ...plan.items.map((it) => ({ id: it.slug, depth: it.depth, x: it.x, y: it.y, gate: false })),
    ],
    [plan],
  );

  /** Writes transforms for the current camera depth. No React state in here. */
  const render = useCallback(() => {
    const c = camera.current;
    const { w, h } = size.current;
    const spreadX = w * (w < 700 ? 0.36 : 0.46);
    const spreadY = h * 0.26;
    for (const s of stops) {
      const el = nodes.current.get(s.id);
      if (!el) continue;
      const r = s.depth - c;
      const shown = r > FLIGHT.near && r < FLIGHT.far;
      if (!shown) {
        if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
        continue;
      }
      // gates stay readable until you are right inside them
      const opacity = s.gate ? depthOpacity(r, -0.12, 0.45) : depthOpacity(r);
      el.style.visibility = "visible";
      el.style.opacity = opacity.toFixed(3);
      el.style.pointerEvents = opacity > 0.5 ? "auto" : "none";
      el.style.transform = `translate(-50%, -50%) translate3d(${(s.x * spreadX).toFixed(1)}px, ${(s.y * spreadY).toFixed(1)}px, ${(-r * FLIGHT.unit).toFixed(1)}px)`;
    }
    if (bar.current) bar.current.style.transform = `scaleX(${(c / plan.length).toFixed(4)})`;

    const next = activeGroup(plan.groups, c);
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
      if (inside.current) setSpaceTint(def.colorOf(next));
    }
  }, [stops, plan, def]);

  useGSAP(
    () => {
      const el = stage.current;
      const measure = () => {
        size.current = { w: el.clientWidth, h: el.clientHeight };
        render();
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);

      // The tunnel leans into the direction of travel; settles when scrolling stops.
      const tilt = gsap.quickTo(layer.current, "rotationX", { duration: 0.6, ease: "power3.out" });
      const enter = (on) => {
        inside.current = on;
        setSpaceTint(on ? def.colorOf(activeRef.current) : null);
      };
      ScrollTrigger.create({
        trigger: track.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          camera.current = self.progress * plan.length;
          tilt(scrollVelocity() * -7);
          render();
        },
      });
      // tint a little early, while the stage is still scrolling into place
      ScrollTrigger.create({
        trigger: track.current,
        start: "top 60%",
        end: "bottom 40%",
        onToggle: (self) => enter(self.isActive),
      });

      return () => {
        ro.disconnect();
        setSpaceTint(null);
      };
    },
    { dependencies: [render, plan, def], revertOnUpdate: true },
  );

  // Pointer moves the vanishing point a little: cheap, real parallax.
  const onPointerMove = (e) => {
    const el = stage.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--vx", `${(50 + ((e.clientX - r.left) / r.width - 0.5) * -14).toFixed(2)}%`);
    el.style.setProperty("--vy", `${(50 + ((e.clientY - r.top) / r.height - 0.5) * -14).toFixed(2)}%`);
  };

  /** Scrolls so the camera sits at `depth`. */
  const flyTo = useCallback(
    (depth) => {
      const el = track.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const range = el.offsetHeight - window.innerHeight;
      const y = top + (Math.max(0, Math.min(plan.length, depth)) / plan.length) * range;
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(y, { duration: 1.4 });
      else window.scrollTo({ top: y });
    },
    [plan],
  );

  const onItemFocus = useCallback(
    (depth) => {
      const r = depth - camera.current;
      if (r < 0.25 || r > 1.4) flyTo(depth - 0.7);
    },
    [flyTo],
  );

  const setNode = useCallback((id) => (el) => (el ? nodes.current.set(id, el) : nodes.current.delete(id)), []);
  const activeInfo = plan.groups.find((g) => g.key === active);

  return (
    <div
      ref={track}
      className={styles.track}
      style={{ height: `calc(100svh + ${Math.round(plan.length * FLIGHT.scrollPerDepth)}px)`, "--world": def.colorOf(active) }}
    >
      <div ref={stage} className={styles.stage} onPointerMove={onPointerMove}>
        <div className={styles.tunnel}>
          <div ref={layer} className={styles.layer}>
            {plan.groups.map((g) => (
              <div key={g.key} ref={setNode(`gate:${g.key}`)} className={styles.gate} style={{ "--c": def.colorOf(g.key) }}>
                <span className={styles.ring} aria-hidden="true" />
                <h3 className={styles.gateTitle}>{def.dict[g.key]?.label ?? g.key}</h3>
                <p className={styles.gateCount}>
                  {g.count} {g.count === 1 ? "game" : "games"}
                </p>
              </div>
            ))}
            <FlightItems plan={plan} bySlug={bySlug} def={def} setNode={setNode} onItemFocus={onItemFocus} />
          </div>
        </div>
        <div className={styles.vignette} aria-hidden="true" />

        <div className={styles.hudTop}>
          {switcher}
          <a
            className={styles.skip}
            href="#after-archive"
            onClick={(e) => {
              e.preventDefault();
              flyTo(plan.length);
            }}
          >
            Skip to the end
          </a>
        </div>

        <div className={styles.dock}>
          <div className={styles.readout} aria-live="polite">
            <strong>{def.dict[active]?.label}</strong>
            {activeInfo && (
              <span>
                {activeInfo.count} {activeInfo.count === 1 ? "game" : "games"}
              </span>
            )}
          </div>
          <nav className={styles.rail} aria-label={`Jump to a ${def.noun}`}>
            {plan.groups.map((g) => (
              <button
                key={g.key}
                type="button"
                className={styles.railItem}
                style={{ "--c": def.colorOf(g.key) }}
                aria-current={active === g.key ? "true" : undefined}
                onClick={() => flyTo(g.depth - 0.7)}
              >
                <span className={styles.railDot} aria-hidden="true" />
                <span className={styles.railLabel}>{def.dict[g.key]?.label ?? g.key}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className={styles.progress} aria-hidden="true">
          <div ref={bar} className={styles.bar} />
        </div>
      </div>
    </div>
  );
}

/** The cases. Memoised: they never re-render while flying (only their transforms change). */
const FlightItems = memo(function FlightItems({ plan, bySlug, def, setNode, onItemFocus }) {
  return plan.items.map((it) => {
    const g = bySlug.get(it.slug);
    return (
      <Link
        key={it.slug}
        ref={setNode(it.slug)}
        to={`/game/${g.slug}`}
        className={styles.item}
        style={{ "--c": def.colorOf(it.key) }}
        onFocus={() => onItemFocus(it.depth)}
        draggable="false"
      >
        <span className={styles.case}>
          <BoxArt game={g} size="full" />
        </span>
        <span className={styles.caption}>
          <span className={styles.captionTitle}>{g.title}</span>
          {g.year && <span className={styles.captionYear}>{g.year}</span>}
        </span>
      </Link>
    );
  });
});

/** Reduced-motion version: the same worlds as a calm, grouped grid. */
function WorldsGrid({ plan, def, bySlug, switcher }) {
  useEffect(() => () => setSpaceTint(null), []);
  return (
    <div className={`container ${styles.grid}`}>
      {switcher}
      {plan.groups.map((group) => (
        <section
          key={group.key}
          className={styles.gridGroup}
          style={{ "--c": def.colorOf(group.key) }}
          aria-label={def.dict[group.key]?.label}
        >
          <h3 className={styles.gridTitle}>
            {def.dict[group.key]?.label} <span>{group.count}</span>
          </h3>
          <ul className={styles.gridList}>
            {plan.items
              .filter((it) => it.key === group.key)
              .map((it) => {
                const g = bySlug.get(it.slug);
                return (
                  <li key={it.slug}>
                    <Link to={`/game/${g.slug}`} className={styles.gridCard}>
                      <BoxArt game={g} />
                      <span className={styles.captionTitle}>{g.title}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
