import { describe, expect, it } from "vitest";
import { resolveAgentArtifactHomes } from "../src/session/agent-artifact-home.js";

describe("resolveAgentArtifactHomes", () => {
  it("returns codex and claude homes plus Pawtrol-managed directories", () => {
    const homes = resolveAgentArtifactHomes({
      homeDir: "/Users/tester",
      env: {},
    });

    expect(homes.codex.configRoot).toBe("/Users/tester/.codex");
    expect(homes.claude.configRoot).toBe("/Users/tester/.claude");
    expect(homes.codex.pawtrolRoot).toBe("/Users/tester/.pawtrol/agents/codex");
    expect(homes.claude.pawtrolRoot).toBe("/Users/tester/.pawtrol/agents/claude");
  });

  it("prefers an actual Gemini-compatible root before ~/.gemini fallback", () => {
    const homes = resolveAgentArtifactHomes({
      homeDir: "/Users/tester",
      env: {
        ANTIGRAVITY_HOME: "/Users/tester/.antigravity",
      },
    });

    expect(homes.gemini.configRoot).toBe("/Users/tester/.antigravity");
    expect(homes.gemini.pawtrolRoot).toBe("/Users/tester/.pawtrol/agents/gemini");
  });
});
