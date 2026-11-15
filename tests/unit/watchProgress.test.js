import { describe, expect, it } from "vitest";
import { continueWatching, getProgress, isFinished, resumeAt, saveProgress } from "@/lib/watchProgress.js";

/** In-memory stand-in for localStorage (same get/set shape as safeStorage). */
function memoryStore() {
  const data = new Map();
  return { get: (k, fallback) => (data.has(k) ? structuredClone(data.get(k)) : fallback), set: (k, v) => data.set(k, structuredClone(v)) };
}

describe("watch progress", () => {
  it("saves and reads a position per video", () => {
    const store = memoryStore();
    saveProgress("v1", { t: 312.7, duration: 3600, slug: "god-of-war", title: "Part 1" }, store, 1000);
    expect(getProgress("v1", store)).toEqual({ t: 312, duration: 3600, slug: "god-of-war", title: "Part 1", at: 1000 });
    expect(getProgress("nope", store)).toBeNull();
  });

  it("resumes only when there is something worth resuming", () => {
    const store = memoryStore();
    saveProgress("early", { t: 10, duration: 3600, slug: "s", title: "a" }, store);
    saveProgress("mid", { t: 1200, duration: 3600, slug: "s", title: "b" }, store);
    saveProgress("done", { t: 3590, duration: 3600, slug: "s", title: "c" }, store);
    expect(resumeAt("early", store)).toBe(0);
    expect(resumeAt("mid", store)).toBe(1200);
    expect(resumeAt("done", store)).toBe(0);
    expect(isFinished(getProgress("done", store))).toBe(true);
  });

  it("lists unfinished videos, newest first", () => {
    const store = memoryStore();
    saveProgress("a", { t: 100, duration: 1000, slug: "s", title: "A" }, store, 1);
    saveProgress("b", { t: 200, duration: 1000, slug: "s", title: "B" }, store, 3);
    saveProgress("c", { t: 990, duration: 1000, slug: "s", title: "C" }, store, 2);
    expect(continueWatching(5, store).map((e) => e.videoId)).toEqual(["b", "a"]);
  });

  it("keeps only the most recent entries", () => {
    const store = memoryStore();
    for (let i = 0; i < 70; i++) saveProgress(`v${i}`, { t: 100, slug: "s", title: "x" }, store, i);
    expect(getProgress("v0", store)).toBeNull();
    expect(getProgress("v69", store)).not.toBeNull();
  });

  it("ignores bad input", () => {
    const store = memoryStore();
    saveProgress("", { t: 5, slug: "s", title: "x" }, store);
    saveProgress("v", { t: NaN, slug: "s", title: "x" }, store);
    expect(continueWatching(5, store)).toEqual([]);
  });
});
