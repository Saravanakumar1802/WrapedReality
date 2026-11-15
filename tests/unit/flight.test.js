import { describe, expect, it } from "vitest";
import { FLIGHT, activeGroup, depthOpacity, flightPlan } from "@/lib/flight.js";
import { GENRES } from "@/data/taxonomy.js";
import dataset from "@/data/generated/games.json";

const games = dataset.games;
const plan = flightPlan(games, (g) => g.primaryGenre, Object.keys(GENRES));

describe("worlds flight plan", () => {
  it("places every game exactly once, after its group's gate", () => {
    expect(plan.items).toHaveLength(games.length);
    expect(new Set(plan.items.map((i) => i.slug)).size).toBe(games.length);
    for (const it of plan.items) {
      const gate = plan.groups.find((g) => g.key === it.key);
      expect(it.depth).toBeGreaterThan(gate.depth);
    }
  });

  it("depth only ever increases, so nothing overlaps along the route", () => {
    const depths = plan.items.map((i) => i.depth);
    for (let i = 1; i < depths.length; i++) expect(depths[i] - depths[i - 1]).toBeGreaterThanOrEqual(FLIGHT.step - 1e-6);
    expect(plan.length).toBeGreaterThan(depths.at(-1));
  });

  it("keeps cases out of the centre line and inside the frame", () => {
    for (const it of plan.items) {
      expect(Math.abs(it.x)).toBeGreaterThanOrEqual(0.5);
      expect(Math.abs(it.x)).toBeLessThanOrEqual(0.95);
      expect(Math.abs(it.y)).toBeLessThanOrEqual(0.72);
    }
  });

  it("is deterministic and skips empty groups", () => {
    expect(flightPlan(games, (g) => g.primaryGenre, Object.keys(GENRES))).toEqual(plan);
    expect(flightPlan(games, (g) => g.primaryGenre, ["nope", "action"]).groups.map((g) => g.key)).toEqual(["action"]);
  });

  it("fades in from far away and out when passing the camera", () => {
    expect(depthOpacity(FLIGHT.far)).toBe(0);
    expect(depthOpacity(1)).toBe(1);
    expect(depthOpacity(FLIGHT.near)).toBe(0);
  });

  it("tracks the world the camera is in", () => {
    expect(activeGroup(plan.groups, 0)).toBe(plan.groups[0].key);
    expect(activeGroup(plan.groups, plan.groups[1].depth)).toBe(plan.groups[1].key);
    expect(activeGroup(plan.groups, plan.length)).toBe(plan.groups.at(-1).key);
  });
});
