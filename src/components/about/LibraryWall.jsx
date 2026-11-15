import { useMemo, useRef } from "react";
import { Link } from "react-router";
import { gsap, useGSAP, MQ } from "@/lib/motion.js";
import { getLiteGames, platformList } from "@/lib/data.js";
import { platformTheme } from "@/theme";
import styles from "./LibraryWall.module.css";

const COLUMNS = 7;

/**
 * Every game played, as a tilted wall of real covers whose columns drift in
 * opposite directions as you scroll, plus a bar per platform.
 */
export default function LibraryWall() {
  const root = useRef(/** @type {HTMLElement | null} */ (null));
  const games = getLiteGames();
  const platforms = platformList().filter((p) => p.count > 0);
  const max = Math.max(...platforms.map((p) => p.count));
  const columns = useMemo(() => {
    const withArt = games.filter((g) => g.thumb);
    return Array.from({ length: COLUMNS }, (_, c) => withArt.filter((_, i) => i % COLUMNS === c).slice(0, 8));
  }, [games]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const q = gsap.utils.selector(root);
        q("[data-col]").forEach((col, i) => {
          const dir = i % 2 ? 1 : -1;
          gsap.fromTo(
            col,
            { yPercent: dir * 12 },
            {
              yPercent: dir * -12,
              ease: "none",
              scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        });
        gsap.from(q("[data-bar]"), {
          scaleX: 0,
          duration: 1.4,
          ease: "expo.out",
          stagger: 0.12,
          scrollTrigger: { trigger: q("[data-bars]")[0], start: "top 80%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className={styles.section} aria-labelledby="library-title">
      <div className={styles.wall} aria-hidden="true">
        <div className={styles.plane}>
          {columns.map((col, i) => (
            <div key={i} className={styles.col} data-col>
              {col.map((g) => (
                <img key={g.slug} src={g.thumb} alt="" loading="lazy" decoding="async" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={`container ${styles.content}`}>
        <span className={`hud ${styles.eyebrow}`}>The library</span>
        <h2 id="library-title" className={styles.h2}>
          {games.length} games.
          <br />
          One shelf.
        </h2>
        <p className={styles.lede}>Every game from the channel, as its real case. Pull one out, open it, and watch the playthrough.</p>

        <ul className={styles.bars} data-bars>
          {platforms.map((p) => {
            const pt = platformTheme(p.key);
            return (
              <li key={p.key}>
                <span className={styles.platform}>{pt.mark ? <img src={pt.mark} alt={pt.name} className="ps-mark" /> : pt.label}</span>
                <span className={styles.track}>
                  <span className={styles.bar} data-bar style={{ width: `${(p.count / max) * 100}%` }} />
                </span>
                <span className={`mono ${styles.count}`}>{p.count}</span>
              </li>
            );
          })}
        </ul>

        <Link to="/shelf" className="btn btn-primary">
          Pull one off the shelf
        </Link>
      </div>
    </section>
  );
}
