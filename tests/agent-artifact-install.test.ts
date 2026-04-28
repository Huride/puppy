import { describe, expect, it } from "vitest";
import { provisionAgentArtifacts } from "../src/session/agent-artifact-install.js";

describe("provisionAgentArtifacts", () => {
  it("reports unverified wiring conservatively even when the Pawtrol-managed block is written", async () => {
    const result = await provisionAgentArtifacts({
      homeDir: "/Users/tester",
      env: {},
      readFile: async () => "existing=true\n",
      writeFile: async () => undefined,
      mkdir: async () => undefined,
    });

    expect(result.codex.status).toBe("partial");
    expect(result.claude.status).toBe("partial");
    expect(result.gemini.status).toBe("partial");
    expect(result.codex.detail).toContain("unverified");
  });

  it("keeps already-present Pawtrol-managed wiring marked as unverified", async () => {
    const existing = [
      "existing=true",
      "# >>> Pawtrol artifact hook >>>",
      "artifact_dir=~/.pawtrol/agents/codex",
      "# <<< Pawtrol artifact hook <<<",
    ].join("\n");

    const result = await provisionAgentArtifacts({
      homeDir: "/Users/tester",
      env: {},
      readFile: async () => existing,
      writeFile: async () => undefined,
      mkdir: async () => undefined,
    });

    expect(result.codex.status).toBe("partial");
    expect(result.codex.detail).toContain("unverified");
  });

  it("replaces duplicate Pawtrol-managed blocks with a single block", async () => {
    const existing = [
      "existing=true",
      "# >>> Pawtrol artifact hook >>>",
      "artifact_dir=~/.pawtrol/agents/codex",
      "# <<< Pawtrol artifact hook <<<",
      "",
      "# >>> Pawtrol artifact hook >>>",
      "artifact_dir=~/.pawtrol/agents/codex",
      "# <<< Pawtrol artifact hook <<<",
    ].join("\n");
    const writes = new Map<string, string>();

    const result = await provisionAgentArtifacts({
      homeDir: "/Users/tester",
      env: {},
      readFile: async (filePath) => (filePath.endsWith("/.codex/pawtrol-artifacts.conf") ? existing : ""),
      writeFile: async (filePath, content) => {
        writes.set(filePath, content);
      },
      mkdir: async () => undefined,
    });

    expect(result.codex.status).toBe("partial");
    const codexConfig = writes.get("/Users/tester/.codex/pawtrol-artifacts.conf");
    expect(codexConfig?.match(/# >>> Pawtrol artifact hook >>>/g)).toHaveLength(1);
    expect(codexConfig?.match(/# <<< Pawtrol artifact hook <<</g)).toHaveLength(1);
  });
});
