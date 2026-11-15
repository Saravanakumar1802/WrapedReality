/**
 * Client for the semantic search worker (src/workers/semanticSearch.worker.js).
 * One worker and one copy of the model per visit, shared by every search box.
 */

/** Search indexes written by `npm run data`. */
export const INDEX = {
  games: (dim) => ({ name: "games", url: "/data/vectors.bin", format: "f32", dim }),
  moments: (dim) => ({ name: "moments", url: "/data/moments.bin", format: "i8", dim }),
};

/** @type {Worker | null} */
let worker = null;
let failed = false;
let nextId = 0;
const pending = new Map();
const listeners = new Set();
/** @type {{ status: "idle" | "loading" | "ready" | "unavailable", progress: number }} */
let state = { status: "idle", progress: 0 };

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
}

function fail(message) {
  failed = true;
  worker?.terminate();
  worker = null;
  setState({ status: "unavailable" });
  pending.forEach(({ reject }) => reject(new Error(message)));
  pending.clear();
}

function ensureWorker() {
  if (worker || failed) return worker;
  if (typeof Worker === "undefined") {
    fail("Web Workers are not supported");
    return null;
  }
  try {
    worker = new Worker(new URL("../workers/semanticSearch.worker.js", import.meta.url), { type: "module" });
  } catch {
    fail("The search worker could not start");
    return null;
  }
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "status") setState({ status: m.status, progress: m.progress ?? state.progress });
    else if (m.type === "result") {
      pending.get(m.id)?.resolve(m.hits);
      pending.delete(m.id);
    } else if (m.type === "error") {
      if (m.id == null || /import|fetch|model|network/i.test(m.message)) fail(m.message);
      else {
        pending.get(m.id)?.reject(new Error(m.message));
        pending.delete(m.id);
      }
    }
  };
  worker.onerror = () => fail("The search worker crashed");
  return worker;
}

/** Start downloading the model (e.g. when a search box is focused). */
export function warmSearch() {
  if (state.status !== "idle") return;
  const w = ensureWorker();
  if (!w) return;
  setState({ status: "loading" });
  w.postMessage({ type: "warm" });
}

/**
 * @param {{ name: string, url: string, format: "f32" | "i8", dim: number }} index
 * @param {string} text
 * @returns {Promise<{ index: number, score: number }[]>}
 */
export function semanticSearch(index, text, k = 8) {
  const w = ensureWorker();
  if (!w) return Promise.reject(new Error("semantic search unavailable"));
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: "query", id, index, text, k });
  });
}

/** Subscribe to model status (for "Loading the AI model… 40%" lines). Returns an unsubscribe. */
export function onSearchStatus(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}
