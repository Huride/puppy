import { describe, expect, it } from "vitest";
import { parsePassiveArtifact } from "../src/session/passive-artifact-parse.js";
import { buildPassiveCompanionCoach, evaluatePassiveCompanion } from "../src/session/passive-companion.js";

function createSignals(overrides: Partial<Parameters<typeof buildPassiveCompanionCoach>[0]> = {}) {
  return {
    recentLines: [],
    repeatedFailureCount: 0,
    repeatedFailureKey: null,
    contextPercent: 4,
    tokenEtaMinutes: null,
    resourceUsage: { cpuPercent: 22, memoryPercent: 41 },
    idleSeconds: 0,
    activityPhase: "waiting" as const,
    failureKind: null,
    stuckReason: null,
    resourceTrend: "normal" as const,
    ...overrides,
  };
}

describe("passive companion coach", () => {
  it("stays explicit about passive limitations while agents are detected", () => {
    const coach = buildPassiveCompanionCoach(
      createSignals(),
      [{ pid: 1, kind: "codex", command: "codex" }],
    );

    expect(coach.status).toBe("watch");
    expect(coach.summary).toContain("passive detect");
    expect(coach.recommendation).toContain("pawtrol watch -- <command>");
  });

  it("raises risk when passive mode only sees heavy resource pressure", () => {
    const coach = buildPassiveCompanionCoach(
      createSignals({
        resourceUsage: { cpuPercent: 91, memoryPercent: 88 },
        resourceTrend: "high_cpu_memory",
      }),
      [{ pid: 1, kind: "codex", command: "codex" }],
    );

    expect(coach.status).toBe("risk");
    expect(coach.risk).toContain("CPU 91%");
    expect(coach.evidence).toContain("passive detect 모드");
  });

  it("marks passive-local mode as low confidence and recommends watch mode", () => {
    const evaluation = evaluatePassiveCompanion(createSignals(), [{ pid: 1, kind: "codex", command: "codex" }]);

    expect(evaluation.overlay.confidenceLabel).toBe("low");
    expect(evaluation.overlay.observationSourceLabel).toBe("passive-local");
    expect(evaluation.overlay.updatedAtLabel).toBeUndefined();
    expect(evaluation.overlay.isStale).toBe(false);
    expect(evaluation.overlay.availableSystemActions).toEqual([
      "activity-monitor",
      "storage-settings",
      "network-settings",
    ]);
    expect(evaluation.coach.recommendation).toContain("pawtrol watch -- <command>");
  });

  it("uses grounded summary artifact fields without guessing unknown values", () => {
    const evaluation = evaluatePassiveCompanion(createSignals(), [{ pid: 1, kind: "codex", command: "codex" }], {
      summary: {
        artifact: {
          path: "/repo/.pawtrol/session-plan.md",
          category: "markdown",
          kindHint: "summary",
          sourceScope: "cwd",
          mtimeMs: Date.parse("2026-04-28T12:02:00Z"),
          updatedAt: "2026-04-28T12:02:00.000Z",
          ageMs: 0,
          ageMinutes: 0,
          isCurrent: true,
        },
        snapshot: {
          sourceType: "markdown",
          sourcePath: "/repo/.pawtrol/session-plan.md",
          providerLabel: "codex",
          appKind: "codex",
          taskHint: "refresh token fix",
          problemHint: "auth.spec.ts: refresh token expires too early",
          contextPercent: 82,
          tokenEtaMinutes: 7,
          repeatedFailureKey: "auth.spec.ts: refresh token expires too early",
          repeatedFailureCount: 3,
          recentFileHints: ["src/auth/token.ts"],
          recentTestHints: ["tests/auth.spec.ts"],
          confidenceHint: "medium",
          updatedAt: "2026-04-28T12:02:00.000Z",
          staleReadyAt: "2026-04-28T12:17:00.000Z",
          stale: false,
        },
      },
      log: {
        artifact: {
          path: "/repo/.pawtrol/session.log",
          category: "log",
          kindHint: "log",
          sourceScope: "cwd",
          mtimeMs: Date.parse("2026-04-28T12:01:00Z"),
          updatedAt: "2026-04-28T12:01:00.000Z",
          ageMs: 0,
          ageMinutes: 0,
          isCurrent: true,
        },
        snapshot: {
          sourceType: "log",
          sourcePath: "/repo/.pawtrol/session.log",
          providerLabel: "codex",
          appKind: "codex",
          taskHint: null,
          problemHint: "auth.spec.ts: refresh token expires too early",
          contextPercent: null,
          tokenEtaMinutes: null,
          repeatedFailureKey: "auth.spec.ts: refresh token expires too early",
          repeatedFailureCount: 2,
          recentFileHints: ["src/auth/token.ts"],
          recentTestHints: ["tests/auth.spec.ts"],
          confidenceHint: "low",
          updatedAt: null,
          staleReadyAt: null,
          stale: false,
        },
      },
    });

    expect(evaluation.overlay.providerLabel).toBe("codex");
    expect(evaluation.overlay.observationSourceLabel).toContain("session-plan.md");
    expect(evaluation.overlay.updatedAtLabel).toBe("2026-04-28T12:02:00.000Z");
    expect(evaluation.overlay.confidenceLabel).toBe("medium");
    expect(evaluation.overlay.isStale).toBe(false);
    expect(evaluation.overlay.contextPercent).toBe(82);
    expect(evaluation.overlay.tokenEtaMinutes).toBe(7);
    expect(evaluation.overlay.repeatedFailureCount).toBe(3);
    expect(evaluation.overlay.repeatedFailureKey).toBe("auth.spec.ts: refresh token expires too early");
    expect(evaluation.overlay.availableSystemActions).toEqual([
      "activity-monitor",
      "storage-settings",
      "network-settings",
      "open-artifact-path",
    ]);
    expect(evaluation.coach.summary).toContain("summary artifact");
    expect(evaluation.coach.recommendation).toContain("tests/auth.spec.ts");
  });

  it("keeps passive metrics unknown when artifacts do not ground them", () => {
    const evaluation = evaluatePassiveCompanion(createSignals(), [{ pid: 1, kind: "codex", command: "codex" }], {
      log: {
        artifact: {
          path: "/repo/.pawtrol/session.log",
          category: "log",
          kindHint: "log",
          sourceScope: "cwd",
          mtimeMs: Date.parse("2026-04-28T12:01:00Z"),
          updatedAt: "2026-04-28T12:01:00.000Z",
          ageMs: 0,
          ageMinutes: 0,
          isCurrent: true,
        },
        snapshot: {
          sourceType: "log",
          sourcePath: "/repo/.pawtrol/session.log",
          providerLabel: "codex",
          appKind: "codex",
          taskHint: null,
          problemHint: null,
          contextPercent: null,
          tokenEtaMinutes: null,
          repeatedFailureKey: null,
          repeatedFailureCount: null,
          recentFileHints: [],
          recentTestHints: [],
          confidenceHint: "low",
          updatedAt: null,
          staleReadyAt: null,
          stale: false,
        },
      },
    });

    expect(evaluation.overlay.contextPercent).toBeNull();
    expect(evaluation.overlay.tokenEtaMinutes).toBeNull();
    expect(evaluation.overlay.repeatedFailureCount).toBeNull();
    expect(evaluation.overlay.repeatedFailureKey).toBeNull();
    expect(evaluation.overlay.confidenceLabel).toBe("low");
  });

  it("downgrades stale artifact-backed passive mode to low confidence", () => {
    const evaluation = evaluatePassiveCompanion(createSignals(), [{ pid: 1, kind: "claude", command: "claude" }], {
      staleLog: {
        artifact: {
          path: "/repo/.claude/history.log",
          category: "log",
          kindHint: "log",
          sourceScope: "cwd",
          mtimeMs: Date.parse("2026-04-28T11:30:00Z"),
          updatedAt: "2026-04-28T11:30:00.000Z",
          ageMs: 1_800_000,
          ageMinutes: 30,
          isCurrent: false,
        },
        snapshot: {
          sourceType: "log",
          sourcePath: "/repo/.claude/history.log",
          providerLabel: "claude",
          appKind: "claude",
          taskHint: null,
          problemHint: "tests/auth.spec.ts",
          contextPercent: null,
          tokenEtaMinutes: null,
          repeatedFailureKey: "tests/auth.spec.ts",
          repeatedFailureCount: 2,
          recentFileHints: [],
          recentTestHints: ["tests/auth.spec.ts"],
          confidenceHint: "low",
          updatedAt: null,
          staleReadyAt: null,
          stale: true,
        },
      },
    });

    expect(evaluation.overlay.providerLabel).toBe("claude");
    expect(evaluation.overlay.confidenceLabel).toBe("low");
    expect(evaluation.overlay.isStale).toBe(true);
    expect(evaluation.coach.risk).toContain("오래돼");
    expect(evaluation.coach.recommendation).toContain("watch");
  });

  it("surfaces managed agent providers from Pawtrol-managed summary artifacts", () => {
    const summaryPath = "/Users/tester/.pawtrol/agents/gemini/session-summary.json";
    const snapshot = parsePassiveArtifact({
      path: summaryPath,
      kind: "summary",
      content: JSON.stringify({
        task: "fix overlay spinner",
        problem: "loading state never appears",
        contextPercent: 63,
        tokenEtaMinutes: 11,
        repeatedFailure: {
          key: "loading state never appears",
          count: 2,
        },
        updatedAt: "2026-04-28T12:05:00.000Z",
      }),
      now: new Date("2026-04-28T12:06:00.000Z"),
    });

    const evaluation = evaluatePassiveCompanion(createSignals(), [{ pid: 1, kind: "gemini", command: "gemini" }], {
      summary: {
        artifact: {
          path: summaryPath,
          category: "json",
          kindHint: "summary",
          sourceScope: "home_app",
          mtimeMs: Date.parse("2026-04-28T12:05:00.000Z"),
          updatedAt: "2026-04-28T12:05:00.000Z",
          ageMs: 60_000,
          ageMinutes: 1,
          isCurrent: true,
        },
        snapshot,
      },
    });

    expect(evaluation.overlay.providerLabel).toBe("gemini");
    expect(evaluation.overlay.observationSourceLabel).toContain("session-summary.json");
    expect(evaluation.overlay.contextPercent).toBe(63);
    expect(evaluation.overlay.tokenEtaMinutes).toBe(11);
    expect(evaluation.coach.summary).toContain("summary artifact");
  });
});
