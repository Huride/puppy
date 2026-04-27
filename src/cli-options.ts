import type { LlmProvider } from "./coach/provider.js";

export type CliOptions =
  | { mode: "companion" }
  | { mode: "version" }
  | { mode: "upgrade" }
  | { mode: "setup" }
  | { mode: "companion-server" }
  | { mode: "doctor" }
  | { mode: "auth"; target: "gemini" | "openai" | "claude" | "codex" | "antigravity"; apiKey: string | undefined; statusOnly: boolean }
  | {
      mode: "watch";
      provider: LlmProvider;
      model: string | undefined;
      sharePlan: boolean;
      command: string[];
    };

const providers = new Set<LlmProvider>(["auto", "gemini", "openai", "claude", "codex", "heuristic"]);

export function parseCliArgs(argv: string[]): CliOptions {
  const [subcommand, ...rest] = argv;

  if (!subcommand) {
    return { mode: "companion" };
  }

  if (subcommand === "--version" || subcommand === "-v" || subcommand === "version") {
    return { mode: "version" };
  }

  if (subcommand === "--upgrade" || subcommand === "upgrade") {
    return { mode: "upgrade" };
  }

  if (subcommand === "setup") {
    return { mode: "setup" };
  }

  if (subcommand === "companion-server") {
    return { mode: "companion-server" };
  }

  if (subcommand === "doctor") {
    return { mode: "doctor" };
  }

  if (subcommand === "auth" || subcommand === "login") {
    return parseAuthArgs(rest);
  }

  if (subcommand !== "watch") {
    throw new Error(buildUsage());
  }

  const separatorIndex = rest.indexOf("--");
  const optionArgs = separatorIndex === -1 ? [] : rest.slice(0, separatorIndex);
  const command = separatorIndex === -1 ? rest : rest.slice(separatorIndex + 1);
  let provider: LlmProvider = "auto";
  let model: string | undefined;
  let sharePlan = false;

  for (let index = 0; index < optionArgs.length; index += 1) {
    const arg = optionArgs[index];

    if (arg === "--provider") {
      const value = optionArgs[index + 1] as LlmProvider | undefined;
      if (!value || !providers.has(value)) {
        throw new Error("--provider must be one of auto, gemini, openai, claude, codex, heuristic");
      }

      provider = value;
      index += 1;
      continue;
    }

    if (arg === "--model") {
      model = optionArgs[index + 1];
      if (!model) {
        throw new Error("--model requires a model name");
      }

      index += 1;
      continue;
    }

    if (arg === "--share-plan") {
      sharePlan = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    mode: "watch",
    provider,
    model,
    sharePlan,
    command,
  };
}

function parseAuthArgs(args: string[]): CliOptions {
  const [target, ...rest] = args;
  if (target !== "gemini" && target !== "openai" && target !== "claude" && target !== "codex" && target !== "antigravity") {
    throw new Error(
      "Usage: pawtrol login gemini|openai|claude|antigravity --key <api-key> | pawtrol login codex [--status]",
    );
  }

  let apiKey: string | undefined;
  let statusOnly = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--key") {
      apiKey = rest[index + 1];
      if (!apiKey) {
        throw new Error("--key requires a value");
      }
      index += 1;
      continue;
    }

    if (arg === "--status") {
      statusOnly = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (target === "codex" && apiKey) {
    throw new Error("Codex auth uses the Codex CLI login flow. Use: pawtrol login codex");
  }

  return { mode: "auth", target, apiKey, statusOnly };
}

function buildUsage(): string {
  return [
    "Usage:",
    "  pawtrol",
    "  pawtrol --version",
    "  pawtrol --upgrade",
    "  pawtrol setup",
    "  pawtrol doctor",
    "  pawtrol login gemini|openai|claude|antigravity --key <api-key>",
    "  pawtrol login codex [--status]",
    "  pawtrol auth gemini [--key <api-key>]",
    "  pawtrol auth openai [--key <api-key>]",
    "  pawtrol auth claude [--key <api-key>]",
    "  pawtrol auth codex [--status]",
    "  pawtrol auth antigravity [--key <api-key>] [--status]",
    "  pawtrol watch [--provider auto|gemini|openai|claude|codex|heuristic] [--model <name>] [--share-plan] -- <command>",
  ].join("\n");
}
