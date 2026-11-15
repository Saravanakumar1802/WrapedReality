/**
 * One place that registers GSAP plugins, so every component imports the same
 * configured instance: `import { gsap, ScrollTrigger, useGSAP } from "@/lib/motion.js"`.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { theme } from "@/theme";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/** Media queries shared by scroll effects (use with gsap.matchMedia). */
export const MQ = {
  motion: "(prefers-reduced-motion: no-preference)",
  desktopMotion: "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
};

export const EASE = { out: String(theme.motion.easeOut), inOut: String(theme.motion.easeInOut) };

/** Scroll speed in px/s, clamped to ±max and normalised to -1..1. */
export function scrollVelocity(max = 2600) {
  const v = ScrollTrigger.getVelocity?.() ?? 0;
  return Math.max(-1, Math.min(1, v / max));
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
