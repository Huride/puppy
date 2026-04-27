export type LlmProvider = "auto" | "gemini" | "openai" | "claude" | "codex" | "heuristic";
export type ResolvedLlmProvider = Exclude<LlmProvider, "auto">;
export type ApiLlmProvider = Exclude<ResolvedLlmProvider, "codex" | "heuristic">;

type EnvLike = Record<string, string | undefined>;

export type ProviderDoctorRow = {
  provider: ApiLlmProvider;
  configured: boolean;
  envVar: string;
  recommendedModel: string;
};

export const DEFAULT_PROVIDER_MODELS = {
  gemini: "gemini-3-flash-preview",
  openai: "gpt-5.4-mini",
  claude: "claude-sonnet-4-6",
  codex: "codex-auth",
} as const;

export function resolveProvider(provider: LlmProvider, env: EnvLike = process.env): ResolvedLlmProvider {
  if (provider !== "auto") {
    return provider;
  }

  const activeProvider = normalizeActiveProvider(env.PAWTROL_PROVIDER);
  if (activeProvider && isProviderConfigured(activeProvider, env)) {
    return activeProvider;
  }

  if (isProviderConfigured("gemini", env)) {
    return "gemini";
  }

  if (isProviderConfigured("openai", env)) {
    return "openai";
  }

  if (isProviderConfigured("claude", env)) {
    return "claude";
  }

  return "heuristic";
}

export function getProviderDoctorRows(env: EnvLike = process.env): ProviderDoctorRow[] {
  return [
    { provider: "gemini", configured: isProviderConfigured("gemini", env), envVar: "GEMINI_API_KEY", recommendedModel: DEFAULT_PROVIDER_MODELS.gemini },
    { provider: "openai", configured: isProviderConfigured("openai", env), envVar: "OPENAI_API_KEY", recommendedModel: DEFAULT_PROVIDER_MODELS.openai },
    { provider: "claude", configured: isProviderConfigured("claude", env), envVar: "ANTHROPIC_API_KEY", recommendedModel: DEFAULT_PROVIDER_MODELS.claude },
  ];
}

export function getRecommendedModel(provider: ResolvedLlmProvider): string {
  return provider === "heuristic" ? "local-heuristic" : DEFAULT_PROVIDER_MODELS[provider];
}

export function normalizeActiveProvider(provider: string | undefined): ResolvedLlmProvider | undefined {
  if (provider === "antigravity") {
    return "gemini";
  }

  if (provider === "gemini" || provider === "openai" || provider === "claude" || provider === "codex" || provider === "heuristic") {
    return provider;
  }

  return undefined;
}

export function isProviderConfigured(provider: ResolvedLlmProvider, env: EnvLike = process.env): boolean {
  if (provider === "heuristic") {
    return true;
  }

  if (provider === "codex") {
    return true;
  }

  if (provider === "gemini") {
    return Boolean(env.GEMINI_API_KEY?.trim());
  }

  if (provider === "openai") {
    return Boolean(env.OPENAI_API_KEY?.trim());
  }

  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}
