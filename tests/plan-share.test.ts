import { describe, expect, it } from "vitest";
import type { CoachResult, SessionSignals } from "../src/session/types.js";
import { buildPlanSnapshot } from "../src/session/plan-share.js";

const signals: SessionSignals = {
  recentLines: ["FAIL auth.spec.ts: refresh token expires too early"],
  repeatedFailureCount: 3,
  repeatedFailureKey: "auth.spec.ts: refresh token expires too early",
  contextPercent: 78,
  tokenEtaMinutes: 12,
  resourceUsage: {
    cpuPercent: 41,
    memoryPercent: 83,
  },
  idleSeconds: 0,
};

const coach: CoachResult = {
  status: "risk",
  summary: "auth.spec.ts 수정이 반복 실패 중이에요.",
  risk: "refresh token 테스트가 3번 실패했고 컨텍스트가 78%예요.",
  recommendation: "token.ts 변경을 분리하고 실패 로그부터 확인하세요.",
  petMessage: "멍! 같은 테스트가 반복돼요.",
};

describe("buildPlanSnapshot", () => {
  it("builds a shareable markdown plan snapshot for other coding agents", () => {
    const snapshot = buildPlanSnapshot(coach, signals, "gemini");

    expect(snapshot).toContain("# Puppy Session Plan");
    expect(snapshot).toContain("Provider: gemini");
    expect(snapshot).toContain("Status: risk");
    expect(snapshot).toContain("Problem: auth.spec.ts: refresh token expires too early");
    expect(snapshot).toContain("Recommended next step: token.ts 변경을 분리하고 실패 로그부터 확인하세요.");
  });
});
