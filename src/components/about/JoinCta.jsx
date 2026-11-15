import { useRef } from "react";
import { gsap, SplitText, useGSAP, MQ, EASE } from "@/lib/motion.js";
import { channel, subscribeUrl } from "@/lib/channel.js";
import styles from "./JoinCta.module.css";

/** The closing call: the line rolls in letter by letter, then the subscribe button glows. */
export default function JoinCta() {
  const root = useRef(/** @type {HTMLElement | null} */ (null));
  const subs = channel.stats?.subscribers;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const q = gsap.utils.selector(root);
        const split = SplitText.create(q("[data-line]"), { type: "chars", mask: "chars" });
        const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 70%", once: true } });
        tl.from(split.chars, { yPercent: 110, duration: 0.9, ease: EASE.out, stagger: 0.025 }).from(
          q("[data-after]"),
          { y: 24, autoAlpha: 0, duration: 0.8, ease: EASE.out, stagger: 0.1 },
          "-=0.4",
        );
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className={styles.section} aria-labelledby="join-title">
      <div className={`container ${styles.inner}`}>
        {channel.avatar && <img className={styles.avatar} src={channel.avatar} alt="" width="96" height="96" loading="lazy" data-after />}
        <h2 id="join-title" className={styles.h2} data-line>
          Let&apos;s level up together.
        </h2>
        <p className={styles.meta} data-after>
          {subs ? `Join ${subs} subscribers. ` : ""}New videos regularly, live streams, pure gaming energy.
        </p>
        <a className={`btn ${styles.subscribe}`} href={subscribeUrl} target="_blank" rel="noreferrer" data-after>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-4.8.5-4.8s0-3.2-.5-4.8ZM9.8 15V9l5.8 3-5.8 3Z"
              fill="currentColor"
            />
          </svg>
          Subscribe to {channel.title ?? "the channel"}
        </a>
      </div>
    </section>
  );
}
