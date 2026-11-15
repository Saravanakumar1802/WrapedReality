import { describe, expect, it } from "vitest";
import { CASE, SHELF, computeShelfLayout, createSlotPicker, perRowForAspect, presentCase, clusterPositions } from "@/lib/layout.js";

const games = Array.from({ length: 30 }, (_, i) => ({ slug: `g${i}`, platform: i < 12 ? "PS5" : "PS4", primaryGenre: "action" }));

describe("shelf layout", () => {
  it("places every game exactly once, grouped by platform rows", () => {
    const l = computeShelfLayout(games, { perRow: 10, platforms: ["PS5", "PS4", "PS2"] });
    expect(l.slots).toHaveLength(30);
    expect(new Set(l.slots.map((s) => s.slug)).size).toBe(30);
    expect(l.rows.map((r) => r.platform)).toEqual(["PS5", "PS5", "PS4", "PS4"]);
    for (const r of l.rows) expect(r.count).toBeLessThanOrEqual(10);
  });

  it("cases in a row never overlap", () => {
    const l = computeShelfLayout(games, { perRow: 30, platforms: ["PS5", "PS4"] });
    const row0 = l.slots.filter((s) => s.row === 0).sort((a, b) => a.col - b.col);
    for (let i = 1; i < row0.length; i++) {
      expect(row0[i].position[0] - row0[i - 1].position[0]).toBeGreaterThanOrEqual(CASE.depth);
    }
  });

  it("is centred around the origin", () => {
    const l = computeShelfLayout(games, { perRow: 30, platforms: ["PS5", "PS4"] });
    const ys = l.rows.map((r) => r.y);
    expect(ys[0] + ys[ys.length - 1]).toBeCloseTo(0, 6);
  });

  it("responsive per-row counts", () => {
    expect(perRowForAspect(0.5, 54)).toBe(12);
    expect(perRowForAspect(1.8, 54)).toBe(30);
    expect(perRowForAspect(1.8, 5)).toBe(5);
  });

  it("fallback cluster positions are deterministic", () => {
    const a = clusterPositions(games);
    expect(a).toEqual(clusterPositions(games));
    expect(a.flat().every(Number.isFinite)).toBe(true);
  });
});

describe("gap-free shelf picking", () => {
  const l = computeShelfLayout(games, { perRow: 10, platforms: ["PS5", "PS4"] });
  const pick = createSlotPicker(l);
  const pitch = CASE.depth + SHELF.gap;

  it("finds the case under a point on its spine", () => {
    l.slots.forEach((s, i) => expect(pick(s.position[0], s.position[1])).toBe(i));
  });

  it("a point in the air between two spines goes to the nearer case (no dead gaps)", () => {
    const [a, b] = l.slots.filter((s) => s.row === 0).sort((x, y) => x.col - y.col);
    const gapX = (a.position[0] + b.position[0]) / 2;
    expect([l.slots.indexOf(a), l.slots.indexOf(b)]).toContain(pick(gapX, a.position[1]));
    expect(pick(a.position[0] + pitch * 0.45, a.position[1])).toBe(l.slots.indexOf(a));
  });

  it("misses off the ends of a row and far above or below the cases", () => {
    const row = l.rows[0];
    expect(pick(-row.width / 2 - pitch, row.y)).toBe(-1);
    expect(pick(row.width / 2 + pitch, row.y)).toBe(-1);
    expect(pick(0, l.rows[0].y + CASE.height * 2)).toBe(-1);
  });
});

describe("presenting a pulled-out case", () => {
  const base = { distance: 3.4, fov: 35, aspect: 16 / 9, width: CASE.width, height: CASE.height };

  it("centres the case when nothing covers the stage", () => {
    const p = presentCase(base);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    expect(p.scale).toBeGreaterThan(0.5);
    expect(p.scale).toBeLessThanOrEqual(1);
  });

  it("moves left of a side panel and up above a bottom sheet", () => {
    expect(presentCase({ ...base, insets: { right: 0.3 } }).x).toBeLessThan(0);
    expect(presentCase({ ...base, aspect: 0.5, insets: { bottom: 0.4 } }).y).toBeGreaterThan(0);
  });

  it("shrinks a wide (open) case to fit the free space", () => {
    const closed = presentCase({ ...base, aspect: 0.5 });
    const open = presentCase({ ...base, aspect: 0.5, width: CASE.width * 2.55 });
    expect(open.scale).toBeLessThan(closed.scale);
    const viewW = 2 * 3.4 * Math.tan((17.5 * Math.PI) / 180) * 0.5;
    expect(CASE.width * 2.55 * open.scale).toBeLessThanOrEqual(viewW);
  });
});
