export type LlmProvider = "auto" | "gemini" | "openai" | "claude" | "heuristic";
export type ResolvedLlmProvider = Exclude<LlmProvider, "auto">;

type EnvLike = Record<string, string | undefined>;

export type ProviderDoctorRow = {
  provider: Exclude<ResolvedLlmProvider, "heuristic">;
  configured: boolean;
  envVar: string;
};

export function resolveProvider(provider: LlmProvider, env: EnvLike = process.env): ResolvedLlmProvider {
  if (provider !== "auto") {
    return provider;
  }

  if (env.GEMINI_API_KEY) {
    return "gemini";
  }

  if (env.OPENAI_API_KEY) {
    return "openai";
  }

  if (env.ANTHROPIC_API_KEY) {
    return "claude";
  }

  return "heuristic";
}

export function getProviderDoctorRows(env: EnvLike = process.env): ProviderDoctorRow[] {
  return [
    { provider: "gemini", configured: Boolean(env.GEMINI_API_KEY), envVar: "GEMINI_API_KEY" },
    { provider: "openai", configured: Boolean(env.OPENAI_API_KEY), envVar: "OPENAI_API_KEY" },
    { provider: "claude", configured: Boolean(env.ANTHROPIC_API_KEY), envVar: "ANTHROPIC_API_KEY" },
  ];
}
