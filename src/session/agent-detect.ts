import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RunningAgentKind = "codex" | "claude" | "antigravity" | "gemini";

export type RunningAgent = {
  pid: number;
  kind: RunningAgentKind;
  command: string;
};

export async function detectRunningAgents(): Promise<RunningAgent[]> {
  try {
    const result = await execFileAsync("ps", ["-axo", "pid=,comm=,args="], { timeout: 4_000, maxBuffer: 1024 * 1024 });
    return parseRunningAgents(result.stdout);
  } catch {
    return [];
  }
}

export function parseRunningAgents(output: string): RunningAgent[] {
  const agents: RunningAgent[] = [];
  const seen = new Set<number>();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      continue;
    }

    const pid = Number.parseInt(match[1], 10);
    const command = match[2].trim();
    if (!Number.isFinite(pid) || seen.has(pid) || isPawtrolProcess(command)) {
      continue;
    }

    const kind = detectAgentKind(command);
    if (!kind) {
      continue;
    }

    seen.add(pid);
    agents.push({ pid, kind, command });
  }

  return agents;
}

function detectAgentKind(command: string): RunningAgentKind | undefined {
  const normalized = command.toLowerCase();
  if (hasCommandToken(normalized, "codex")) {
    return "codex";
  }

  if (hasCommandToken(normalized, "claude")) {
    return "claude";
  }

  if (hasCommandToken(normalized, "antigravity")) {
    return "antigravity";
  }

  if (hasCommandToken(normalized, "gemini")) {
    return "gemini";
  }

  return undefined;
}

function isPawtrolProcess(command: string): boolean {
  const normalized = command.toLowerCase();
  return normalized.includes("pawtrol") || normalized.includes("dist/src/cli.js") || normalized.includes("src/cli.ts");
}

function hasCommandToken(command: string, token: string): boolean {
  return new RegExp(`(^|[/\\s])${token}(\\s|$)`).test(command);
}
