import { describe, expect, it } from "vitest";
import { parsePassiveArtifact } from "../src/session/passive-artifact-parse.js";

describe("parsePassiveArtifact", () => {
  it("extracts grounded fields from a plan-style markdown summary", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/.pawtrol/session-plan.md",
      kind: "summary",
      content: [
        "# Pawtrol Session Plan",
        "",
        "Provider: codex",
        "Problem: auth.spec.ts: refresh token expires too early",
        "Context: 82%",
        "Token ETA: 7m",
        "Repeated failure count: 3",
        "Updated At: 2026-04-28T12:00:00.000Z",
        "Stale Ready At: 2026-04-28T12:15:00.000Z",
        "",
        "## Recent Lines",
        "- FAIL auth.spec.ts: refresh token expires too early",
        "- editing src/auth/token.ts",
        "",
        "## Evidence",
        "- should not leak into recent lines",
      ].join("\n"),
    });

    expect(snapshot.sourceType).toBe("markdown");
    expect(snapshot.sourcePath).toBe("/repo/.pawtrol/session-plan.md");
    expect(snapshot.providerLabel).toBe("codex");
    expect(snapshot.appKind).toBe("codex");
    expect(snapshot.taskHint).toBeNull();
    expect(snapshot.problemHint).toBe("auth.spec.ts: refresh token expires too early");
    expect(snapshot.contextPercent).toBe(82);
    expect(snapshot.tokenEtaMinutes).toBe(7);
    expect(snapshot.repeatedFailureCount).toBe(3);
    expect(snapshot.repeatedFailureKey).toBe("auth.spec.ts: refresh token expires too early");
    expect(snapshot.recentFileHints).toEqual(["src/auth/token.ts"]);
    expect(snapshot.recentTestHints).toEqual(["auth.spec.ts"]);
    expect(snapshot.confidenceHint).toBe("medium");
    expect(snapshot.updatedAt).toBe("2026-04-28T12:00:00.000Z");
    expect(snapshot.staleReadyAt).toBe("2026-04-28T12:15:00.000Z");
    expect(snapshot.stale).toBeNull();
  });

  it("parses explicit fields from a json snapshot without inventing missing values", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/.codex/history.json",
      kind: "summary",
      content: JSON.stringify({
        provider: "claude",
        appKind: "claude-desktop",
        task: "stabilize passive artifact parser",
        problem: "parser drift in passive artifact state",
        contextPercent: 64,
        tokenEtaMinutes: 5,
        repeatedFailure: {
          key: "tests/passive-artifact-parse.test.ts",
          count: 2,
        },
        recentFiles: ["src/session/passive-artifact-parse.ts"],
        recentTests: ["tests/passive-artifact-parse.test.ts"],
        confidence: "medium",
        updatedAt: "2026-04-28T12:05:00.000Z",
      }),
    });

    expect(snapshot.providerLabel).toBe("claude");
    expect(snapshot.appKind).toBe("claude-desktop");
    expect(snapshot.taskHint).toBe("stabilize passive artifact parser");
    expect(snapshot.problemHint).toBe("parser drift in passive artifact state");
    expect(snapshot.contextPercent).toBe(64);
    expect(snapshot.tokenEtaMinutes).toBe(5);
    expect(snapshot.repeatedFailureKey).toBe("tests/passive-artifact-parse.test.ts");
    expect(snapshot.repeatedFailureCount).toBe(2);
    expect(snapshot.recentFileHints).toEqual(["src/session/passive-artifact-parse.ts"]);
    expect(snapshot.recentTestHints).toEqual(["tests/passive-artifact-parse.test.ts"]);
    expect(snapshot.confidenceHint).toBe("medium");
    expect(snapshot.updatedAt).toBe("2026-04-28T12:05:00.000Z");
    expect(snapshot.staleReadyAt).toBe("2026-04-28T12:20:00.000Z");
    expect(snapshot.stale).toBeNull();
  });

  it("uses conservative heuristics for plain text logs", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/codex.log",
      kind: "log",
      content: [
        "[codex] editing src/auth/token.ts",
        "FAIL auth.spec.ts: refresh token expires too early",
        "FAIL auth.spec.ts: refresh token expires too early",
        "running npm test auth.spec.ts",
      ].join("\n"),
    });

    expect(snapshot.providerLabel).toBe("codex");
    expect(snapshot.appKind).toBe("codex");
    expect(snapshot.taskHint).toBeNull();
    expect(snapshot.problemHint).toBe("auth.spec.ts: refresh token expires too early");
    expect(snapshot.contextPercent).toBeNull();
    expect(snapshot.tokenEtaMinutes).toBeNull();
    expect(snapshot.repeatedFailureKey).toBe("auth.spec.ts: refresh token expires too early");
    expect(snapshot.repeatedFailureCount).toBe(2);
    expect(snapshot.recentFileHints).toEqual(["src/auth/token.ts"]);
    expect(snapshot.recentTestHints).toEqual(["auth.spec.ts"]);
    expect(snapshot.confidenceHint).toBe("low");
    expect(snapshot.updatedAt).toBeNull();
    expect(snapshot.stale).toBeNull();
  });

  it("honors an explicit sourceType override instead of auto-detecting markdown", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/notes.md",
      sourceType: "log",
      content: "Provider: codex\nProblem: this should stay a plain log\n",
    });

    expect(snapshot.sourceType).toBe("log");
    expect(snapshot.providerLabel).toBeNull();
    expect(snapshot.problemHint).toBeNull();
    expect(snapshot.confidenceHint).toBe("low");
  });

  it("honors a log kind hint before json auto-detection", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/session.log",
      kind: "log",
      content: "{\"provider\":\"codex\",\"problem\":\"should stay log\"}",
    });

    expect(snapshot.sourceType).toBe("log");
    expect(snapshot.problemHint).toBeNull();
    expect(snapshot.confidenceHint).toBe("low");
  });

  it("keeps unknown fields null when the content does not ground them", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/random-output.txt",
      kind: "log",
      content: "still working\ncompare this later with codex output if needed\n",
    });

    expect(snapshot.providerLabel).toBeNull();
    expect(snapshot.appKind).toBeNull();
    expect(snapshot.taskHint).toBeNull();
    expect(snapshot.problemHint).toBeNull();
    expect(snapshot.contextPercent).toBeNull();
    expect(snapshot.tokenEtaMinutes).toBeNull();
    expect(snapshot.repeatedFailureKey).toBeNull();
    expect(snapshot.repeatedFailureCount).toBeNull();
    expect(snapshot.recentFileHints).toEqual([]);
    expect(snapshot.recentTestHints).toEqual([]);
    expect(snapshot.confidenceHint).toBe("low");
    expect(snapshot.updatedAt).toBeNull();
    expect(snapshot.staleReadyAt).toBeNull();
    expect(snapshot.stale).toBeNull();
  });

  it("downgrades stale summary confidence to low when the artifact is already stale", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/.codex/history.json",
      kind: "summary",
      now: new Date("2026-04-28T12:20:01.000Z"),
      content: JSON.stringify({
        provider: "codex",
        updatedAt: "2026-04-28T12:00:00.000Z",
      }),
    });

    expect(snapshot.staleReadyAt).toBe("2026-04-28T12:15:00.000Z");
    expect(snapshot.stale).toBe(true);
    expect(snapshot.confidenceHint).toBe("low");
  });

  it("infers Gemini from Gemini-compatible roots such as .antigravity", () => {
    const snapshot = parsePassiveArtifact({
      path: "/Users/tester/.antigravity/history.json",
      kind: "summary",
      content: JSON.stringify({
        updatedAt: "2026-04-28T12:05:00.000Z",
      }),
    });

    expect(snapshot.providerLabel).toBe("gemini");
    expect(snapshot.appKind).toBe("gemini");
  });

  it("parses a Pawtrol-managed summary path using the managed agent provider instead of generic pawtrol", () => {
    const snapshot = parsePassiveArtifact({
      path: "/Users/tester/.pawtrol/agents/gemini/session-summary.json",
      kind: "summary",
      now: new Date("2026-04-28T12:06:00.000Z"),
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
    });

    expect(snapshot.providerLabel).toBe("gemini");
    expect(snapshot.appKind).toBeNull();
    expect(snapshot.taskHint).toBe("fix overlay spinner");
    expect(snapshot.problemHint).toBe("loading state never appears");
    expect(snapshot.contextPercent).toBe(63);
    expect(snapshot.tokenEtaMinutes).toBe(11);
    expect(snapshot.repeatedFailureKey).toBe("loading state never appears");
    expect(snapshot.repeatedFailureCount).toBe(2);
    expect(snapshot.updatedAt).toBe("2026-04-28T12:05:00.000Z");
    expect(snapshot.staleReadyAt).toBeNull();
    expect(snapshot.stale).toBeNull();
  });
});
