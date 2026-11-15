import { describe, expect, it } from "vitest";
import { initialShelfState, neighbours, shelfReducer } from "@/lib/shelfMachine.js";

const run = (actions, state = initialShelfState) => actions.reduce(shelfReducer, state);
const order = ["a", "b", "c", "d"];

describe("shelf state machine", () => {
  it("pulls a case out, opens it and takes the disc", () => {
    const s = run([{ type: "select", slug: "b" }, { type: "advance" }, { type: "advance" }]);
    expect(s).toMatchObject({ selected: "b", stage: "inspect", focused: "b", leaving: [] });
    expect(run([{ type: "advance" }], s).stage).toBe("inspect"); // no stage past the disc
  });

  it("back walks the stages in reverse, then sends the case home", () => {
    let s = run([
      { type: "select", slug: "b" },
      { type: "goto", stage: "inspect" },
    ]);
    s = run([{ type: "back" }], s);
    expect(s.stage).toBe("open");
    s = run([{ type: "back" }], s);
    expect(s.stage).toBe("out");
    s = run([{ type: "back" }], s);
    expect(s).toMatchObject({ selected: null, leaving: ["b"] });
  });

  it("close puts the case back from any stage", () => {
    const s = run([{ type: "select", slug: "c" }, { type: "goto", stage: "inspect" }, { type: "close" }]);
    expect(s).toMatchObject({ selected: null, stage: "out", leaving: ["c"] });
  });

  it("the stepper jumps straight to any stage", () => {
    const s = run([
      { type: "select", slug: "a" },
      { type: "goto", stage: "inspect" },
    ]);
    expect(s.stage).toBe("inspect");
    expect(run([{ type: "goto", stage: "out" }], s).stage).toBe("out");
    expect(run([{ type: "goto", stage: "nope" }], s)).toBe(s); // unknown stages are ignored
  });

  it("clicking the case toggles it open and closed", () => {
    const s = run([{ type: "select", slug: "a" }, { type: "toggleCase" }]);
    expect(s.stage).toBe("open");
    expect(run([{ type: "toggleCase" }], s).stage).toBe("out");
  });

  it("selecting a neighbour sends the old case home and pulls the new one out", () => {
    const s = run([{ type: "select", slug: "a" }, { type: "advance" }, { type: "select", slug: "b" }]);
    expect(s).toMatchObject({ selected: "b", stage: "out", leaving: ["a"] });
  });

  it("re-selecting a case that is still flying home takes it back out", () => {
    const s = run([
      { type: "select", slug: "a" },
      { type: "select", slug: "b" },
      { type: "select", slug: "a" },
    ]);
    expect(s).toMatchObject({ selected: "a", leaving: ["b"] });
  });

  it("returned clears a case that landed", () => {
    const s = run([{ type: "select", slug: "a" }, { type: "close" }, { type: "returned", slug: "a" }]);
    expect(s.leaving).toEqual([]);
    expect(run([{ type: "returned", slug: "zzz" }], s)).toBe(s);
  });

  it("step moves focus while browsing, and swaps cases while one is out", () => {
    let s = run([{ type: "step", dir: 1, order }]);
    expect(s.focused).toBe("a"); // nothing focused yet: start at the first
    s = run([{ type: "step", dir: 1, order }], s);
    expect(s.focused).toBe("b");
    s = run(
      [
        { type: "select", slug: "b" },
        { type: "step", dir: 1, order },
      ],
      s,
    );
    expect(s).toMatchObject({ selected: "c", leaving: ["b"] });
    s = run(
      [
        { type: "step", dir: 1, order },
        { type: "step", dir: 1, order },
      ],
      s,
    );
    expect(s.selected).toBe("d"); // clamps at the end
  });

  it("stage actions do nothing while browsing", () => {
    for (const type of ["advance", "back", "close", "toggleCase"]) {
      expect(shelfReducer(initialShelfState, { type })).toBe(initialShelfState);
    }
  });

  it("neighbours gives prev / next in visual order", () => {
    expect(neighbours(order, "b")).toEqual({ prev: "a", next: "c", index: 1 });
    expect(neighbours(order, "a").prev).toBeNull();
    expect(neighbours(order, "d").next).toBeNull();
    expect(neighbours(order, null).index).toBe(-1);
  });
});
