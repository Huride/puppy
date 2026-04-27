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

  it("can estimate context pressure from cumulative observed output", () => {
    const signals = computeSignals([event("recent line")], { cpuPercent: 10, memoryPercent: 20 }, 2, 120_000);

    expect(signals.contextPercent).toBe(75);
    expect(signals.recentLines).toEqual(["recent line"]);
  });

  it("extracts token ETA when log includes a token risk phrase", () => {
    const signals = computeSignals([event("Token ETA: 12m")], { cpuPercent: 1, memoryPercent: 2 }, 0);

    expect(signals.tokenEtaMinutes).toBe(12);
  });

  it("classifies active test work and test failures", () => {
    const signals = computeSignals(
      [
        event("[codex] running npm test auth.spec.ts"),
        event("FAIL auth.spec.ts: refresh token expires too early"),
      ],
      { cpuPercent: 20, memoryPercent: 30 },
      0,
    );

    expect(signals.activityPhase).toBe("test");
    expect(signals.failureKind).toBe("test_failure");
  });

  it("classifies build errors, type errors, network errors, auth errors, timeouts, and missing files", () => {
    expect(computeSignals([event("error TS2322: Type 'string' is not assignable")], { cpuPercent: 1, memoryPercent: 1 }, 0).failureKind).toBe(
      "type_error",
    );
    expect(computeSignals([event("npm ERR! build failed")], { cpuPercent: 1, memoryPercent: 1 }, 0).failureKind).toBe("build_error");
    expect(computeSignals([event("fetch failed: ENOTFOUND registry.npmjs.org")], { cpuPercent: 1, memoryPercent: 1 }, 0).failureKind).toBe(
      "network_error",
    );
    expect(computeSignals([event("401 Unauthorized: invalid API key")], { cpuPercent: 1, memoryPercent: 1 }, 0).failureKind).toBe("auth_error");
    expect(computeSignals([event("Command timed out after 30000ms")], { cpuPercent: 1, memoryPercent: 1 }, 0).failureKind).toBe("timeout");
    expect(computeSignals([event("ENOENT: no such file or directory, open 'token.ts'")], { cpuPercent: 1, memoryPercent: 1 }, 0).failureKind).toBe(
      "missing_file",
    );
  });

  it("identifies dependency installs, file edits, waiting, repeated failures, output flood, and resource pressure", () => {
    expect(computeSignals([event("npm install @types/node")], { cpuPercent: 1, memoryPercent: 1 }, 0).activityPhase).toBe(
      "dependency_install",
    );
    expect(computeSignals([event("[codex] editing src/auth/token.ts")], { cpuPercent: 1, memoryPercent: 1 }, 0).activityPhase).toBe(
      "file_edit",
    );
    expect(computeSignals([event("still waiting for build output")], { cpuPercent: 1, memoryPercent: 1 }, 95).activityPhase).toBe(
      "waiting",
    );

    const repeated = computeSignals(
      [
        event("FAIL auth.spec.ts: refresh token expires too early"),
        event("FAIL auth.spec.ts: refresh token expires too early"),
        event("FAIL auth.spec.ts: refresh token expires too early"),
      ],
      { cpuPercent: 91, memoryPercent: 89 },
      0,
    );
    expect(repeated.stuckReason).toBe("repeated_failure");
    expect(repeated.resourceTrend).toBe("high_cpu_memory");

    const noisy = computeSignals(Array.from({ length: 90 }, (_, index) => event(`line ${index}`)), { cpuPercent: 1, memoryPercent: 1 }, 0);
    expect(noisy.stuckReason).toBe("output_flood");
  });
});
