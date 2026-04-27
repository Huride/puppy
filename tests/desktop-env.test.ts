import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveDesktopEnvPath } from "../src/desktop/env-path.js";

describe("desktop env path", () => {
  it("uses PAWTROL_ENV_PATH when the CLI launched the desktop companion", () => {
    expect(resolveDesktopEnvPath("/Users/test/Library/Application Support/Pawtrol", { PAWTROL_ENV_PATH: "/repo/.env.local" })).toBe(
      "/repo/.env.local",
    );
  });

  it("falls back to the Electron user data env file", () => {
    expect(resolveDesktopEnvPath("/Users/test/Library/Application Support/Pawtrol", {})).toBe(
      path.join("/Users/test/Library/Application Support/Pawtrol", ".env.local"),
    );
  });
});
