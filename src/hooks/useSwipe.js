import { useEffect, useRef } from "react";

/**
 * Pure swipe classifier (exported for tests).
 * @param {number} dx horizontal travel in px (positive = right)
 * @param {number} dy vertical travel in px (positive = down)
 * @param {number} ms gesture duration
 * @returns {"left" | "right" | "up" | "down" | null}
 */
export function classifySwipe(dx, dy, ms, { min = 56, maxMs = 700 } = {}) {
  if (ms > maxMs) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < min) return null;
  if (ax > ay * 1.4) return dx < 0 ? "left" : "right";
  if (ay > ax * 1.4) return dy < 0 ? "up" : "down";
  return null; // diagonal: ambiguous, ignore
}

/**
 * Calls handlers for quick one-finger swipes on an element (touch only, so mouse
 * drags such as spinning a disc are unaffected).
 * @param {{ current: HTMLElement | null }} ref
 * @param {{ left?: () => void, right?: () => void, up?: () => void, down?: () => void }} handlers
 * @param {boolean} enabled
 */
export function useSwipe(ref, handlers, enabled = true) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    /** @type {{ id: number, x: number, y: number, t: number } | null} */
    let start = null;
    const down = (e) => {
      if (e.pointerType !== "touch" || !e.isPrimary) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const up = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dir = classifySwipe(e.clientX - start.x, e.clientY - start.y, performance.now() - start.t);
      start = null;
      if (dir) latest.current[dir]?.();
    };
    const cancel = () => (start = null);
    el.addEventListener("pointerdown", down, { passive: true });
    el.addEventListener("pointerup", up, { passive: true });
    el.addEventListener("pointercancel", cancel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [ref, enabled]);
}
