import { describe, expect, it } from "vitest";
import { buildPassiveCompanionCoach } from "../src/session/passive-companion.js";

describe("passive companion coach", () => {
  it("stays explicit about passive limitations while agents are detected", () => {
    const coach = buildPassiveCompanionCoach(
      {
        recentLines: [],
        repeatedFailureCount: 0,
        repeatedFailureKey: null,
        contextPercent: 4,
        tokenEtaMinutes: null,
        resourceUsage: { cpuPercent: 22, memoryPercent: 41 },
        idleSeconds: 0,
        activityPhase: "waiting",
        failureKind: null,
        stuckReason: null,
        resourceTrend: "normal",
      },
      [{ pid: 1, kind: "codex", command: "codex" }],
    );

    expect(coach.status).toBe("watch");
    expect(coach.summary).toContain("passive detect");
    expect(coach.recommendation).toContain("pawtrol watch -- <command>");
  });

  it("raises risk when passive mode only sees heavy resource pressure", () => {
    const coach = buildPassiveCompanionCoach(
      {
        recentLines: [],
        repeatedFailureCount: 0,
        repeatedFailureKey: null,
        contextPercent: 4,
        tokenEtaMinutes: null,
        resourceUsage: { cpuPercent: 91, memoryPercent: 88 },
        idleSeconds: 0,
        activityPhase: "waiting",
        failureKind: null,
        stuckReason: null,
        resourceTrend: "high_cpu_memory",
      },
      [{ pid: 1, kind: "codex", command: "codex" }],
    );

    expect(coach.status).toBe("risk");
    expect(coach.risk).toContain("CPU 91%");
    expect(coach.evidence).toContain("passive detect 모드");
  });
});
