import { describe, expect, it } from "vitest";
import { getConnectionChoices, needsConnectionSetup } from "../src/cli-onboarding.js";

describe("Pawtrol onboarding", () => {
  it("requires setup when no API provider or Codex auth is available", () => {
    expect(
      needsConnectionSetup({
        env: {},
        codex: { installed: true, authenticated: false, detail: "Not logged in" },
        antigravity: { installedCommand: null, apiKeyConfigured: false, authenticated: false, detail: "missing" },
      }),
    ).toBe(true);
  });

  it("does not require setup when Codex auth is available", () => {
    expect(
      needsConnectionSetup({
        env: {},
        codex: { installed: true, authenticated: true, detail: "Logged in using ChatGPT" },
        antigravity: { installedCommand: null, apiKeyConfigured: false, authenticated: false, detail: "missing" },
      }),
    ).toBe(false);
  });

  it("requires setup when Codex is selected but auth is missing", () => {
    expect(
      needsConnectionSetup({
        env: { PAWTROL_PROVIDER: "codex" },
        codex: { installed: true, authenticated: false, detail: "Not logged in" },
        antigravity: { installedCommand: null, apiKeyConfigured: false, authenticated: false, detail: "missing" },
      }),
    ).toBe(true);
  });

  it("offers API, auth, and local heuristic choices", () => {
    expect(getConnectionChoices().map((choice) => choice.id)).toEqual([
      "codex",
      "openai",
      "gemini",
      "claude",
      "antigravity",
      "heuristic",
    ]);
  });
});
