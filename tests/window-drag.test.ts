import { describe, expect, it } from "vitest";
import { calculateMovedBounds } from "../src/desktop/window-drag.js";

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
});
