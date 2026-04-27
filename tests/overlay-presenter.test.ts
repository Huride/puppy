import { describe, expect, it } from "vitest";
import type { OverlayState } from "../src/session/types.js";
import {
  describeIssueFocus,
  getAffectionBubbleLine,
  getMetricFillPercent,
  getPetBubbleLine,
  petBubbleLines,
  shouldEnterKennel,
  shouldTriggerPetting,
} from "../src/overlay/pet-presenter.js";

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

  it("can rotate lines even when the attention signal stays the same", () => {
    const state = {
      ...baseState,
      status: "watch" as const,
      popup: {
        ...baseState.popup,
        contextPercent: 62,
      },
    };

    expect(getPetBubbleLine(state, 0)).not.toBe(getPetBubbleLine(state, 1));
  });

  it("explains the problematic task when failures repeat", () => {
    expect(
      describeIssueFocus({
        ...baseState,
        status: "risk",
        popup: {
          ...baseState.popup,
          repeatedFailureCount: 4,
          repeatedFailureKey: "auth.spec.ts: refresh token expires too early",
          contextPercent: 71,
        },
      }),
    ).toEqual({
      title: "문제 작업: auth.spec.ts",
      detail: "refresh token expires too early 실패가 4번 반복됐어요. 이 작업은 잠깐 멈추고 원인부터 보는 게 좋아요.",
    });
  });

  it("falls back to context pressure when there is no repeated failure", () => {
    expect(
      describeIssueFocus({
        ...baseState,
        status: "watch",
        popup: {
          ...baseState.popup,
          contextPercent: 76,
        },
      }).title,
    ).toBe("주의 지점: 컨텍스트");
  });

  it("normalizes metric fill percentages", () => {
    expect(getMetricFillPercent(120)).toBe(100);
    expect(getMetricFillPercent(-10)).toBe(0);
    expect(getMetricFillPercent(42.4)).toBe(42);
  });

  it("enters kennel mode only after a deliberate right drag", () => {
    expect(shouldEnterKennel(100, 165)).toBe(true);
    expect(shouldEnterKennel(100, 130)).toBe(false);
    expect(shouldEnterKennel(100, 20)).toBe(false);
  });

  it("detects petting gestures without treating kennel drags as petting", () => {
    expect(shouldTriggerPetting(100, 116)).toBe(true);
    expect(shouldTriggerPetting(100, 165)).toBe(false);
    expect(shouldTriggerPetting(100, 104)).toBe(false);
  });

  it("uses warmer interaction lines for petting", () => {
    expect(getAffectionBubbleLine(0)).toContain("멍");
    expect(getAffectionBubbleLine(1)).toContain("꼬리");
  });
});
