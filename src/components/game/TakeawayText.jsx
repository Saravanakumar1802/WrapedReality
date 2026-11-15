import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/env.js";
import styles from "./TakeawayText.module.css";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

/** The written takeaway, revealed line by line as it scrolls into view. */
export default function TakeawayText({ paragraphs, summary }) {
  const root = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !paragraphs.length) return;
      const split = SplitText.create("p", { type: "lines", mask: "lines", autoSplit: true });
      gsap.from(split.lines, {
        yPercent: 100,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.06,
        scrollTrigger: { trigger: root.current, start: "top 80%", once: true },
      });
      return () => split.revert();
    },
    { scope: root },
  );

  if (!paragraphs.length) {
    return (
      <div className={styles.pending}>
        <p className={styles.lead}>{summary}</p>
        <p className="muted">My takeaway for this one is coming soon.</p>
      </div>
    );
  }

  return (
    <div ref={root} className={styles.text}>
      {paragraphs.map((p, i) => (
        <p key={i} className={i === 0 ? styles.lead : undefined}>
          {p}
        </p>
      ))}
    </div>
  );
}
