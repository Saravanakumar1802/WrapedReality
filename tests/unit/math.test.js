import { describe, expect, it } from "vitest";
import {
  centroid,
  dot,
  fitToRadius,
  formatTime,
  minimumSpanningTree,
  mulberry32,
  nearestNeighbors,
  normalize,
  slugify,
  softmax,
} from "@/lib/math.js";

describe("math", () => {
  it("normalize gives unit length; dot of unit vectors is cosine", () => {
    const v = normalize([3, 4]);
    expect(dot(v, v)).toBeCloseTo(1, 10);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
  it("centroid is normalised", () => {
    const c = centroid([
      [1, 0],
      [0, 1],
    ]);
    expect(Math.hypot(...c)).toBeCloseTo(1, 10);
  });
  it("softmax sums to 1 and keeps order", () => {
    const s = softmax({ a: 0.5, b: 0.4, c: 0.1 });
    expect(Object.values(s).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 10);
    expect(s.a).toBeGreaterThan(s.b);
    expect(softmax({})).toEqual({});
  });
  it("seeded RNG is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("MST has n-1 edges and connects every point", () => {
    const pts = [
      [0, 0, 0],
      [1, 0, 0],
      [5, 5, 5],
      [6, 5, 5],
      [0, 1, 0],
    ];
    const edges = minimumSpanningTree(pts);
    expect(edges).toHaveLength(pts.length - 1);
    expect(new Set(edges.flat()).size).toBe(pts.length);
    expect(minimumSpanningTree([[0, 0, 0]])).toEqual([]);
  });
  it("nearest neighbours exclude self", () => {
    const v = [normalize([1, 0]), normalize([0.9, 0.1]), normalize([0, 1]), normalize([0.1, 0.9])];
    expect(nearestNeighbors(v, 0, 2)).toEqual([1, 3]);
    expect(nearestNeighbors(v, 0, 3)).not.toContain(0);
  });
  it("fitToRadius scales into the radius", () => {
    const out = fitToRadius(
      [
        [0, 0, 0],
        [10, 20, -4],
      ],
      5,
    );
    expect(Math.max(...out.flat().map(Math.abs))).toBeCloseTo(5, 2);
  });
  it("slugify", () => {
    expect(slugify("Marvel's Spider-Man 2")).toBe("marvels-spider-man-2");
    expect(slugify("Ratchet & Clank")).toBe("ratchet-and-clank");
    expect(slugify("God of War Ragnarök")).toBe("god-of-war-ragnarok");
    expect(slugify("Dragon Ball: Sparking! Zero")).toBe("dragon-ball-sparking-zero");
  });
  it("formatTime", () => {
    expect(formatTime(754)).toBe("12:34");
    expect(formatTime(3723)).toBe("1:02:03");
    expect(formatTime(-5)).toBe("0:00");
  });
});
