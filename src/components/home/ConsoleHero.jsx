import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CaseCanvas } from "@/components/three/canvas/lazy.jsx";
import BoxArt from "@/components/ui/BoxArt.jsx";
import { GENRES } from "@/data/taxonomy.js";
import { platformTheme } from "@/theme";
import { prefersReducedMotion } from "@/lib/env.js";
import { useUI } from "@/lib/store.js";
import { gsap, useGSAP, MQ, EASE } from "@/lib/motion.js";
import { isBootDone, onBootDone } from "@/lib/boot.js";
import styles from "./ConsoleHero.module.css";

const AUTO_MS = 8000;
const STAGES = ["closed", "open", "inspect"];
const HINTS = { closed: "Open the case", open: "Take out the disc", inspect: "Close it" };

/**
 * The home hero: one featured game at a time, staged like a console's home screen.
 *
 *  - Key art fills the screen. The pointer is a spotlight on it, and when the
 *    game changes the new art opens out in a circle from wherever the pointer is.
 *  - The game's real 3D case floats on a light pedestal: drag to spin it,
 *    click to open it, take the disc out.
 *  - The title runs behind everything as a giant outlined band.
 *  - A cover-flow rail (click, or ← →) switches games; it advances by itself
 *    until the visitor touches anything.
 *  - Scrolling away, the whole hero shrinks into a rounded card and falls back
 *    into the star field.
 */
