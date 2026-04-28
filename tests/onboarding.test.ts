import { describe, expect, it } from "vitest";
import { formatProvisioningReport, getConnectionChoices, getProvisioningGuidance, needsConnectionSetup } from "../src/cli-onboarding.js";

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

  it("surfaces passive detect guidance when Gemini wiring remains partial", () => {
    expect(
      getProvisioningGuidance({
        codex: { status: "installed", artifactDir: "/Users/tester/.pawtrol/agents/codex" },
        claude: { status: "installed", artifactDir: "/Users/tester/.pawtrol/agents/claude" },
        gemini: { status: "partial", artifactDir: "/Users/tester/.pawtrol/agents/gemini" },
      }),
    ).toContain("Gemini passive artifact wiring is partial. Pawtrol will still fall back to passive detect.");
  });

  it("formats per-agent provisioning status and partial guidance for runtime reporting", () => {
    expect(
      formatProvisioningReport({
        codex: { status: "installed", artifactDir: "/Users/tester/.pawtrol/agents/codex" },
        claude: { status: "skipped", artifactDir: "/Users/tester/.pawtrol/agents/claude" },
        gemini: { status: "partial", artifactDir: "/Users/tester/.pawtrol/agents/gemini" },
      }),
    ).toEqual([
      "Passive artifact provisioning:",
      "  codex: installed",
      "  claude: skipped",
      "  gemini: partial",
      "Gemini passive artifact wiring is partial. Pawtrol will still fall back to passive detect.",
    ]);
  });
});
