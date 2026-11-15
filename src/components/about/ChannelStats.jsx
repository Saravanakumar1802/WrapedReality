import { useRef } from "react";
import { gsap, useGSAP, MQ } from "@/lib/motion.js";
import { channel, formatCompact } from "@/lib/channel.js";
import { meta } from "@/lib/data.js";
import styles from "./ChannelStats.module.css";

/**
 * The channel in numbers (live from the YouTube API at build time). Each figure
 * counts up from zero as it scrolls in, under a red line that draws across.
 */
export default function ChannelStats() {
  const root = useRef(/** @type {HTMLElement | null} */ (null));
  const s = channel.stats ?? { videos: 0, views: 0 };
  const stats = [
    { value: s.videos, label: "videos uploaded" },
    { value: channel.hours ?? 0, label: "hours of gameplay" },
    { value: s.views, label: "views", compact: true },
    { value: meta.count, label: "games played" },
  ].filter((x) => x.value > 0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const q = gsap.utils.selector(root);
        const trigger = { trigger: root.current, start: "top 78%", once: true };
        gsap.from(q("[data-stat]"), { y: 60, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.1, scrollTrigger: trigger });
        gsap.from(q("[data-line]"), { scaleX: 0, duration: 1.2, ease: "expo.out", stagger: 0.1, scrollTrigger: trigger });
        q("[data-value]").forEach((el) => {
          const end = Number(el.dataset.value);
          const compact = el.dataset.compact === "true";
          const n = { v: 0 };
          gsap.to(n, {
            v: end,
            duration: 2,
            ease: "power3.out",
            scrollTrigger: trigger,
            onUpdate: () => (el.textContent = compact ? formatCompact(n.v) : String(Math.round(n.v))),
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  if (!stats.length) return null;
  return (
    <section ref={root} className={`container ${styles.section}`} aria-label="The channel in numbers">
      <dl className={styles.grid}>
        {stats.map((st) => (
          <div key={st.label} className={styles.stat} data-stat>
            <span className={styles.line} data-line aria-hidden="true" />
            <dd className={styles.value} data-value={st.value} data-compact={st.compact ? "true" : "false"}>
              {st.compact ? formatCompact(st.value) : st.value}
            </dd>
            <dt className={styles.label}>{st.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
