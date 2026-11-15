// Theme fonts (self-hosted). Unbounded = display; Saira (width axis) = print on cases and discs.
import "@fontsource-variable/unbounded";
import "@fontsource-variable/saira/wdth.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router.jsx";
import { runBoot } from "./lib/boot.js";
import { loadCaseEntry, loadShelfEntry } from "./components/three/canvas/lazy.jsx";

/**
 * Pages with a 3D scene: start downloading the 3D engine right away, in parallel
 * with the page's own code, instead of after the page has rendered (saves a
 * whole round trip on the slowest part of the load).
 */
function preload3d(path) {
  if (/^\/(shelf|genre\/|mood\/|platform\/)/.test(path)) return loadShelfEntry();
  if (/^\/($|game\/)/.test(path)) return loadCaseEntry();
  return null;
}
const engine = preload3d(window.location.pathname);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

runBoot(engine);
