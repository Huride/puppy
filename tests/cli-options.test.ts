import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli-options.js";

describe("parseCliArgs", () => {
  it("parses no arguments as companion mode", () => {
    expect(parseCliArgs([])).toEqual({
      mode: "companion",
    });
  });

  it("parses setup as companion setup mode", () => {
    expect(parseCliArgs(["setup"])).toEqual({
      mode: "setup",
    });
  });

  it("parses provider, model, share-plan, and watched command", () => {
    expect(
      parseCliArgs(["watch", "--provider", "openai", "--model", "gpt-5.4-mini", "--share-plan", "--", "codex", "run", "fix tests"]),
    ).toEqual({
      mode: "watch",
      provider: "openai",
      model: "gpt-5.4-mini",
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

  it("parses Gemini auth with a key", () => {
    expect(parseCliArgs(["auth", "gemini", "--key", "test-key"])).toEqual({
      mode: "auth",
      target: "gemini",
      apiKey: "test-key",
      statusOnly: false,
    });
  });

  it("parses the unified OpenAI login command", () => {
    expect(parseCliArgs(["login", "openai", "--key", "test-key"])).toEqual({
      mode: "auth",
      target: "openai",
      apiKey: "test-key",
      statusOnly: false,
    });
  });

  it("parses Codex auth status checks", () => {
    expect(parseCliArgs(["auth", "codex", "--status"])).toEqual({
      mode: "auth",
      target: "codex",
      apiKey: undefined,
      statusOnly: true,
    });
  });

  it("parses Antigravity auth with the Gemini-compatible key path", () => {
    expect(parseCliArgs(["auth", "antigravity", "--key", "test-key"])).toEqual({
      mode: "auth",
      target: "antigravity",
      apiKey: "test-key",
      statusOnly: false,
    });
  });
});
