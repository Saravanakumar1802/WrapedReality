/**
 * Local sentence embeddings (Transformers.js, all-MiniLM-L6-v2, 384-d, normalised).
 * No API key. The model (~23 MB) downloads once into cache/models.
 * Vectors are cached by text hash so rebuilds are instant.
 */
import { hashString } from "../src/lib/math.js";
import { log, p, readJson, writeJson } from "./util.mjs";

export const MODEL = "Xenova/all-MiniLM-L6-v2";
export const DIM = 384;
const CACHE = p("cache", "embeddings.json");

/**
 * @param {string[]} texts
 * @returns {Promise<number[][] | null>} null when the model can't load (offline etc.)
 */
export async function embedAll(texts) {
  const cache = await readJson(CACHE, { model: MODEL, items: {} });
  if (cache.model !== MODEL) cache.items = {};
  const keys = texts.map((t) => String(hashString(t)));
  const missing = [...new Set(texts.filter((_, i) => !cache.items[keys[i]]))];

  if (missing.length) {
    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = p("cache", "models");
      const extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
      const BATCH = 16;
      for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH);
        const out = await extractor(batch, { pooling: "mean", normalize: true });
        const rows = out.tolist();
        batch.forEach((t, j) => {
          cache.items[String(hashString(t))] = rows[j].map((x) => Math.round(x * 1e5) / 1e5);
        });
      }
      await writeJson(CACHE, cache, false);
      log.ok(`Embeddings: ${missing.length} new, ${texts.length - missing.length} cached`);
    } catch (err) {
      log.warn(`Embeddings unavailable (${err.message}) — falling back to tag-only sorting.`);
      return null;
    }
  } else {
    log.ok(`Embeddings: all ${texts.length} from cache`);
  }
  const vectors = keys.map((k) => cache.items[k]);
  return vectors.every((v) => Array.isArray(v) && v.length === DIM) ? vectors : null;
}
