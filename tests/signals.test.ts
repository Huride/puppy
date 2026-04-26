import { describe, expect, it } from "vitest";
import { computeSignals } from "../src/session/signals.js";
import type { AgentOutputEvent } from "../src/session/types.js";

function event(line: string, timestamp = 1): AgentOutputEvent {
  return { type: "agent_output", stream: "stdout", line, timestamp };
}

describe("computeSignals", () => {
  it("detects repeated test failures by failure key", () => {
    const signals = computeSignals(
      [
        event("FAIL auth.spec.ts: refresh token expires too early"),
        event("[codex] editing src/auth/token.ts"),
        event("FAIL auth.spec.ts: refresh token expires too early"),
        event("FAIL auth.spec.ts: refresh token expires too early"),
      ],
      { cpuPercent: 41, memoryPercent: 62 },
      10,
    );

    expect(signals.repeatedFailureCount).toBe(3);
    expect(signals.repeatedFailureKey).toBe("auth.spec.ts: refresh token expires too early");
  });

  it("estimates context pressure from accumulated log size", () => {
    const longLine = "x".repeat(40_000);
    const signals = computeSignals([event(longLine), event(longLine), event(longLine)], { cpuPercent: 10, memoryPercent: 20 }, 2);

    expect(signals.contextPercent).toBeGreaterThanOrEqual(70);
    expect(signals.contextPercent).toBeLessThanOrEqual(95);
  });

  it("extracts token ETA when log includes a token risk phrase", () => {
    const signals = computeSignals([event("Token ETA: 12m")], { cpuPercent: 1, memoryPercent: 2 }, 0);

    expect(signals.tokenEtaMinutes).toBe(12);
  });
});
