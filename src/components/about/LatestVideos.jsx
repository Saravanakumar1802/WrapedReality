import { useRef } from "react";
import { gsap, useGSAP, MQ, scrollVelocity } from "@/lib/motion.js";
import { channel, channelUrl, durationLabel, timeAgo } from "@/lib/channel.js";
import styles from "./LatestVideos.module.css";

/**
 * The newest uploads as an endless film strip. It drifts on its own, speeds up
 * and leans with your scroll speed, and pauses under the pointer.
 */
export default function LatestVideos() {
  const root = useRef(/** @type {HTMLElement | null} */ (null));
  const reel = useRef(/** @type {HTMLDivElement | null} */ (null));
  const videos = channel.latest ?? [];

  useGSAP(
    () => {
      if (!videos.length) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        // the reel holds the list twice: sliding by half loops seamlessly
        const loop = gsap.to(reel.current, { xPercent: -50, duration: 70, ease: "none", repeat: -1 });
        const skew = gsap.quickTo(reel.current, "skewX", { duration: 0.5, ease: "power3.out" });
        let hovered = false;
        const tick = () => {
          const v = scrollVelocity(2400);
          skew(v * -8);
          if (!hovered) loop.timeScale(gsap.utils.interpolate(loop.timeScale(), 1 + Math.abs(v) * 8, 0.12));
        };
        gsap.ticker.add(tick);
        const enter = () => ((hovered = true), gsap.to(loop, { timeScale: 0, duration: 0.6 }));
        const leave = () => (hovered = false);
        reel.current.addEventListener("pointerenter", enter);
        reel.current.addEventListener("pointerleave", leave);
        const el = reel.current;
        return () => {
          gsap.ticker.remove(tick);
          el.removeEventListener("pointerenter", enter);
          el.removeEventListener("pointerleave", leave);
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  if (!videos.length) return null;
  const now = new Date();
  return (
    <section ref={root} className={styles.section} aria-labelledby="latest-title">
      <div className={`container ${styles.head}`}>
        <div>
          <span className={`hud ${styles.eyebrow}`}>Fresh from the channel</span>
          <h2 id="latest-title" className={styles.h2}>
            Latest videos
          </h2>
        </div>
        <a className="btn" href={`${channelUrl}/videos`} target="_blank" rel="noreferrer">
          All videos on YouTube
        </a>
      </div>
      <div className={styles.viewport}>
        <div ref={reel} className={styles.reel}>
          {[0, 1].map((copy) => (
            <ul key={copy} className={styles.list} aria-hidden={copy === 1 || undefined}>
              {videos.map((v) => (
                <li key={v.id}>
                  <a
                    className={styles.card}
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={copy === 1 ? -1 : undefined}
                  >
                    <span className={styles.thumb}>
                      <img
                        src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width="320"
                        height="180"
                      />
                      {v.duration && <span className={`mono ${styles.duration}`}>{durationLabel(v.duration)}</span>}
                      <span className={styles.play} aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="22" height="22">
                          <path d="M8 5v14l11-7z" fill="currentColor" />
                        </svg>
                      </span>
                    </span>
                    <span className={styles.title}>{v.title}</span>
                    {v.publishedAt && <span className={styles.date}>{timeAgo(v.publishedAt, now)}</span>}
                  </a>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
