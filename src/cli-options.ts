import type { LlmProvider } from "./coach/provider.js";

export type CliOptions =
  | { mode: "doctor" }
  | {
      mode: "watch";
      provider: LlmProvider;
      model: string | undefined;
      sharePlan: boolean;
      command: string[];
    };

const providers = new Set<LlmProvider>(["auto", "gemini", "openai", "claude", "heuristic"]);

export function parseCliArgs(argv: string[]): CliOptions {
  const [subcommand, ...rest] = argv;

  if (subcommand === "doctor") {
    return { mode: "doctor" };
  }

  if (subcommand !== "watch") {
    throw new Error("Usage: puppy doctor | puppy watch [--provider auto|gemini|openai|claude|heuristic] [--model <name>] [--share-plan] -- <command>");
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
        throw new Error("--provider must be one of auto, gemini, openai, claude, heuristic");
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
