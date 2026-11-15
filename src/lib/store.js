import { create } from "zustand";

/** UI state shared between DOM and 3D. Keep it tiny; 3D per-frame values use refs, not state. */
export const useUI = create((set) => ({
  /** Feel-search hits (slugs), for any view that wants to highlight them */
  highlighted: /** @type {string[]} */ ([]),
  setHighlighted: (highlighted) => set({ highlighted }),

  /** Hovered constellation dot { slug, x, y } in screen px */
  hover: /** @type {null | { slug: string, x: number, y: number }} */ (null),
  setHover: (hover) => set({ hover }),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  sound: false,
  toggleSound: () => set((s) => ({ sound: !s.sound })),

  /** "high" | "low" — lowered by PerformanceMonitor on slow devices */
  quality: /** @type {"high" | "low"} */ ("high"),
  setQuality: (quality) => set({ quality }),
}));
