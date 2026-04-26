import { describe, expect, it } from "vitest";
import type { OverlayState } from "../src/session/types.js";
import { getPetBubbleLine, petBubbleLines } from "../src/overlay/pet-presenter.js";

const baseState: OverlayState = {
  status: "normal",
  petState: "walking",
  message: "좋아요. 제가 계속 지켜볼게요.",
  popup: {
    title: "Bori's Checkup",
    contextPercent: 12,
    tokenEtaMinutes: null,
    repeatedFailureCount: 0,
    repeatedFailureKey: null,
    cpuPercent: 18,
    memoryPercent: 32,
    summary: "세션이 안정적이에요.",
    recommendation: "그대로 진행해도 좋아요.",
  },
};

describe("pet presenter", () => {
  it("keeps the dog quiet in the normal session state", () => {
    expect(getPetBubbleLine(baseState)).toBeNull();
  });

  it("shows varied lines for attention states", () => {
    expect(petBubbleLines.watch.length).toBeGreaterThanOrEqual(6);
    expect(petBubbleLines.risk.length).toBeGreaterThanOrEqual(6);
    expect(petBubbleLines.intervene.length).toBeGreaterThanOrEqual(6);
    expect(new Set(petBubbleLines.risk).size).toBe(petBubbleLines.risk.length);
  });

  it("selects different risk lines from different session signals", () => {
    const first = getPetBubbleLine({
      ...baseState,
      status: "risk",
      popup: {
        ...baseState.popup,
        contextPercent: 81,
        repeatedFailureCount: 2,
      },
    });
    const second = getPetBubbleLine({
      ...baseState,
      status: "risk",
      popup: {
        ...baseState.popup,
        contextPercent: 94,
        repeatedFailureCount: 5,
      },
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
  });
});
