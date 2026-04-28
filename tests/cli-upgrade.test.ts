import { describe, expect, it } from "vitest";
import { compareVersions, runUpgrade } from "../src/cli-upgrade.js";

describe("compareVersions", () => {
  it("orders semantic versions numerically", () => {
    expect(compareVersions("0.1.10", "0.1.9")).toBeGreaterThan(0);
    expect(compareVersions("0.1.7", "0.1.7")).toBe(0);
    expect(compareVersions("0.1.7", "0.1.8")).toBeLessThan(0);
  });
});

describe("runUpgrade", () => {
  it("skips npm install when Pawtrol is already current", async () => {
    const messages: string[] = [];
    let installed = false;

    const result = await runUpgrade({
      currentVersion: "0.1.7",
      getLatestVersion: async () => "0.1.7",
      installLatest: () => {
        installed = true;
        return { status: 0 };
      },
      write: (message) => messages.push(message),
    });

    expect(result).toBe(0);
    expect(installed).toBe(false);
    expect(messages.join("")).toContain("already up to date");
  });

  it("installs pawtrol@latest when npm has a newer version", async () => {
    const messages: string[] = [];
    let installCalled = false;
    let provisionCalled = false;

    const result = await runUpgrade({
      currentVersion: "0.1.7",
      getLatestVersion: async () => "0.1.8",
      installLatest: () => {
        installCalled = true;
        return { status: 0 };
      },
      provisionArtifacts: async () => {
        provisionCalled = true;
        return {
          codex: { status: "installed", artifactDir: "/Users/tester/.pawtrol/agents/codex", configPath: "/Users/tester/.codex/pawtrol-artifacts.conf" },
          claude: { status: "skipped", artifactDir: "/Users/tester/.pawtrol/agents/claude", configPath: "/Users/tester/.claude/pawtrol-artifacts.conf" },
          gemini: {
            status: "partial",
            artifactDir: "/Users/tester/.pawtrol/agents/gemini",
            configPath: "/Users/tester/.gemini/pawtrol-artifacts.conf",
            detail: "permission denied writing config",
          },
        };
      },
      write: (message) => messages.push(message),
    });

    expect(result).toBe(0);
    expect(installCalled).toBe(true);
    expect(provisionCalled).toBe(true);
    expect(messages.join("")).toContain("codex: installed");
    expect(messages.join("")).toContain("claude: skipped");
    expect(messages.join("")).toContain("gemini: partial");
    expect(messages.join("")).toContain("/Users/tester/.gemini/pawtrol-artifacts.conf");
    expect(messages.join("")).toContain("permission denied writing config");
    expect(messages.join("")).toContain("Gemini artifact wiring is partial; passive detect fallback remains active.");
    expect(messages.join("")).toContain("reopen Pawtrol");
  });

  it("reports Codex and Claude partial warnings explicitly during upgrade", async () => {
    const messages: string[] = [];

    await runUpgrade({
      currentVersion: "0.1.7",
      getLatestVersion: async () => "0.1.8",
      installLatest: () => ({ status: 0 }),
      provisionArtifacts: async () => ({
        codex: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/codex",
          configPath: "/Users/tester/.codex/pawtrol-artifacts.conf",
          detail: "permission denied",
        },
        claude: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/claude",
          configPath: "/Users/tester/.claude/pawtrol-artifacts.conf",
          detail: "permission denied",
        },
        gemini: {
          status: "installed",
          artifactDir: "/Users/tester/.pawtrol/agents/gemini",
          configPath: "/Users/tester/.gemini/pawtrol-artifacts.conf",
        },
      }),
      write: (message) => messages.push(message),
    });

    const output = messages.join("");
    expect(output).toContain("Codex artifact wiring is partial; passive detect fallback remains active.");
    expect(output).toContain("Claude artifact wiring is partial; passive detect fallback remains active.");
    expect(output).not.toContain("Gemini artifact wiring is partial; passive detect fallback remains active.");
  });

  it("reports every partial warning once when multiple agents remain partial", async () => {
    const messages: string[] = [];

    await runUpgrade({
      currentVersion: "0.1.7",
      getLatestVersion: async () => "0.1.8",
      installLatest: () => ({ status: 0 }),
      provisionArtifacts: async () => ({
        codex: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/codex",
          configPath: "/Users/tester/.codex/pawtrol-artifacts.conf",
        },
        claude: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/claude",
          configPath: "/Users/tester/.claude/pawtrol-artifacts.conf",
        },
        gemini: {
          status: "partial",
          artifactDir: "/Users/tester/.pawtrol/agents/gemini",
          configPath: "/Users/tester/.gemini/pawtrol-artifacts.conf",
        },
      }),
      write: (message) => messages.push(message),
    });

    const output = messages.join("");
    expect(output.match(/Codex artifact wiring is partial; passive detect fallback remains active\./g)?.length).toBe(1);
    expect(output.match(/Claude artifact wiring is partial; passive detect fallback remains active\./g)?.length).toBe(1);
    expect(output.match(/Gemini artifact wiring is partial; passive detect fallback remains active\./g)?.length).toBe(1);
  });

  it("returns a failure code when npm install fails", async () => {
    const messages: string[] = [];

    const result = await runUpgrade({
      currentVersion: "0.1.7",
      getLatestVersion: async () => "0.1.8",
      installLatest: () => ({ status: 1 }),
      write: (message) => messages.push(message),
    });

    expect(result).toBe(1);
    expect(messages.join("")).toContain("sudo npm install -g pawtrol@latest");
  });

  it("returns a failure code when the latest version cannot be checked", async () => {
    const messages: string[] = [];

    const result = await runUpgrade({
      currentVersion: "0.1.7",
      getLatestVersion: async () => {
        throw new Error("registry unavailable");
      },
      installLatest: () => ({ status: 0 }),
      write: (message) => messages.push(message),
    });

    expect(result).toBe(1);
    expect(messages.join("")).toContain("registry unavailable");
  });
});
