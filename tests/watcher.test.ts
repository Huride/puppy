import { describe, expect, it } from "vitest";
import { watchCommand } from "../src/session/watcher.js";

describe("watchCommand", () => {
  it("streams stdout lines from a child process", async () => {
    const lines: string[] = [];
    const exitCode = await watchCommand(["node", "-e", "console.log('hello puppy')"], {
      onEvent: (event) => lines.push(event.line),
    });

    expect(exitCode).toBe(0);
    expect(lines).toContain("hello puppy");
  });
});
