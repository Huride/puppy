import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CoachResult, SessionSignals } from "./types.js";

export function buildPlanSnapshot(coach: CoachResult, signals: SessionSignals, provider: string): string {
  return [
    "# Pawtrol Session Plan",
    "",
    `Provider: ${provider}`,
    `Status: ${coach.status}`,
    `Problem: ${signals.repeatedFailureKey ?? "none"}`,
    `Context: ${signals.contextPercent}%`,
    `Token ETA: ${signals.tokenEtaMinutes === null ? "unknown" : `${signals.tokenEtaMinutes}m`}`,
    `Repeated failure count: ${signals.repeatedFailureCount}`,
    `Activity phase: ${signals.activityPhase}`,
    `Failure kind: ${signals.failureKind ?? "none"}`,
    `Stuck reason: ${signals.stuckReason ?? "none"}`,
    `Resource trend: ${signals.resourceTrend}`,
    `CPU: ${Math.round(signals.resourceUsage.cpuPercent)}%`,
    `Memory: ${Math.round(signals.resourceUsage.memoryPercent)}%`,
    "",
    "## AI Summary",
    coach.summary,
    "",
    "## Risk",
    coach.risk,
    "",
    "## Recommended Next Step",
    `Recommended next step: ${coach.recommendation}`,
    `Immediate action: ${coach.nextAction}`,
    "",
    "## Evidence",
    ...(coach.evidence.length > 0 ? coach.evidence.map((line) => `- ${line}`) : ["- none"]),
    "",
    "## Recent Lines",
    ...signals.recentLines.slice(-20).map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function writePlanSnapshot(
  rootDir: string,
  coach: CoachResult,
  signals: SessionSignals,
  provider: string,
): Promise<string> {
  const outputDir = path.join(rootDir, ".pawtrol");
  const outputPath = path.join(outputDir, "session-plan.md");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, buildPlanSnapshot(coach, signals, provider), "utf8");
  return outputPath;
}
