import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CoachResult, SessionSignals } from "./types.js";

export function buildPlanSnapshot(coach: CoachResult, signals: SessionSignals, provider: string): string {
  return [
    "# Puppy Session Plan",
    "",
    `Provider: ${provider}`,
    `Status: ${coach.status}`,
    `Problem: ${signals.repeatedFailureKey ?? "none"}`,
    `Context: ${signals.contextPercent}%`,
    `Token ETA: ${signals.tokenEtaMinutes === null ? "unknown" : `${signals.tokenEtaMinutes}m`}`,
    `Repeated failure count: ${signals.repeatedFailureCount}`,
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
  const outputDir = path.join(rootDir, ".puppy");
  const outputPath = path.join(outputDir, "session-plan.md");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, buildPlanSnapshot(coach, signals, provider), "utf8");
  return outputPath;
}
