import { useRef } from "react";
import { gsap, SplitText, useGSAP, MQ } from "@/lib/motion.js";
import styles from "./Manifesto.module.css";

/**
 * The channel's creed, in its own words. On wide screens the section pins and
 * each word lights up as you scroll, while a giant outlined "BATTLEFIELD" slides
 * behind it. On phones the words light up in place, without pinning.
 */
export default function Manifesto() {
  const root = useRef(/** @type {HTMLElement | null} */ (null));

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ desktop: MQ.desktopMotion, phone: "(max-width: 899px) and (prefers-reduced-motion: no-preference)" }, (ctx) => {
        const q = gsap.utils.selector(root);
        const split = SplitText.create(q("[data-words]"), { type: "words" });
        const pinned = ctx.conditions.desktop;
        const tl = gsap.timeline({
          scrollTrigger: pinned
            ? { trigger: root.current, start: "top top", end: "+=140%", pin: true, scrub: 0.5 }
            : { trigger: root.current, start: "top 75%", end: "bottom 60%", scrub: 0.5 },
        });
        tl.from(split.words, { opacity: 0.12, stagger: 0.1, ease: "none" }, 0).fromTo(
          q("[data-ghost]"),
          { xPercent: 12 },
          { xPercent: -38, ease: "none", duration: split.words.length * 0.1 },
          0,
        );
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className={styles.section} aria-label="The channel's creed">
      <span className={styles.ghost} data-ghost aria-hidden="true">
        Battlefield
      </span>
      <div className="container">
        <span className={`hud ${styles.eyebrow}`}>The creed</span>
        <p className={styles.text} data-words>
          This is more than a channel. This is a <em>battlefield</em> where legends are forged, <em>bosses fall</em> and every battle tells
          a story. Not just gameplay. <em>Pure gaming adrenaline</em>
        </p>
      </div>
    </section>
  );
}
