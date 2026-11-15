/**
 * Talks to the boot loader in index.html (window.__boot).
 *
 * main.jsx drives the sequence: the route's page renders → fonts → the 3D engine
 * (on pages that use it) → the page's key image (`<img data-boot-media>`), then
 * the loader leaves. Each step is capped, so a slow network only shortens the
 * wait, never blocks the site.
 */

const boot = () => (typeof window === "undefined" ? null : window.__boot);

/** Advance the loader's dial (0..1) and say what is loading. */
export const bootStage = (progress, label) => boot()?.stage(progress, label);

/** Has the loader already left? (true when there is no loader at all) */
export const isBootDone = () => !boot() || boot().isDone;

/** Run `fn` once the loader has left (immediately if it already has). Returns an unsubscribe. */
export function onBootDone(fn) {
  if (isBootDone()) {
    fn();
    return () => {};
  }
  window.addEventListener("boot:done", fn, { once: true });
  return () => window.removeEventListener("boot:done", fn);
}

let routeReady;
const routeReadyPromise = new Promise((resolve) => (routeReady = resolve));
/** Called by every page once it has rendered (see router.jsx). */
export const markRouteReady = () => routeReady();

const capped = (promise, ms) => Promise.race([promise, new Promise((r) => setTimeout(r, ms))]);

/** Resolves when the page's key images (marked data-boot-media) have loaded or failed. */
function mediaReady() {
  const imgs = [...document.querySelectorAll("img[data-boot-media]")];
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? null
        : new Promise((r) => {
            img.addEventListener("load", r, { once: true });
            img.addEventListener("error", r, { once: true });
          }),
    ),
  );
}

/**
 * The boot sequence. `engine` is the 3D chunk's import promise on pages that
 * use 3D (started early in main.jsx so it downloads in parallel), or null.
 */
export async function runBoot(engine) {
  if (!boot()) return;
  bootStage(0.3, "Loading the page");
  await capped(routeReadyPromise, 5000);
  bootStage(0.5, "Loading fonts");
  await capped(document.fonts?.ready ?? Promise.resolve(), 1500);
  if (engine) {
    bootStage(0.62, "Loading the 3D engine");
    await capped(
      engine.catch(() => null),
      4000,
    );
  }
  bootStage(0.84, "Loading artwork");
  await capped(mediaReady(), 2500);
  boot()?.finish();
}
