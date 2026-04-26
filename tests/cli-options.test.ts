import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli-options.js";

describe("parseCliArgs", () => {
  it("parses provider, model, share-plan, and watched command", () => {
    expect(
      parseCliArgs(["watch", "--provider", "openai", "--model", "gpt-5.2", "--share-plan", "--", "codex", "run", "fix tests"]),
    ).toEqual({
      mode: "watch",
      provider: "openai",
      model: "gpt-5.2",
      sharePlan: true,
      command: ["codex", "run", "fix tests"],
    });
  });

  it("defaults to auto provider for watch", () => {
    expect(parseCliArgs(["watch", "--", "node", "agent.js"])).toEqual({
      mode: "watch",
      provider: "auto",
      model: undefined,
      sharePlan: false,
      command: ["node", "agent.js"],
    });
  });

  it("parses doctor mode", () => {
    expect(parseCliArgs(["doctor"])).toEqual({
      mode: "doctor",
    });
  });
});
