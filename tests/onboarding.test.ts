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
        codex: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/codex",
          configPath: "/Users/tester/.codex/pawtrol-artifacts.conf",
          detail: "config written but integration remains unverified",
        },
        claude: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/claude",
          configPath: "/Users/tester/.claude/pawtrol-artifacts.conf",
          detail: "config written but integration remains unverified",
        },
        gemini: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/gemini",
          configPath: "/Users/tester/.gemini/pawtrol-artifacts.conf",
        },
      }),
    ).toContain("Gemini passive artifact wiring is partial. Pawtrol will still fall back to passive detect.");
  });

  it("formats per-agent provisioning status and partial guidance for runtime reporting", () => {
    expect(
      formatProvisioningReport({
        codex: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/codex",
          configPath: "/Users/tester/.codex/pawtrol-artifacts.conf",
          detail: "config written but integration remains unverified",
        },
        claude: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/claude",
          configPath: "/Users/tester/.claude/pawtrol-artifacts.conf",
          detail: "config written but integration remains unverified",
        },
        gemini: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/gemini",
          configPath: "/Users/tester/.gemini/pawtrol-artifacts.conf",
          detail: "permission denied writing config",
        },
      }),
    ).toEqual([
      "Passive artifact provisioning:",
      "  codex: partial",
      "  claude: partial",
      "  gemini: partial",
      "    config: /Users/tester/.codex/pawtrol-artifacts.conf",
      "    detail: config written but integration remains unverified",
      "    config: /Users/tester/.claude/pawtrol-artifacts.conf",
      "    detail: config written but integration remains unverified",
      "    config: /Users/tester/.gemini/pawtrol-artifacts.conf",
      "    detail: permission denied writing config",
      "Codex passive artifact wiring is partial. Pawtrol will still fall back to passive detect.",
      "Claude passive artifact wiring is partial. Pawtrol will still fall back to passive detect.",
      "Gemini passive artifact wiring is partial. Pawtrol will still fall back to passive detect.",
    ]);
  });
});