export default function ConsoleHero({ games, startIndex = 0 }) {
  const [index, setIndex] = useState(startIndex);
  const [prevIndex, setPrevIndex] = useState(startIndex);
  const [stage, setStage] = useState("closed");
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const section = useRef(/** @type {HTMLElement | null} */ (null));
  const card = useRef(/** @type {HTMLDivElement | null} */ (null));
  const rail = useRef(/** @type {HTMLDivElement | null} */ (null));
  const discRef = useRef(null);
  const navigate = useNavigate();
  const paletteOpen = useUI((s) => s.paletteOpen);
  const game = games[index];
  const prev = games[prevIndex];
  const pt = platformTheme(game.platform);

  const focus = useCallback(
    (i, { scroll = true } = {}) => {
      const n = (i + games.length) % games.length;
      setPrevIndex(index);
      setIndex(n);
      setStage("closed");
      if (scroll) {
        // Scroll only the rail horizontally (scrollIntoView would also move the page).
        const r = rail.current;
        const tile = /** @type {HTMLElement | null} */ (r?.querySelector(`[data-index="${n}"]`));
        if (r && tile) {
          r.scrollTo({
            left: tile.offsetLeft - r.clientWidth / 2 + tile.offsetWidth / 2,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        }
      }
    },
    [games.length, index],
  );

  // ── Pointer: spotlight position + parallax, written as CSS variables ──
  useEffect(() => {
    const el = card.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const nx = (x - r.left) / r.width;
      const ny = (y - r.top) / r.height;
      el.style.setProperty("--sx", `${(nx * 100).toFixed(2)}%`);
      el.style.setProperty("--sy", `${(ny * 100).toFixed(2)}%`);
      el.style.setProperty("--mx", (nx * 2 - 1).toFixed(3));
      el.style.setProperty("--my", (ny * 2 - 1).toFixed(3));
    };
    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      raf ||= requestAnimationFrame(apply);
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── Entrance for each game: logo wipes in, the rest rises behind it ──
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        // on first load this waits for the boot loader to leave, so the entrance is seen
        const tl = gsap.timeline({ paused: !isBootDone() });
        tl.from(`.${styles.copy} > *`, { y: 44, autoAlpha: 0, duration: 0.9, ease: EASE.out, stagger: 0.07, clearProps: "all" }, 0)
          .from(
            `.${styles.logoWrap}, .${styles.title}`,
            { clipPath: "inset(0 100% 0 0)", duration: 1.1, ease: EASE.inOut, clearProps: "clipPath" },
            0,
          )
          .from(`.${styles.ghostTrack}`, { xPercent: 12, autoAlpha: 0, duration: 1.4, ease: EASE.out }, 0);
        return onBootDone(() => tl.play());
      });
      return () => mm.revert();
    },
    { scope: section, dependencies: [index], revertOnUpdate: true },
  );

  // ── Scrolling away: the hero becomes a card that shrinks into space ──
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: section.current, start: "top top", end: "bottom top", scrub: 0.4 },
        });
        tl.to(card.current, { scale: 0.82, borderRadius: 44, autoAlpha: 0.12, yPercent: -4 }, 0)
          .to(`.${styles.backdrop}`, { scale: 1.2 }, 0)
          .to(`.${styles.ghost}`, { xPercent: -24 }, 0)
          .to(`.${styles.grid}`, { yPercent: -10 }, 0)
          .to(`.${styles.railWrap}`, { yPercent: 60, autoAlpha: 0 }, 0);
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  // Only animate while the hero is on screen.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Gentle auto-advance until the visitor interacts.
  useEffect(() => {
    if (paused || !inView || prefersReducedMotion()) return;
    const id = setTimeout(() => focus(index + 1), AUTO_MS);
    return () => clearTimeout(id);
  }, [index, paused, inView, focus]);

  // ← → switch games from anywhere while the hero is on screen.
  useEffect(() => {
    if (!inView || paletteOpen) return;
    const onKey = (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (/** @type {HTMLElement} */ (e.target).closest("input, textarea, select, dialog, [contenteditable]")) return;
      e.preventDefault();
      setPaused(true);
      focus(index + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inView, paletteOpen, index, focus]);

  const backdrop = (g) => (g.hero ? { src: g.hero, kind: "hero" } : { src: g.cover, kind: "cover" });
  const cur = backdrop(game);
  const old = backdrop(prev);

  return (
    <section ref={section} className={styles.hero} aria-label="Featured game" style={{ "--accent-game": game.palette?.[0] }}>
      <div className={styles.pin}>
        <div ref={card} className={styles.card} onPointerDown={() => setPaused(true)} onFocusCapture={() => setPaused(true)}>
          {/* Backdrop: the previous art stays under the new one while it opens out from the pointer */}
          <div className={styles.backdrop} aria-hidden="true">
            {old.src && prevIndex !== index && (
              <img key={`old-${prev.slug}`} className={styles.bg} data-kind={old.kind} src={old.src} alt="" />
            )}
            {cur.src && (
              <img
                key={game.slug}
                className={`${styles.bg} ${styles.bgIn}`}
                data-kind={cur.kind}
                src={cur.src}
                alt=""
                fetchPriority="high"
                data-boot-media
              />
            )}
          </div>
          <div className={styles.spot} aria-hidden="true" />
          <div className={styles.scrim} aria-hidden="true" />

          {/* The title as a giant outlined band behind the case */}
          <div className={styles.ghost} aria-hidden="true">
            <div className={styles.ghostTrack} key={game.slug}>
              <span>{game.title}</span>
              <span>{game.title}</span>
              <span>{game.title}</span>
            </div>
          </div>

          <div className={`container ${styles.grid}`}>
            <div className={styles.copy} key={`copy-${game.slug}`}>
              <p className={styles.counter}>
                <span className={styles.count}>
                  {String(index + 1).padStart(2, "0")}
                  <span> / {games.length}</span>
                </span>
                <span className={styles.progress} key={`p-${game.slug}`} data-paused={paused || undefined} aria-hidden="true" />
              </p>

              {game.logo ? (
                <h1 className={styles.logoWrap}>
                  <img className={styles.logo} data-dark={game.logoDark || undefined} src={game.logo} alt={game.title} />
                </h1>
              ) : (
                <h1 className={styles.title}>{game.title}</h1>
              )}

              <div className={styles.meta}>
                {pt.mark ? <img className={`ps-mark ${styles.metaMark}`} src={pt.mark} alt={pt.name} /> : <span>{pt.label}</span>}
                <span className={styles.metaDot} style={{ "--c": `var(--genre-${game.primaryGenre})` }}>
                  {GENRES[game.primaryGenre]?.label}
                </span>
                {game.year && <span className={styles.metaYear}>{game.year}</span>}
              </div>

              <p className={styles.summary}>{game.summary}</p>

              <div className={styles.ctas}>
                <Link to={`/game/${game.slug}`} className="btn btn-primary">
                  Open the journal
                </Link>
                <Link to="/shelf" className="btn">
                  Browse the shelf
                </Link>
              </div>
            </div>

            <div className={styles.stage}>
              <div className={styles.pedestal} aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <CaseCanvas
                transparent
                game={game}
                stage={stage}
                discRef={discRef}
                onCaseClick={() => {
                  setPaused(true);
                  setStage((s) => (s === "closed" ? "open" : s === "open" ? "closed" : s));
                }}
                onDiscClick={() => setStage((s) => (s === "open" ? "inspect" : s))}
                fallback={
                  <div className={styles.stageFallback}>
                    <BoxArt game={game} size="full" eager />
                  </div>
                }
                loading={
                  <div className={styles.stageFallback}>
                    <BoxArt game={game} size="full" eager />
                  </div>
                }
              />
              <div className={styles.stageBar}>
                <span className={styles.stageTip}>{stage === "inspect" ? "Drag the disc. Double-click flips it." : "Drag to spin"}</span>
                <button
                  type="button"
                  className={styles.stageHint}
                  onClick={() => {
                    setPaused(true);
                    setStage((s) => STAGES[(STAGES.indexOf(s) + 1) % STAGES.length]);
                  }}
                >
                  {HINTS[stage]}
                </button>
              </div>
            </div>
          </div>

          <a className={styles.scrollCue} href="#archive" aria-label="Scroll to the archive">
            <span>Scroll to fly</span>
            <i aria-hidden="true" />
          </a>

          <div className={styles.railWrap}>
            <div
              ref={rail}
              className={styles.rail}
              role="listbox"
              aria-label="Games"
              aria-activedescendant={`tile-${game.slug}`}
              tabIndex={0}
              data-lenis-prevent
            >
              {games.map((g, i) => (
                <button
                  key={g.slug}
                  id={`tile-${g.slug}`}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  aria-label={g.title}
                  data-index={i}
                  tabIndex={-1}
                  className={styles.tile}
                  style={{ "--d": i - index }}
                  onClick={() => {
                    setPaused(true);
                    if (i === index) navigate(`/game/${g.slug}`);
                    else focus(i, { scroll: false });
                  }}
                >
                  <BoxArt game={g} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
