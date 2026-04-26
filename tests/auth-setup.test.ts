import { describe, expect, it } from "vitest";
import {
  parseCodexAuthStatus,
  readGeminiKeyFromEnv,
  resolveAntigravityAuthStatus,
  upsertEnvValue,
} from "../src/auth/setup.js";

describe("auth setup", () => {
  it("adds a Gemini key to an empty env file", () => {
    expect(upsertEnvValue("", "GEMINI_API_KEY", "test-key")).toBe("GEMINI_API_KEY=test-key\n");
  });

  it("replaces an existing Gemini key without changing other values", () => {
    expect(upsertEnvValue("OPENAI_API_KEY=openai\nGEMINI_API_KEY=old\n", "GEMINI_API_KEY", "new")).toBe(
      "OPENAI_API_KEY=openai\nGEMINI_API_KEY=new\n",
    );
  });

  it("reads Gemini keys from the environment without exposing values elsewhere", () => {
    expect(readGeminiKeyFromEnv({ GEMINI_API_KEY: "  key-from-env  " })).toBe("key-from-env");
    expect(readGeminiKeyFromEnv({})).toBeUndefined();
  });

  it("detects logged-in Codex status output", () => {
    expect(parseCodexAuthStatus("Logged in using ChatGPT\n", 0)).toEqual({
      installed: true,
      authenticated: true,
      detail: "Logged in using ChatGPT",
    });
  });

  it("detects missing Codex auth without treating it as installed failure", () => {
    expect(parseCodexAuthStatus("Not logged in\n", 1)).toEqual({
      installed: true,
      authenticated: false,
      detail: "Not logged in",
    });
  });

  it("treats Antigravity as ready when a Gemini key is configured", () => {
    expect(resolveAntigravityAuthStatus("gemini", { GEMINI_API_KEY: "key" })).toEqual({
      installedCommand: "gemini",
      apiKeyConfigured: true,
      authenticated: true,
      detail: "gemini 명령과 GEMINI_API_KEY를 확인했어요. Pawtrol이 실행하는 세션에는 이 키를 전달할 수 있어요.",
    });
  });

  it("reports Antigravity as missing when neither command nor key is available", () => {
    expect(resolveAntigravityAuthStatus(null, {})).toEqual({
      installedCommand: null,
      apiKeyConfigured: false,
      authenticated: false,
      detail: "Antigravity/Gemini CLI 명령과 GEMINI_API_KEY를 아직 찾지 못했어요.",
    });
  });
});
