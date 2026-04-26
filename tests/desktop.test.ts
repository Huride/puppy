import { describe, expect, it } from "vitest";
import path from "node:path";
import { buildDemoCommand, buildDemoRuntime, extractOverlayUrl } from "../src/desktop/demo-runner.js";
import { checkForUpdatesWhenPackaged, shouldCheckForUpdates } from "../src/desktop/updater.js";
import { calculateBottomRightBounds } from "../src/desktop/window-position.js";

describe("desktop demo runner helpers", () => {
  it("extracts the overlay URL from Puppy CLI stderr", () => {
    const output = "Puppy overlay: http://localhost:8787\n[codex] reading files\n";

    expect(extractOverlayUrl(output)).toBe("http://localhost:8787");
  });

  it("returns null when no overlay URL is present", () => {
    expect(extractOverlayUrl("[codex] running tests")).toBeNull();
  });

  it("builds a deterministic demo command for the local CLI", () => {
    expect(buildDemoCommand()).toEqual(["dist/src/cli.js", "watch", "--", "node", "scripts/demo-agent.mjs"]);
  });

  it("uses the system node runtime during development", () => {
    expect(
      buildDemoRuntime({
        isPackaged: false,
        projectRoot: "/repo",
        resourcesPath: "/repo/resources",
        execPath: "/Applications/Puppy.app/Contents/MacOS/Puppy",
      }),
    ).toEqual({
      command: "node",
      cwd: "/repo",
      env: {},
    });
  });

  it("uses Electron as Node from the unpacked app resources in packaged builds", () => {
    expect(
      buildDemoRuntime({
        isPackaged: true,
        projectRoot: "/repo",
        resourcesPath: "/Applications/Puppy.app/Contents/Resources",
        execPath: "/Applications/Puppy.app/Contents/MacOS/Puppy",
      }),
    ).toEqual({
      command: "/Applications/Puppy.app/Contents/MacOS/Puppy",
      cwd: path.join("/Applications/Puppy.app/Contents/Resources", "app.asar.unpacked"),
      env: {
        ELECTRON_RUN_AS_NODE: "1",
      },
    });
  });
});

describe("desktop update helpers", () => {
  it("checks for updates only when the Electron app is packaged", () => {
    expect(shouldCheckForUpdates(false)).toBe(false);
    expect(shouldCheckForUpdates(true)).toBe(true);
    expect(shouldCheckForUpdates(true, false)).toBe(false);
  });

  it("skips update checks in development mode", async () => {
    let called = false;

    const didCheck = await checkForUpdatesWhenPackaged(false, async () => {
      called = true;
    });

    expect(called).toBe(false);
    expect(didCheck).toBe(false);
  });

  it("runs update checks for packaged builds", async () => {
    let called = false;

    const didCheck = await checkForUpdatesWhenPackaged(true, async () => {
      called = true;
    });

    expect(called).toBe(true);
    expect(didCheck).toBe(true);
  });

  it("skips update checks for local packaged folders without release metadata", async () => {
    let called = false;

    const didCheck = await checkForUpdatesWhenPackaged(
      true,
      async () => {
        called = true;
      },
      console.warn,
      false,
    );

    expect(called).toBe(false);
    expect(didCheck).toBe(false);
  });
});

describe("desktop window positioning", () => {
  it("places the companion near the bottom-right work area edge", () => {
    expect(
      calculateBottomRightBounds({
        width: 1440,
        height: 900,
        windowWidth: 360,
        windowHeight: 300,
        margin: 18,
      }),
    ).toEqual({
      x: 1062,
      y: 582,
      width: 360,
      height: 300,
    });
  });
});
