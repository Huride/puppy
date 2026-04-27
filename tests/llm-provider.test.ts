import { describe, expect, it } from "vitest";
import { getProviderDoctorRows, getRecommendedModel, resolveProvider } from "../src/coach/provider.js";

describe("resolveProvider", () => {
  it("uses Gemini first in auto mode when a Gemini key exists", () => {
    expect(resolveProvider("auto", { GEMINI_API_KEY: "set" })).toBe("gemini");
  });

  it("uses the active login provider first when its key is configured", () => {
    expect(resolveProvider("auto", { PAWTROL_PROVIDER: "openai", GEMINI_API_KEY: "set", OPENAI_API_KEY: "set" })).toBe(
      "openai",
    );
  });

  it("uses Codex auth as the active provider without an API key", () => {
    expect(resolveProvider("auto", { PAWTROL_PROVIDER: "codex" })).toBe("codex");
  });

  it("ignores a stale active provider when its key is missing", () => {
    expect(resolveProvider("auto", { PAWTROL_PROVIDER: "openai", GEMINI_API_KEY: "set" })).toBe("gemini");
  });

  it("falls through to OpenAI and Claude in auto mode", () => {
    expect(resolveProvider("auto", { OPENAI_API_KEY: "set" })).toBe("openai");
    expect(resolveProvider("auto", { ANTHROPIC_API_KEY: "set" })).toBe("claude");
  });

  it("uses heuristic when no key is configured", () => {
    expect(resolveProvider("auto", {})).toBe("heuristic");
  });
});

describe("getProviderDoctorRows", () => {
  it("reports configured providers without exposing keys", () => {
    expect(
      getProviderDoctorRows({
        GEMINI_API_KEY: "secret-gemini",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "secret-claude",
      }),
    ).toEqual([
      { provider: "gemini", configured: true, envVar: "GEMINI_API_KEY", recommendedModel: "gemini-3-flash-preview" },
      { provider: "openai", configured: false, envVar: "OPENAI_API_KEY", recommendedModel: "gpt-5.4-mini" },
      { provider: "claude", configured: true, envVar: "ANTHROPIC_API_KEY", recommendedModel: "claude-sonnet-4-6" },
    ]);
  });

  it("returns the recommended model for each provider mode", () => {
    expect(getRecommendedModel("gemini")).toBe("gemini-3-flash-preview");
    expect(getRecommendedModel("openai")).toBe("gpt-5.4-mini");
    expect(getRecommendedModel("claude")).toBe("claude-sonnet-4-6");
    expect(getRecommendedModel("codex")).toBe("codex-auth");
    expect(getRecommendedModel("heuristic")).toBe("local-heuristic");
  });
});
