import { describe, expect, it } from "vitest";
import { parseRunningAgents } from "../src/session/agent-detect.js";

describe("parseRunningAgents", () => {
  it("detects running coding agents from ps output", () => {
    const agents = parseRunningAgents(`
      100 /usr/local/bin/node node /opt/homebrew/bin/codex exec fix tests
      101 /bin/zsh -zsh
      102 /usr/local/bin/claude claude "review this"
      103 /usr/local/bin/antigravity antigravity
    `);

    expect(agents.map((agent) => agent.kind)).toEqual(["codex", "claude", "antigravity"]);
  });

  it("ignores the Pawtrol process itself", () => {
    expect(
      parseRunningAgents(`
        200 node /opt/homebrew/bin/pawtrol
        201 node dist/src/cli.js
      `),
    ).toEqual([]);
  });
});
