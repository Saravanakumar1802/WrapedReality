import { describe, expect, it } from "vitest";
import { classifySwipe } from "@/hooks/useSwipe.js";

describe("swipe classifier", () => {
  it("recognises quick horizontal and vertical swipes", () => {
    expect(classifySwipe(-120, 10, 200)).toBe("left");
    expect(classifySwipe(140, -20, 250)).toBe("right");
    expect(classifySwipe(5, 130, 300)).toBe("down");
    expect(classifySwipe(-8, -100, 300)).toBe("up");
  });

  it("ignores taps, slow drags and diagonals", () => {
    expect(classifySwipe(20, 10, 100)).toBeNull(); // too short: a tap
    expect(classifySwipe(200, 0, 1500)).toBeNull(); // too slow: a drag
    expect(classifySwipe(100, 90, 200)).toBeNull(); // diagonal: ambiguous
  });
});
