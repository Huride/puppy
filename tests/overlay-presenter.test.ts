import { describe, expect, it } from "vitest";
import type { OverlayState } from "../src/session/types.js";
import {
  chooseDisplayedPetState,
  classifyPetPointerGesture,
  describeIssueFocus,
  getAffectionBubbleLine,
  getBehaviorBubbleLine,
  getIdleBubbleLine,
  getInteractionBubbleLine,
  getNormalIdlePetState,
  getMetricFillPercent,
  getPetPointerZone,
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
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 132, y: 104 }, "body")).toBe("petting");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 148, y: 124 }, "body")).toBe("petting");
    expect(shouldTriggerPetting(100, 165)).toBe(false);
    expect(shouldTriggerPetting(100, 104)).toBe(false);
  });

  it("classifies deliberate pet drags as window moves", () => {
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 104, y: 126 }, "move")).toBe("move");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 122, y: 118 }, "move")).toBe("move");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 54, y: 103 }, "move")).toBe("move");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 165, y: 104 }, "move")).toBe("kennel");
  });

  it("does not turn a short move-zone click jitter into a window drag", () => {
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 111, y: 106 }, "move")).toBe("none");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 117, y: 110 }, "move")).toBe("move");
  });

  it("keeps horizontal pet and kennel gestures distinct from window moves", () => {
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 116, y: 104 })).toBe("petting");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 165, y: 104 })).toBe("kennel");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 104, y: 104 })).toBe("none");
  });

  it("uses the body as the send-home hitbox and the rest of the dog as a move handle", () => {
    const rect = { left: 10, top: 20, width: 220, height: 180 };

    expect(getPetPointerZone({ x: 126, y: 128 }, rect)).toBe("body");
    expect(getPetPointerZone({ x: 74, y: 86 }, rect)).toBe("move");
    expect(getPetPointerZone({ x: 198, y: 104 }, rect)).toBe("move");
  });

  it("sends Bori home from deliberate body drags and moves the window from non-body drags", () => {
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 165, y: 105 }, "body")).toBe("kennel");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 165, y: 132 }, "body")).toBe("kennel");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 124, y: 120 }, "body")).toBe("move");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 116, y: 104 }, "body")).toBe("petting");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 136, y: 118 }, "body")).toBe("petting");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 112, y: 104 }, "move")).toBe("none");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 118, y: 108 }, "move")).toBe("move");
    expect(classifyPetPointerGesture({ x: 100, y: 100 }, { x: 104, y: 103 }, "move")).toBe("none");
  });

  it("uses warmer interaction lines for petting", () => {
    expect(getAffectionBubbleLine(0)).toContain("멍");
    expect(getAffectionBubbleLine(1)).toContain("꼬리");
  });

  it("cycles quiet normal idle behaviors over time", () => {
    const turns = Array.from({ length: 8 }, (_, turn) => getNormalIdlePetState(turn, false));

    expect(new Set(turns)).toEqual(new Set(["walking", "sitting", "lying", "sniffing", "stretching", "watching", "sleepy"]));
  });

  it("blocks large movement idle behaviors while the popup is open", () => {
    const turns = Array.from({ length: 8 }, (_, turn) => getNormalIdlePetState(turn, true));

    expect(turns).not.toContain("walking");
    expect(turns).not.toContain("stretching");
    expect(new Set(turns)).toEqual(new Set(["sitting", "lying", "watching", "sleepy"]));
  });

  it("prioritizes alert-style behavior for attention states over random idle behavior", () => {
    expect(chooseDisplayedPetState({ ...baseState, status: "watch" }, 0, false)).toBe("watching");
    expect(chooseDisplayedPetState({ ...baseState, status: "risk" }, 0, false)).toBe("sniffing");
    expect(chooseDisplayedPetState({ ...baseState, status: "intervene" }, 0, false)).toBe("alert");
  });

  it("keeps demo idle lines explicitly marked as demo when present", () => {
    expect(getIdleBubbleLine(0, true)).toContain("데모");
  });

  it("has dog-like behavior lines for every normal behavior state", () => {
    const states = ["walking", "sitting", "lying", "sniffing", "stretching", "watching", "sleepy", "kennel"] as const;

    for (const state of states) {
      const lines = Array.from({ length: 4 }, (_, index) => getBehaviorBubbleLine(state, index, false));
      expect(lines.every((line) => line.length > 0)).toBe(true);
      expect(lines.some((line) => /멍|킁|꼬리|앞발|발|낮잠|집/.test(line))).toBe(true);
    }
  });

  it("marks demo behavior lines as demo lines", () => {
    expect(getBehaviorBubbleLine("sniffing", 0, true)).toContain("데모");
    expect(getBehaviorBubbleLine("lying", 1, true)).toContain("데모");
  });

  it("uses separate interaction lines for hover, petting, and kennel transitions", () => {
    const hover = getInteractionBubbleLine("hover", 0, false);
    const petting = getInteractionBubbleLine("petting", 0, false);
    const kennelEnter = getInteractionBubbleLine("kennelEnter", 0, false);
    const kennelExit = getInteractionBubbleLine("kennelExit", 0, false);

    expect(new Set([hover, petting, kennelEnter, kennelExit]).size).toBe(4);
    expect(petting).toMatch(/쓰다듬|손|꼬리|멍/);
    expect(kennelEnter).toMatch(/집|들어/);
    expect(kennelExit).toMatch(/나왔|왔/);
  });

  it("keeps risk and intervene lines specific enough for coaching", () => {
    expect(petBubbleLines.risk.some((line) => /테스트|실패|토큰|컨텍스트|원인/.test(line))).toBe(true);
    expect(petBubbleLines.intervene.some((line) => /멈추|실패|로그|원인|직접/.test(line))).toBe(true);
  });

  it("uses the selected companion name in named bubble lines", () => {
    const watchState: OverlayState = {
      ...baseState,
      status: "watch",
      popup: {
        ...baseState.popup,
        contextPercent: 67,
        cpuPercent: 30,
        memoryPercent: 30,
        repeatedFailureCount: 0,
        tokenEtaMinutes: null,
      },
    };

    expect(getPetBubbleLine(watchState, 8, "나비")).toContain("나비");
    expect(getPetBubbleLine({ ...watchState, status: "intervene" }, 6, "모찌")).toContain("모찌");
    expect(getInteractionBubbleLine("hover", 3, true, "모찌")).toContain("모찌");
  });
});
