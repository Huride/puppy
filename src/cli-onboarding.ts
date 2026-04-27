import { resolveProvider } from "./coach/provider.js";
import type { AntigravityAuthStatus, CodexAuthStatus } from "./auth/setup.js";

export type ConnectionChoiceId = "codex" | "openai" | "gemini" | "claude" | "antigravity" | "heuristic";

export type ConnectionChoice = {
  id: ConnectionChoiceId;
  label: string;
};

export type ConnectionStatus = {
  env: Record<string, string | undefined>;
  codex: CodexAuthStatus;
  antigravity: AntigravityAuthStatus;
};

export function needsConnectionSetup(status: ConnectionStatus): boolean {
  const provider = resolveProvider("auto", status.env);
  if (provider === "gemini" || provider === "openai" || provider === "claude") {
    return false;
  }

  if (provider === "codex") {
    return !status.codex.authenticated;
  }

  return !status.codex.authenticated && !status.antigravity.authenticated;
}

export function getConnectionChoices(): ConnectionChoice[] {
  return [
    { id: "codex", label: "Codex auth" },
    { id: "openai", label: "OpenAI API key" },
    { id: "gemini", label: "Gemini API key" },
    { id: "claude", label: "Claude API key" },
    { id: "antigravity", label: "Antigravity/Gemini auth" },
    { id: "heuristic", label: "Continue with local heuristic" },
  ];
}

export function parseConnectionChoice(value: string): ConnectionChoiceId | undefined {
  const trimmed = value.trim().toLowerCase();
  const choices = getConnectionChoices();
  const numberChoice = Number.parseInt(trimmed, 10);
  if (Number.isInteger(numberChoice) && numberChoice >= 1 && numberChoice <= choices.length) {
    return choices[numberChoice - 1].id;
  }

  return choices.find((choice) => choice.id === trimmed)?.id;
}
