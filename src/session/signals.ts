import type { AgentOutputEvent, ResourceUsage, SessionSignals } from "./types.js";

const CONTEXT_WINDOW_ESTIMATE_CHARS = 160_000;

export function computeSignals(
  events: AgentOutputEvent[],
  resourceUsage: ResourceUsage,
  idleSeconds: number,
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

  const totalChars = events.reduce((sum, event) => sum + event.line.length, 0);
  const contextPercent = Math.min(95, Math.max(3, Math.round((totalChars / CONTEXT_WINDOW_ESTIMATE_CHARS) * 100)));
  const tokenEtaMinutes = extractTokenEtaMinutes(recentLines);

  return {
    recentLines,
    repeatedFailureCount,
    repeatedFailureKey,
    contextPercent,
    tokenEtaMinutes,
    resourceUsage,
    idleSeconds,
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
