import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ApiLlmProvider, ResolvedLlmProvider } from "../coach/provider.js";
import { provisionAgentArtifacts, type AgentArtifactProvisionSummary } from "../session/agent-artifact-install.js";

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

export type AuthSetupProvisionOptions = {
  provisionArtifacts?: () => Promise<AgentArtifactProvisionSummary>;
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

export function saveGeminiApiKey(apiKey: string, cwd = process.cwd(), options: AuthSetupProvisionOptions = {}): string {
  return saveProviderApiKey("gemini", apiKey, cwd, options);
}

export function saveOpenAIApiKey(apiKey: string, cwd = process.cwd(), options: AuthSetupProvisionOptions = {}): string {
  return saveProviderApiKey("openai", apiKey, cwd, options);
}

export function saveClaudeApiKey(apiKey: string, cwd = process.cwd(), options: AuthSetupProvisionOptions = {}): string {
  return saveProviderApiKey("claude", apiKey, cwd, options);
}

export function saveActiveProvider(provider: ResolvedLlmProvider, cwd = process.cwd(), options: AuthSetupProvisionOptions = {}): string {
  const envPath = path.join(cwd, ".env.local");
  const previous = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  writeFileSync(envPath, upsertEnvValue(previous, "PAWTROL_PROVIDER", provider), { encoding: "utf8", mode: 0o600 });
  process.env.PAWTROL_PROVIDER = provider;
  triggerGlobalArtifactProvisioning(options);
  return envPath;
}

export function readGeminiKeyFromEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.GEMINI_API_KEY?.trim() || undefined;
}

export function readProviderKeyFromEnv(
  provider: ApiLlmProvider,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env[getProviderEnvVar(provider)]?.trim() || undefined;
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
        ? `${installedCommand} 명령과 GEMINI_API_KEY를 확인했어요. Pawtrol이 실행하는 세션에는 이 키를 전달할 수 있어요.`
        : "GEMINI_API_KEY를 확인했어요. Antigravity/Gemini CLI 명령은 아직 찾지 못했어요.",
    };
  }

  return {
    installedCommand,
    apiKeyConfigured,
    authenticated: false,
    detail: installedCommand
      ? `${installedCommand} 명령은 있지만 GEMINI_API_KEY가 없어요. Pawtrol에서는 API 키를 먼저 연결해야 해요.`
      : "Antigravity/Gemini CLI 명령과 GEMINI_API_KEY를 아직 찾지 못했어요.",
  };
}

export function saveAntigravityApiKey(apiKey: string, cwd = process.cwd(), options: AuthSetupProvisionOptions = {}): string {
  return saveGeminiApiKey(apiKey, cwd, options);
}

export async function provisionGlobalArtifactsForAuthSetup(): Promise<AgentArtifactProvisionSummary> {
  return provisionAgentArtifacts({
    homeDir: os.homedir(),
    env: process.env,
  });
}

function saveProviderApiKey(
  provider: ApiLlmProvider,
  apiKey: string,
  cwd = process.cwd(),
  options: AuthSetupProvisionOptions = {},
): string {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error(`${provider} API key is empty`);
  }

  const envPath = path.join(cwd, ".env.local");
  const previous = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const withKey = upsertEnvValue(previous, getProviderEnvVar(provider), trimmedKey);
  writeFileSync(envPath, upsertEnvValue(withKey, "PAWTROL_PROVIDER", provider), { encoding: "utf8", mode: 0o600 });
  process.env[getProviderEnvVar(provider)] = trimmedKey;
  process.env.PAWTROL_PROVIDER = provider;
  triggerGlobalArtifactProvisioning(options);
  return envPath;
}

function getProviderEnvVar(provider: ApiLlmProvider): "GEMINI_API_KEY" | "OPENAI_API_KEY" | "ANTHROPIC_API_KEY" {
  if (provider === "gemini") {
    return "GEMINI_API_KEY";
  }

  if (provider === "openai") {
    return "OPENAI_API_KEY";
  }

  return "ANTHROPIC_API_KEY";
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

function triggerGlobalArtifactProvisioning(options: AuthSetupProvisionOptions): void {
  void (options.provisionArtifacts ?? provisionGlobalArtifactsForAuthSetup)().catch(() => undefined);
}
