import { describe, expect, it } from "vitest";
import { provisionAgentArtifacts } from "../src/session/agent-artifact-install.js";

describe("provisionAgentArtifacts", () => {
  it("creates Pawtrol-managed directories and injects a single marked block", async () => {
    const result = await provisionAgentArtifacts({
      homeDir: "/Users/tester",
      env: {},
      readFile: async () => "existing=true\n",
      writeFile: async () => undefined,
      mkdir: async () => undefined,
    });

    expect(result.codex.status).toBe("installed");
    expect(result.claude.status).toBe("installed");
    expect(result.gemini.status).toBe("installed");
  });

  it("does not duplicate the Pawtrol block on repeated runs", async () => {
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

    expect(result.codex.status).toBe("skipped");
  });
});
