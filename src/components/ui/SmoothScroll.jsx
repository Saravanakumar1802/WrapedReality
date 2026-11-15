import { useEffect } from "react";
import { useLocation } from "react-router";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/motion.js";
import { prefersReducedMotion } from "@/lib/env.js";

/** @type {Lenis | null} */
let lenis = null;
export const getLenis = () => lenis;

/** Lenis smooth scroll driven by the GSAP ticker so ScrollTrigger stays in sync. Off for reduced motion. */
export default function SmoothScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (prefersReducedMotion()) return;
    lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  // React Router's <ScrollRestoration> decides the position (top for new pages,
  // restored for back/forward). Lenis just adopts it so it doesn't animate away.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
