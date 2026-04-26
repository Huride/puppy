export type LlmProvider = "auto" | "gemini" | "openai" | "claude" | "heuristic";
export type ResolvedLlmProvider = Exclude<LlmProvider, "auto">;

type EnvLike = Record<string, string | undefined>;

export type ProviderDoctorRow = {
  provider: Exclude<ResolvedLlmProvider, "heuristic">;
  configured: boolean;
  envVar: string;
  recommendedModel: string;
};

export const DEFAULT_PROVIDER_MODELS = {
  gemini: "gemini-3-flash-preview",
  openai: "gpt-5.2",
  claude: "claude-sonnet-4-5",
} as const;

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
    { provider: "gemini", configured: Boolean(env.GEMINI_API_KEY), envVar: "GEMINI_API_KEY", recommendedModel: DEFAULT_PROVIDER_MODELS.gemini },
    { provider: "openai", configured: Boolean(env.OPENAI_API_KEY), envVar: "OPENAI_API_KEY", recommendedModel: DEFAULT_PROVIDER_MODELS.openai },
    { provider: "claude", configured: Boolean(env.ANTHROPIC_API_KEY), envVar: "ANTHROPIC_API_KEY", recommendedModel: DEFAULT_PROVIDER_MODELS.claude },
  ];
}

export function getRecommendedModel(provider: ResolvedLlmProvider): string {
  return provider === "heuristic" ? "local-heuristic" : DEFAULT_PROVIDER_MODELS[provider];
}
