import type {
  ActivityPhase,
  AgentOutputEvent,
  FailureKind,
  ResourceTrend,
  ResourceUsage,
  SessionSignals,
  StuckReason,
} from "./types.js";

const CONTEXT_WINDOW_ESTIMATE_CHARS = 160_000;

export function computeSignals(
  events: AgentOutputEvent[],
  resourceUsage: ResourceUsage,
  idleSeconds: number,
  totalObservedChars?: number,
): SessionSignals {
  const recentLines = events.slice(-80).map((event) => event.line);
  const failureCounts = new Map<string, number>();

  for (const line of recentLines) {
    const key = extractFailureKey(line);
    if (key) {
      failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1);
    }
  }

  let repeatedFailureKey: string | null = null;
  let repeatedFailureCount = 0;
  for (const [key, count] of failureCounts) {
    if (count > repeatedFailureCount) {
      repeatedFailureKey = key;
      repeatedFailureCount = count;
    }
  }

  const totalChars = totalObservedChars ?? events.reduce((sum, event) => sum + event.line.length, 0);
  const contextPercent = Math.min(95, Math.max(3, Math.round((totalChars / CONTEXT_WINDOW_ESTIMATE_CHARS) * 100)));
  const tokenEtaMinutes = extractTokenEtaMinutes(recentLines);
  const activityPhase = classifyActivityPhase(recentLines, idleSeconds);
  const failureKind = classifyFailureKind(recentLines);
  const stuckReason = classifyStuckReason(recentLines, repeatedFailureCount, idleSeconds);
  const resourceTrend = classifyResourceTrend(resourceUsage);

  return {
    recentLines,
    repeatedFailureCount,
    repeatedFailureKey,
    contextPercent,
    tokenEtaMinutes,
    resourceUsage,
    idleSeconds,
    activityPhase,
    failureKind,
    stuckReason,
    resourceTrend,
  };
}

function extractFailureKey(line: string): string | null {
  const failMatch = line.match(/\bFAIL\s+(.+)/i);
  if (failMatch?.[1]) {
    return failMatch[1].trim();
  }

  const errorMatch = line.match(/\b(error|failed|failure):\s*(.+)/i);
  if (errorMatch?.[2]) {
    return errorMatch[2].trim();
  }

  return null;
}

function extractTokenEtaMinutes(lines: string[]): number | null {
  for (const line of [...lines].reverse()) {
    const match = line.match(/token\s*eta\s*:\s*(\d+)\s*m/i);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }
  return null;
}

function classifyActivityPhase(lines: string[], idleSeconds: number): ActivityPhase {
  const text = lines.join("\n").toLowerCase();

  if (idleSeconds >= 60 || /\b(waiting|still waiting|no output)\b/.test(text)) {
    return "waiting";
  }

  if (/\b(npm|pnpm|yarn|bun)\s+(install|add|i)\b|\binstalling dependencies\b/.test(text)) {
    return "dependency_install";
  }

  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|vitest|jest|playwright)\b|\b(test|spec)\b/.test(text)) {
    return "test";
  }

  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|\btsc\b|\bbundl(e|ing)\b/.test(text)) {
    return "build";
  }

  if (/\b(editing|modified|writing|patching|apply_patch)\b|\.(ts|tsx|js|jsx|css|html|md|json)\b/.test(text)) {
    return "file_edit";
  }

  return "unknown";
}

function classifyFailureKind(lines: string[]): FailureKind | null {
  const text = lines.join("\n");
  const lower = text.toLowerCase();

  if (/\berror\s+ts\d+\b|type '.*' is not assignable|typescript/i.test(text)) {
    return "type_error";
  }

  if (/\b(enoent|no such file or directory|cannot find module|module not found)\b/i.test(text)) {
    return "missing_file";
  }

  if (/\b(401|403|unauthorized|forbidden|invalid api key|authentication|permission denied)\b/i.test(text)) {
    return "auth_error";
  }

  if (/\b(enotfound|econnreset|econnrefused|network|fetch failed|socket hang up|dns)\b/i.test(text)) {
    return "network_error";
  }

  if (/\b(timed out|timeout|exceeded \d+ms)\b/i.test(text)) {
    return "timeout";
  }

  if (/\b(build failed|npm err! build|failed to compile|compilation failed)\b/i.test(text)) {
    return "build_error";
  }

  if (/\bfail\s+.+\.(spec|test)\.[cm]?[jt]sx?\b|\btests?\s+failed\b|expect\(.*\)|assertionerror/i.test(text)) {
    return "test_failure";
  }

  if (lower.includes("error") || lower.includes("failed") || lower.includes("failure")) {
    return "unknown_error";
  }

  return null;
}

function classifyStuckReason(lines: string[], repeatedFailureCount: number, idleSeconds: number): StuckReason | null {
  if (repeatedFailureCount >= 3) {
    return "repeated_failure";
  }

  if (idleSeconds >= 90) {
    return "long_idle";
  }

  if (lines.length >= 80) {
    return "output_flood";
  }

  const fileCounts = new Map<string, number>();
  for (const line of lines) {
    for (const match of line.matchAll(/\b[\w./-]+\.(?:ts|tsx|js|jsx|css|html|md|json)\b/g)) {
      const file = match[0];
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  return [...fileCounts.values()].some((count) => count >= 4) ? "same_file_repeated" : null;
}

function classifyResourceTrend(resourceUsage: ResourceUsage): ResourceTrend {
  const highCpu = resourceUsage.cpuPercent >= 80;
  const highMemory = resourceUsage.memoryPercent >= 80;

  if (highCpu && highMemory) {
    return "high_cpu_memory";
  }

  if (highCpu) {
    return "high_cpu";
  }

  if (highMemory) {
    return "high_memory";
  }

  return "normal";
}
