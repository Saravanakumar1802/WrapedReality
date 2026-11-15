/**
 * Semantic search worker. Runs a small sentence-embedding model (MiniLM) in the
 * visitor's browser: no server, no key, nothing typed leaves the page.
 * Loaded only when a visitor first uses a search box.
 *
 * One model, several indexes (each a flat file of unit vectors written by `npm run data`):
 *   "games"   public/data/vectors.bin  float32, one vector per game   (Feel-search)
 *   "moments" public/data/moments.bin  int8 ×127, one per moment     (Moment search)
 *
 * in : { type: "query", id, index: { name, url, format: "f32" | "i8", dim }, text, k }
 * out: { type: "status", status: "loading" | "ready", progress? }
 *      { type: "result", id, hits: [{ index, score }] } | { type: "error", id, message }
 */
const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js";
const MODEL = "Xenova/all-MiniLM-L6-v2";

/** @type {Promise<any> | null} */
let extractor = null;
/** @type {Map<string, Promise<{ data: Float32Array | Int8Array, scale: number, dim: number }>>} */
const indexes = new Map();

function loadModel() {
  extractor ??= (async () => {
    const { pipeline, env } = await import(/* @vite-ignore */ TRANSFORMERS_URL);
    env.allowLocalModels = false;
    const model = await pipeline("feature-extraction", MODEL, {
      dtype: "q8",
      progress_callback: (p) => {
        if (p.status === "progress" && typeof p.progress === "number") {
          self.postMessage({ type: "status", status: "loading", progress: Math.round(p.progress) });
        }
      },
    });
    self.postMessage({ type: "status", status: "ready" });
    return model;
  })().catch((err) => {
    extractor = null;
    throw err;
  });
  return extractor;
}

function loadIndex({ name, url, format, dim }) {
  if (!indexes.has(name)) {
    indexes.set(
      name,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${name} index: HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((buf) =>
          format === "i8" ? { data: new Int8Array(buf), scale: 1 / 127, dim } : { data: new Float32Array(buf), scale: 1, dim },
        )
        .catch((err) => {
          indexes.delete(name);
          throw err;
        }),
    );
  }
  return indexes.get(name);
}

async function query(id, index, text, k) {
  const [model, idx] = await Promise.all([loadModel(), loadIndex(index)]);
  const q = (await model([text], { pooling: "mean", normalize: true })).data;
  const { data, scale, dim } = idx;
  const n = Math.floor(data.length / dim);
  const scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const off = i * dim;
    for (let j = 0; j < dim; j++) s += q[j] * data[off + j];
    scores[i] = s * scale;
  }
  // top k without sorting everything
  const hits = [];
  for (let i = 0; i < n; i++) {
    if (hits.length < k) hits.push({ index: i, score: scores[i] });
    else if (scores[i] > hits[hits.length - 1].score) hits[hits.length - 1] = { index: i, score: scores[i] };
    else continue;
    hits.sort((a, b) => b.score - a.score);
  }
  self.postMessage({ type: "result", id, hits });
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "warm") await loadModel();
    else if (msg.type === "query") await query(msg.id, msg.index, String(msg.text).slice(0, 300), msg.k ?? 8);
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: String(err?.message ?? err) });
  }
};
