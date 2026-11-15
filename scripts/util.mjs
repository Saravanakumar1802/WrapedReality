import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const p = (...parts) => path.join(ROOT, ...parts);

export const log = {
  info: (...a) => console.log("  •", ...a),
  ok: (...a) => console.log("  ✓", ...a),
  warn: (...a) => console.warn("  ! ", ...a),
  step: (s) => console.log(`\n▸ ${s}`),
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, data, pretty = true) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, pretty ? 2 : 0) + "\n", "utf8");
}

export async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** fetch → JSON with timeout and a readable error. */
export async function fetchJson(url, init = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

export const env = (k) => (process.env[k] ?? "").trim();
