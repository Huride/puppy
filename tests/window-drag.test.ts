import { describe, expect, it } from "vitest";
import { calculateMovedBounds, combineWorkAreas } from "../src/desktop/window-drag.js";

describe("desktop window dragging", () => {
  it("moves the companion by the pointer delta", () => {
    expect(
      calculateMovedBounds({
        current: { x: 800, y: 500, width: 560, height: 820 },
        delta: { x: -40, y: 24 },
        workArea: { x: 0, y: 0, width: 1440, height: 900 },
      }),
    ).toEqual({ x: 760, y: 524, width: 560, height: 820 });
  });

  it("keeps at least part of the companion reachable on screen", () => {
    expect(
      calculateMovedBounds({
        current: { x: 800, y: 500, width: 560, height: 820 },
        delta: { x: 900, y: -900 },
        workArea: { x: 0, y: 0, width: 1440, height: 900 },
      }),
    ).toEqual({ x: 1296, y: 0, width: 560, height: 820 });
  });

  it("combines multiple monitor work areas into a single drag region", () => {
    expect(
      combineWorkAreas([
        { x: 0, y: 23, width: 1512, height: 945 },
        { x: 1512, y: 0, width: 1728, height: 1117 },
      ]),
    ).toEqual({ x: 0, y: 0, width: 3240, height: 1117 });
  });
});
