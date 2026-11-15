/** Browser capability checks (safe to call during render on the client only). */

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Whether the browser has the WebGL 2 API at all. Deliberately does not create a
 * test context: on Windows that costs as much as a real one (over a second on
 * some machines), and the 3D canvas creates the real one right after anyway. A
 * device that has the API but can't open a context (GPU blocklisted) is caught
 * by SceneCanvas's error boundary, which shows the same fallback.
 */
export function hasWebGL2() {
  return typeof window !== "undefined" && typeof window.WebGL2RenderingContext === "function";
}

export function isLowEndDevice() {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = /** @type {any} */ (navigator).deviceMemory ?? 8;
  return cores <= 4 || mem <= 4;
}

export function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** localStorage that never throws (private mode, blocked storage). */
export const safeStorage = {
  get(key, fallback = null) {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};
