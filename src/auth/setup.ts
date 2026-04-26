import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CodexAuthStatus = {
  installed: boolean;
  authenticated: boolean;
  detail: string;
};

export type AntigravityAuthStatus = {
  installedCommand: "antigravity" | "gemini" | null;
  apiKeyConfigured: boolean;
  authenticated: boolean;
  detail: string;
};

export function upsertEnvValue(content: string, key: string, value: string): string {
  const trimmedValue = value.trim();
  if (!content.trim()) {
    return `${key}=${trimmedValue}\n`;
  }

  const lines = content.split(/\r?\n/);
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  let replaced = false;
  const nextLines = lines.map((line) => {
    if (keyPattern.test(line)) {
      replaced = true;
      return `${key}=${trimmedValue}`;
    }

    return line;
  });

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(`${key}=${trimmedValue}`);
  }

  return `${nextLines.join("\n").replace(/\n+$/, "")}\n`;
}

export function saveGeminiApiKey(apiKey: string, cwd = process.cwd()): string {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Gemini API key is empty");
  }

  const envPath = path.join(cwd, ".env.local");
  const previous = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  writeFileSync(envPath, upsertEnvValue(previous, "GEMINI_API_KEY", trimmedKey), { encoding: "utf8", mode: 0o600 });
  process.env.GEMINI_API_KEY = trimmedKey;
  return envPath;
}

export function readGeminiKeyFromEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.GEMINI_API_KEY?.trim() || undefined;
}

export async function getCodexAuthStatus(): Promise<CodexAuthStatus> {
  try {
    const result = await execFileAsync("codex", ["login", "status"], { timeout: 4_000 });
    return parseCodexAuthStatus(`${result.stdout}${result.stderr}`, 0);
  } catch (error) {
    const maybeError = error as { code?: unknown; stdout?: unknown; stderr?: unknown };
    if (maybeError.code === "ENOENT") {
      return {
        installed: false,
        authenticated: false,
        detail: "Codex CLI를 찾지 못했어요. 먼저 Codex CLI를 설치해야 해요.",
      };
    }

    return parseCodexAuthStatus(`${String(maybeError.stdout ?? "")}${String(maybeError.stderr ?? "")}`, 1);
  }
}

export async function getAntigravityAuthStatus(
  env: Record<string, string | undefined> = process.env,
): Promise<AntigravityAuthStatus> {
  const installedCommand = (await commandExists("antigravity")) ? "antigravity" : (await commandExists("gemini")) ? "gemini" : null;
  return resolveAntigravityAuthStatus(installedCommand, env);
}

export function resolveAntigravityAuthStatus(
  installedCommand: "antigravity" | "gemini" | null,
  env: Record<string, string | undefined> = process.env,
): AntigravityAuthStatus {
  const apiKeyConfigured = Boolean(readGeminiKeyFromEnv(env));

  if (apiKeyConfigured) {
    return {
      installedCommand,
      apiKeyConfigured,
      authenticated: true,
      detail: installedCommand
        ? `${installedCommand} 명령과 GEMINI_API_KEY를 확인했어요. Puppy가 실행하는 세션에는 이 키를 전달할 수 있어요.`
        : "GEMINI_API_KEY를 확인했어요. Antigravity/Gemini CLI 명령은 아직 찾지 못했어요.",
    };
  }

  return {
    installedCommand,
    apiKeyConfigured,
    authenticated: false,
    detail: installedCommand
      ? `${installedCommand} 명령은 있지만 GEMINI_API_KEY가 없어요. Puppy에서는 API 키를 먼저 연결해야 해요.`
      : "Antigravity/Gemini CLI 명령과 GEMINI_API_KEY를 아직 찾지 못했어요.",
  };
}

export function saveAntigravityApiKey(apiKey: string, cwd = process.cwd()): string {
  return saveGeminiApiKey(apiKey, cwd);
}

export function parseCodexAuthStatus(output: string, exitCode: number): CodexAuthStatus {
  const normalized = output.toLowerCase();
  const loggedIn = normalized.includes("logged in");
  const loggedOut =
    normalized.includes("not logged in") ||
    normalized.includes("logged out") ||
    normalized.includes("no login") ||
    normalized.includes("not authenticated");

  if (exitCode === 0 && loggedIn && !loggedOut) {
    return {
      installed: true,
      authenticated: true,
      detail: firstUsefulLine(output) || "Codex CLI가 로그인되어 있어요.",
    };
  }

  return {
    installed: true,
    authenticated: false,
    detail: firstUsefulLine(output) || "Codex CLI 로그인 상태를 확인하지 못했어요.",
  };
}

function firstUsefulLine(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("WARNING:")) ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["--version"], { timeout: 4_000 });
    return true;
  } catch (error) {
    const maybeError = error as { code?: unknown };
    return maybeError.code !== "ENOENT";
  }
}
