import type { AntigravityAuthStatus, CodexAuthStatus } from "../auth/setup.js";
import { getRecommendedModel, resolveProvider } from "../coach/provider.js";

export type DesktopAuthSummary = {
  geminiConfigured: boolean;
  codex: CodexAuthStatus;
  antigravity: AntigravityAuthStatus;
  provider: string;
  recommendedModel: string;
  envPath: string;
};

export function buildAuthSummaryText(summary: DesktopAuthSummary): string {
  return [
    `Gemini API: ${summary.geminiConfigured ? "configured" : "missing"}`,
    `Codex CLI: ${summary.codex.installed ? "installed" : "missing"}`,
    `Codex auth: ${summary.codex.authenticated ? "authenticated" : "missing"}`,
    `Antigravity/Gemini command: ${summary.antigravity.installedCommand ?? "missing"}`,
    `Antigravity/Gemini auth: ${summary.antigravity.authenticated ? "ready" : "missing"}`,
    `Provider: ${summary.provider}`,
    `Model: ${summary.recommendedModel}`,
    `Env: ${summary.envPath}`,
  ].join("\n");
}

export function shouldShowFirstRunAuth(summary: DesktopAuthSummary): boolean {
  return !summary.geminiConfigured || !summary.codex.authenticated;
}

export function buildProviderSummary(env: Record<string, string | undefined>): Pick<DesktopAuthSummary, "provider" | "recommendedModel"> {
  const provider = resolveProvider("auto", env);
  return {
    provider,
    recommendedModel: getRecommendedModel(provider),
  };
}
