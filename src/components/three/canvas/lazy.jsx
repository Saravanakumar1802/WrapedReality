import { Suspense, lazy } from "react";

/**
 * Canvas entry points, code-split per scene: three.js, R3F and postprocessing
 * load only on pages that render a 3D scene, and each scene's own code only
 * where it is used.
 */
export const loadShelfEntry = () => import("./entries/ShelfEntry.jsx");
export const loadCaseEntry = () => import("./entries/CaseEntry.jsx");
export const loadConsoleEntry = () => import("./entries/ConsoleEntry.jsx");

const LazyShelf = lazy(loadShelfEntry);
const LazyCase = lazy(loadCaseEntry);
const LazyConsole = lazy(loadConsoleEntry);

/** @param {{ loading?: import("react").ReactNode, [key: string]: any }} props */
export function ShelfCanvas({ loading = null, ...props }) {
  return (
    <Suspense fallback={loading}>
      <LazyShelf {...props} />
    </Suspense>
  );
}

/** @param {{ loading?: import("react").ReactNode, [key: string]: any }} props */
export function CaseCanvas({ loading = null, ...props }) {
  return (
    <Suspense fallback={loading}>
      <LazyCase {...props} />
    </Suspense>
  );
}

/** @param {{ loading?: import("react").ReactNode, [key: string]: any }} props */
export function ConsoleCanvas({ loading = null, ...props }) {
  return (
    <Suspense fallback={loading}>
      <LazyConsole {...props} />
    </Suspense>
  );
}
