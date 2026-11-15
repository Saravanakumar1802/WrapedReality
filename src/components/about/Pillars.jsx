import { useRef } from "react";
import { gsap, useGSAP, MQ } from "@/lib/motion.js";
import styles from "./Pillars.module.css";

/** What the channel is about (from its own description), each on the key art of a game that shows it. */
const PILLARS = [
  {
    title: "Epic boss fights",
    text: "Every boss, every phase, every last hit, played out in full.",
    art: "/heroes/black-myth-wukong.webp",
  },
  { title: "Hard mode runs", text: "The highest difficulty, intense combat, no shortcuts.", art: "/heroes/god-of-war-ragnarok.webp" },
  {
    title: "Cinematic stories",
    text: "Story-driven adventures played start to finish, cutscenes and all.",
    art: "/heroes/the-last-of-us-part-ii.webp",
  },
  {
    title: "Tips & builds",
    text: "Honest reactions, practical tips and builds that actually work.",
    art: "/heroes/ghost-of-tsushima.webp",
  },
  { title: "Live streams", text: "Play along live, on PlayStation 5, PlayStation 4 and PC.", art: "/heroes/marvels-spider-man-2.webp" },
];

/**
 * On wide screens the section pins and the cards travel sideways as you scroll,
 * each card's art drifting against the motion. On phones they stack and rise in.
 */
export default function Pillars() {
  const root = useRef(/** @type {HTMLElement | null} */ (null));
  const track = useRef(/** @type {HTMLDivElement | null} */ (null));

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.desktopMotion, () => {
        const q = gsap.utils.selector(root);
        const distance = () => track.current.scrollWidth - window.innerWidth;
        const travel = gsap.to(track.current, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        q("[data-art]").forEach((img) => {
          gsap.fromTo(
            img,
            { xPercent: -8 },
            {
              xPercent: 8,
              ease: "none",
              scrollTrigger: { trigger: img, containerAnimation: travel, start: "left right", end: "right left", scrub: true },
            },
          );
        });
        gsap.from(q("[data-progress]"), {
          scaleX: 0,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, scrub: true },
        });
      });
      mm.add("(max-width: 899px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.utils
          .selector(root)("[data-card]")
          .forEach((card) =>
            gsap.from(card, {
              y: 70,
              autoAlpha: 0,
              duration: 1,
              ease: "expo.out",
              scrollTrigger: { trigger: card, start: "top 88%", once: true },
            }),
          );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className={styles.section} aria-labelledby="pillars-title">
      <div className={`container ${styles.head}`}>
        <span className={`hud ${styles.eyebrow}`}>On the channel</span>
        <h2 id="pillars-title" className={styles.h2}>
          What you&apos;ll find
        </h2>
        <span className={styles.progress} aria-hidden="true">
          <span data-progress />
        </span>
      </div>
      <div ref={track} className={styles.track}>
        {PILLARS.map((p, i) => (
          <article key={p.title} className={styles.card} data-card>
            <img src={p.art} alt="" className={styles.art} data-art loading="lazy" decoding="async" />
            <span className={styles.shade} aria-hidden="true" />
            <span className={styles.num} aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className={styles.body}>
              <h3 className={styles.title}>{p.title}</h3>
              <p className={styles.text}>{p.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
