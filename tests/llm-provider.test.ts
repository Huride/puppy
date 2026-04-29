import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getProviderDoctorRows, getRecommendedModel, normalizeActiveProvider, resolveProvider } from "../src/coach/provider.js";

describe("resolveProvider", () => {
  it("uses Gemini first in auto mode when a Gemini key exists", () => {
    expect(resolveProvider("auto", { GEMINI_API_KEY: "set" })).toBe("gemini");
  });

  it("prefers Codex in auto mode when Codex auth exists", () => {
    const codexHome = mkdtempSync(path.join(os.tmpdir(), "pawtrol-codex-home-"));
    writeFileSync(path.join(codexHome, "auth.json"), "{}");

    expect(resolveProvider("auto", { CODEX_HOME: codexHome, GEMINI_API_KEY: "set" })).toBe("codex");
  });

  it("treats Antigravity as a Gemini auth connection", () => {
    expect(normalizeActiveProvider("antigravity")).toBe("gemini");
    expect(resolveProvider("auto", { PAWTROL_PROVIDER: "antigravity", GEMINI_API_KEY: "set" })).toBe("gemini");
  });

  it("uses the active login provider first when its key is configured", () => {
    expect(resolveProvider("auto", { PAWTROL_PROVIDER: "openai", GEMINI_API_KEY: "set", OPENAI_API_KEY: "set" })).toBe(
      "openai",
    );
  });

  it("uses Codex auth as the active provider without an API key", () => {
    const codexHome = mkdtempSync(path.join(os.tmpdir(), "pawtrol-codex-home-"));
    writeFileSync(path.join(codexHome, "auth.json"), "{}");

    expect(resolveProvider("auto", { PAWTROL_PROVIDER: "codex", CODEX_HOME: codexHome })).toBe("codex");
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
