import { useLocation } from "react-router";
import { gsap, ScrollTrigger, SplitText, useGSAP, MQ, EASE } from "@/lib/motion.js";

/**
 * Declarative scroll effects for any page. Mark an element up, no JS needed:
 *
 *   data-fx="lines"     heading lines rise out of a mask when they enter
 *   data-fx="words"     words light up one by one as you scroll through (scrubbed)
 *   data-fx="rise"      fades up on enter; children with data-fx-item stagger
 *   data-fx="parallax"  drifts against the scroll; data-speed="-0.2" sets how far
 *   data-fx="count"     counts up to the number in the element
 *
 * Runs once per route (after the page has rendered) and cleans itself up. With
 * reduced motion nothing is registered, so content simply shows.
 */
export default function ScrollFx() {
  const { pathname } = useLocation();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const all = (sel) => gsap.utils.toArray(sel);

        all('[data-fx="lines"]').forEach((el) => {
          SplitText.create(el, {
            type: "lines",
            mask: "lines",
            autoSplit: true, // re-split when fonts load or the width changes
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 110,
                duration: 1.1,
                ease: EASE.out,
                stagger: 0.09,
                scrollTrigger: { trigger: el, start: "top 88%", once: true },
              }),
          });
        });

        all('[data-fx="words"]').forEach((el) => {
          SplitText.create(el, {
            type: "words",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.words, {
                opacity: 0.16,
                stagger: 0.08,
                ease: "none",
                scrollTrigger: { trigger: el, start: "top 86%", end: "bottom 52%", scrub: 0.4 },
              }),
          });
        });

        all('[data-fx="rise"]').forEach((el) => {
          const items = el.querySelectorAll("[data-fx-item]");
          gsap.from(items.length ? items : el, {
            y: 48,
            autoAlpha: 0,
            duration: 1,
            ease: EASE.out,
            stagger: 0.07,
            scrollTrigger: { trigger: el, start: "top 86%", once: true },
          });
        });

        all('[data-fx="parallax"]').forEach((el) => {
          const speed = Number(el.dataset.speed ?? -0.15);
          gsap.fromTo(
            el,
            { yPercent: -speed * 100 },
            { yPercent: speed * 100, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
          );
        });

        all('[data-fx="count"]').forEach((el) => {
          const end = Number(el.textContent);
          if (!Number.isFinite(end)) return;
          const n = { v: 0 };
          gsap.to(n, {
            v: end,
            duration: 1.6,
            ease: "power2.out",
            snap: { v: 1 },
            onUpdate: () => (el.textContent = String(n.v)),
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        });
      });
      // Images and lazy canvases settle after first paint; re-measure trigger positions.
      const id = setTimeout(() => ScrollTrigger.refresh(), 600);
      return () => {
        clearTimeout(id);
        mm.revert();
      };
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return null;
}
