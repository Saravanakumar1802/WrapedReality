import { useRef } from "react";
import { gsap, scrollVelocity, useGSAP, MQ } from "@/lib/motion.js";
import styles from "./TitleMarquee.module.css";

const BASE_SPEED = 46; // px per second at rest
const BOOST = 900; // extra px per second at full scroll speed

/**
 * Two bands of game titles sliding in opposite directions. They idle slowly and
 * surge (and lean) with the scroll speed, so the page feels like it has momentum.
 * Decorative: the same titles are reachable everywhere else, so it is aria-hidden.
 */
export default function TitleMarquee({ titles }) {
  const root = useRef(/** @type {HTMLDivElement | null} */ (null));
  const half = Math.ceil(titles.length / 2);
  const rows = [titles.slice(0, half), titles.slice(half)];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const tracks = gsap.utils.toArray(`.${styles.track}`, root.current);
        const offsets = tracks.map(() => 0);
        let visible = false;
        const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "100px" });
        io.observe(root.current);
        let lean = 0;

        const tick = (_, deltaMs) => {
          if (!visible) return;
          const dt = Math.min(0.05, deltaMs / 1000);
          const v = scrollVelocity();
          lean += (v * -9 - lean) * Math.min(1, dt * 6);
          tracks.forEach((el, i) => {
            const dir = i % 2 === 0 ? -1 : 1;
            const loop = el.scrollWidth / 2; // content is rendered twice
            offsets[i] = (offsets[i] + dir * (BASE_SPEED + Math.abs(v) * BOOST) * dt) % loop;
            const x = dir < 0 ? offsets[i] : offsets[i] - loop;
            el.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) skewX(${lean.toFixed(2)}deg)`;
          });
        };
        gsap.ticker.add(tick);
        return () => {
          gsap.ticker.remove(tick);
          io.disconnect();
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={styles.marquee} aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r} className={styles.row}>
          <div className={styles.track}>
            {[0, 1].map((copy) =>
              row.map((t, i) => (
                <span key={`${copy}-${t}`} className={styles.word} data-outline={(i + r) % 2 === 0 || undefined}>
                  {t}
                  <i className={styles.disc} />
                </span>
              )),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
