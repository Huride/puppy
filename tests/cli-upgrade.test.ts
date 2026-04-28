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
          gemini: { status: "partial", artifactDir: "/Users/tester/.pawtrol/agents/gemini", configPath: "/Users/tester/.gemini/pawtrol-artifacts.conf" },
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
    expect(messages.join("")).toContain("reopen Pawtrol");
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
