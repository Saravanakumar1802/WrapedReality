import { useRef } from "react";
import { Link } from "react-router";
import { gsap, useGSAP } from "@/lib/motion.js";
import BoxArt from "@/components/ui/BoxArt.jsx";
import { GENRES, MOODS } from "@/data/taxonomy.js";
import styles from "./JourneyTrack.module.css";

const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/**
 * Horizontal, scroll-pinned timeline on wide screens (vertical list on narrow
 * screens and with reduced motion — handled by gsap.matchMedia).
 */
export default function JourneyTrack({ games }) {
  const section = useRef(/** @type {HTMLElement | null} */ (null));
  const track = useRef(/** @type {HTMLOListElement | null} */ (null));
  const bar = useRef(/** @type {HTMLDivElement | null} */ (null));

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        const el = track.current;
        const distance = () => Math.max(0, el.scrollWidth - window.innerWidth + 64);
        gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => bar.current && (bar.current.style.transform = `scaleX(${self.progress})`),
          },
        });
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section ref={section} className={styles.section} aria-label="Games in the order I played them">
      <div className={styles.progress} aria-hidden="true">
        <div ref={bar} className={styles.bar} />
      </div>
      <ol ref={track} className={styles.track}>
        {games.map((g, i) => (
          <li key={g.slug} className={styles.item} style={{ "--c": `var(--mood-${g.primaryMood})` }}>
            <span className={styles.index}>{String(i + 1).padStart(2, "0")}</span>
            <Link to={`/game/${g.slug}`} className={styles.card}>
              <BoxArt game={g} />
              <span className={styles.title}>{g.title}</span>
            </Link>
            <span className={styles.meta}>
              {g.firstVideoAt ? fmtDate(g.firstVideoAt) : g.platform} <span className={styles.mood}>{MOODS[g.primaryMood]?.label}</span>
            </span>
            <span className={styles.genre}>{GENRES[g.primaryGenre]?.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
