import { describe, expect, it } from "vitest";
import path from "node:path";
import { buildDesktopCompanionEnv, launchDesktopCompanion } from "../src/cli-desktop.js";

describe("desktop companion launcher", () => {
  it("builds a desktop companion environment using the working directory env file", () => {
    expect(
      buildDesktopCompanionEnv({
        cwd: "/work/project",
        env: { PATH: "/bin" },
        forceSetup: true,
      }),
    ).toMatchObject({
      PATH: "/bin",
      PAWTROL_DESKTOP_COMPANION: "1",
      PAWTROL_DEMO: "0",
      PAWTROL_FORCE_SETUP: "1",
      PAWTROL_ENV_PATH: path.join("/work/project", ".env.local"),
    });
  });

  it("keeps an explicit Pawtrol env path when launching from the CLI", () => {
    expect(
      buildDesktopCompanionEnv({
        cwd: "/work/project",
        env: { PAWTROL_ENV_PATH: "/custom/.env.local" },
      }).PAWTROL_ENV_PATH,
    ).toBe("/custom/.env.local");
  });

  it("spawns Electron with the compiled desktop main entry", async () => {
    const calls: Array<{ command: string; args: string[]; options: { detached?: boolean; stdio?: string; env?: NodeJS.ProcessEnv } }> = [];
    let unrefCalled = false;

    const launched = await launchDesktopCompanion({
      cwd: "/work/project",
      env: { PATH: "/bin" },
      electronPath: "/node_modules/.bin/electron",
      mainPath: "/pkg/dist/src/desktop/main.js",
      spawn: (command, args, options) => {
        calls.push({ command, args, options });
        return {
          unref: () => {
            unrefCalled = true;
          },
        };
      },
    });

    expect(launched).toBe(true);
    expect(unrefCalled).toBe(true);
    expect(calls).toEqual([
      {
        command: "/node_modules/.bin/electron",
        args: ["/pkg/dist/src/desktop/main.js"],
        options: expect.objectContaining({
          detached: true,
          stdio: "ignore",
          env: expect.objectContaining({
            PAWTROL_DESKTOP_COMPANION: "1",
            PAWTROL_ENV_PATH: path.join("/work/project", ".env.local"),
          }),
        }),
      },
    ]);
  });

  it("returns false when Electron cannot be resolved", async () => {
    await expect(
      launchDesktopCompanion({
        electronPath: false,
        spawn: () => {
          throw new Error("should not spawn");
        },
      }),
    ).resolves.toBe(false);
  });
});
