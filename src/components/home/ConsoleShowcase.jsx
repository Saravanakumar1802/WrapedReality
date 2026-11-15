import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ConsoleCanvas } from "@/components/three/canvas/lazy.jsx";
import { getLenis } from "@/components/ui/SmoothScroll.jsx";
import { platformList } from "@/lib/data.js";
import { ScrollTrigger, useGSAP } from "@/lib/motion.js";
import { setSpaceTint } from "@/lib/space.js";
import { sfx } from "@/lib/sound.js";
import { platformTheme, theme } from "@/theme";
import styles from "./ConsoleShowcase.module.css";

/**
 * The machines, in stage order. `year` is the model's first release; `shelf` is the
 * platform whose games it plays (for the count and the shelf link).
 */
const CONSOLES = [
  { key: "PS5", year: 2020, line: "The current generation: two white plates around a black core, and the newest games in this journal." },
  { key: "PS4", year: 2013, line: "The biggest shelf in this journal. Most of the collection was played on this slanted black slab." },
  {
    key: "PS2",
    name: "PlayStation 2 Slim",
    year: 2004,
    line: "The slim redesign of the best-selling console ever made. Its games are next in line to be added to the journal.",
  },
  {
    key: "ROG",
    name: "ROG Strix Scar 17",
    year: 2023,
    shelf: "PC",
    color: theme.scene.consoles.rog.on,
    line: "The gaming laptop: a 17-inch Strix Scar with a light bar that wraps the whole chassis. Switch it on to wake the screen and the full rainbow.",
  },
];
const PLATFORMS = CONSOLES.map((c) => c.key);

/**
 * "The machines": a pinned stage with one console at a time. Scrolling swaps
 * consoles (each spins in and out), dragging spins the one on stage, and a click
 * (or the power button) boots it: the status lights run their real start-up colours.
 */
export default function ConsoleShowcase() {
  const track = useRef(/** @type {HTMLDivElement | null} */ (null));
  const motion = useRef({ position: 0, yaw: 0, pitch: 0, dragging: false });
  const drag = useRef({ id: -1, x: 0, y: 0, vx: 0 });
  const [active, setActive] = useState(0);
  const [power, setPower] = useState(/** @type {Record<string, boolean>} */ ({}));
  const activeRef = useRef(0);
  const [loadModels, setLoadModels] = useState(false);

  // Start the 3D stage and its model downloads about two screens before the section arrives.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setLoadModels(true);
        io.disconnect();
      },
      { rootMargin: "200% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const counts = useMemo(() => Object.fromEntries(platformList().map((p) => [p.key, p.count])), []);
  const accents = useMemo(() => Object.fromEntries(CONSOLES.map((c) => [c.key, c.color ?? platformTheme(c.key).led])), []);

  useGSAP(
    () => {
      const tint = (on) => setSpaceTint(on ? accents[PLATFORMS[activeRef.current]] : null);
      ScrollTrigger.create({
        trigger: track.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const position = self.progress * (CONSOLES.length - 1);
          motion.current.position = position;
          const next = Math.round(position);
          if (next !== activeRef.current) {
            activeRef.current = next;
            setActive(next);
            // each console starts from its best angle
            motion.current.yaw = 0;
            motion.current.pitch = 0;
            tint(true);
          }
        },
      });
      ScrollTrigger.create({ trigger: track.current, start: "top 55%", end: "bottom 45%", onToggle: (self) => tint(self.isActive) });
      return () => setSpaceTint(null);
    },
    { dependencies: [accents] },
  );

  // Drag anywhere on the stage to spin the console (horizontal) and tip it (vertical).
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.vx = dx;
      motion.current.yaw += dx * 0.011;
      motion.current.pitch = Math.max(-0.5, Math.min(0.7, motion.current.pitch + dy * 0.006));
    };
    const up = (e) => {
      const d = drag.current;
      if (e.pointerId !== d.id) return;
      d.id = -1;
      motion.current.dragging = false;
      motion.current.yaw += d.vx * 0.09; // a flick keeps turning a little
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const onPointerDown = (e) => {
    if (e.target.closest("a, button")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: 0 };
    motion.current.dragging = true;
  };

  const toggle = useCallback(
    (key) => {
      (power[key] ? sfx.back : sfx.disc)();
      setPower((p) => ({ ...p, [key]: !p[key] }));
    },
    [power],
  );

  const goTo = (i) => {
    const el = track.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const y = top + (i / (CONSOLES.length - 1)) * (el.offsetHeight - window.innerHeight);
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y });
  };

  return (
    <section className={styles.section} aria-labelledby="machines-title">
      <div ref={track} className={styles.track} style={{ "--n": CONSOLES.length }}>
        <div className={styles.stage} style={{ "--accent-console": accents[PLATFORMS[active]] }} onPointerDown={onPointerDown}>
          {/* the release year, huge, behind the console */}
          <div className={styles.years} aria-hidden="true">
            {CONSOLES.map((c, i) => (
              <span key={c.key} data-active={i === active || undefined}>
                {c.year}
              </span>
            ))}
          </div>

          <div className={styles.canvas}>
            {/* mounted (with its 3D engine and models) only once the section is about two screens away */}
            {loadModels && (
              <ConsoleCanvas platforms={PLATFORMS} power={power} accents={accents} motion={motion} onToggle={toggle} loadModels />
            )}
          </div>

          <div className={`container ${styles.copy}`}>
            <h2 id="machines-title" className={styles.kicker}>
              The machines
            </h2>
            <div className={styles.panels}>
              {CONSOLES.map((c, i) => {
                const name = c.name ?? platformTheme(c.key).name;
                const shelf = c.shelf ?? c.key;
                const count = counts[shelf] ?? 0;
                const on = Boolean(power[c.key]);
                const shown = i === active;
                return (
                  <article key={c.key} className={styles.panel} data-active={shown || undefined} aria-hidden={!shown} inert={!shown}>
                    <h3 className={styles.name}>{name}</h3>
                    <p className={styles.line}>{c.line}</p>
                    <dl className={styles.facts}>
                      <div>
                        <dt>Released</dt>
                        <dd>{c.year}</dd>
                      </div>
                      <div>
                        <dt>In this journal</dt>
                        <dd>{count > 0 ? `${count} games` : "Coming soon"}</dd>
                      </div>
                    </dl>
                    <div className={styles.actions}>
                      <button type="button" className={`btn ${styles.power}`} aria-pressed={on} onClick={() => toggle(c.key)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 3v9M6.3 7.2a8 8 0 1 0 11.4 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                        {on ? "Power off" : "Power on"}
                      </button>
                      {count > 0 && (
                        <Link to={`/platform/${shelf.toLowerCase()}`} className="btn btn-primary">
                          Open the {shelf} shelf
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className={styles.dock}>
            <p className={styles.hint}>Drag to spin it. Click it to power on.</p>
            <div className={styles.pager} role="group" aria-label="Choose a console">
              {CONSOLES.map((c, i) => (
                <button key={c.key} type="button" aria-current={i === active ? "true" : undefined} onClick={() => goTo(i)}>
                  {c.key}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
