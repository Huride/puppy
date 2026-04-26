import { describe, expect, it } from "vitest";
import { getProviderDoctorRows, getRecommendedModel, resolveProvider } from "../src/coach/provider.js";

describe("resolveProvider", () => {
  it("uses Gemini first in auto mode when a Gemini key exists", () => {
    expect(resolveProvider("auto", { GEMINI_API_KEY: "set" })).toBe("gemini");
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
      { provider: "openai", configured: false, envVar: "OPENAI_API_KEY", recommendedModel: "gpt-5.2" },
      { provider: "claude", configured: true, envVar: "ANTHROPIC_API_KEY", recommendedModel: "claude-sonnet-4-5" },
    ]);
  });

  it("returns the recommended model for each provider mode", () => {
    expect(getRecommendedModel("gemini")).toBe("gemini-3-flash-preview");
    expect(getRecommendedModel("openai")).toBe("gpt-5.2");
    expect(getRecommendedModel("claude")).toBe("claude-sonnet-4-5");
    expect(getRecommendedModel("heuristic")).toBe("local-heuristic");
  });
});
