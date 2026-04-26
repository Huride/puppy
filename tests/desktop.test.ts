import { describe, expect, it } from "vitest";
import path from "node:path";
import { buildAuthSummaryText, buildProviderSummary, shouldShowFirstRunAuth } from "../src/desktop/auth-state.js";
import { buildDemoCommand, buildDemoRuntime, extractOverlayUrl } from "../src/desktop/demo-runner.js";
import { buildDesktopMenuState, buildTrayTitle } from "../src/desktop/menu.js";
import { checkForUpdatesWhenPackaged, shouldCheckForUpdates } from "../src/desktop/updater.js";
import { calculateBottomRightBounds } from "../src/desktop/window-position.js";

describe("desktop demo runner helpers", () => {
  it("extracts the overlay URL from Pawtrol CLI stderr", () => {
    const output = "Pawtrol overlay: http://localhost:8787\n[codex] reading files\n";

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
        execPath: "/Applications/Pawtrol.app/Contents/MacOS/Pawtrol",
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
        resourcesPath: "/Applications/Pawtrol.app/Contents/Resources",
        execPath: "/Applications/Pawtrol.app/Contents/MacOS/Pawtrol",
      }),
    ).toEqual({
      command: "/Applications/Pawtrol.app/Contents/MacOS/Pawtrol",
      cwd: path.join("/Applications/Pawtrol.app/Contents/Resources", "app.asar.unpacked"),
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
        windowWidth: 560,
        windowHeight: 820,
        margin: 18,
      }),
    ).toEqual({
      x: 862,
      y: 62,
      width: 560,
      height: 820,
    });
  });
});

describe("desktop menu state", () => {
  it("exposes app status, update, template, visibility, and quit actions", () => {
    expect(buildDesktopMenuState("gemini")).toEqual({
      statusLabel: "LLM: gemini",
      templates: ["Bori", "Nabi", "Mochi"],
      actions: ["show-status", "enter-kennel", "exit-kennel", "auth-settings", "check-updates", "quit"],
    });
  });

  it("builds a visible macOS menu bar title", () => {
    expect(buildTrayTitle({ projectName: "Pawtrol", provider: "gemini", template: "Bori" })).toBe("🐶 Pawtrol");
  });
});

describe("desktop auth state", () => {
  const baseSummary = {
    geminiConfigured: true,
    codex: { installed: true, authenticated: true, detail: "Logged in using ChatGPT" },
    antigravity: {
      installedCommand: null,
      apiKeyConfigured: true,
      authenticated: true,
      detail: "GEMINI_API_KEY를 확인했어요.",
    },
    provider: "gemini",
    recommendedModel: "gemini-3-flash-preview",
    envPath: "/Users/test/Library/Application Support/Pawtrol/.env.local",
  };

  it("summarizes auth state for status dialogs", () => {
    const text = buildAuthSummaryText(baseSummary);

    expect(text).toContain("Gemini API: configured");
    expect(text).toContain("Codex auth: authenticated");
    expect(text).toContain("Antigravity/Gemini auth: ready");
    expect(text).toContain("Model: gemini-3-flash-preview");
  });

  it("shows first-run auth when Gemini or Codex is missing", () => {
    expect(shouldShowFirstRunAuth(baseSummary)).toBe(false);
    expect(shouldShowFirstRunAuth({ ...baseSummary, geminiConfigured: false })).toBe(true);
    expect(shouldShowFirstRunAuth({ ...baseSummary, codex: { installed: true, authenticated: false, detail: "missing" } })).toBe(
      true,
    );
  });

  it("builds provider and model labels from environment", () => {
    expect(buildProviderSummary({ GEMINI_API_KEY: "key" })).toEqual({
      provider: "gemini",
      recommendedModel: "gemini-3-flash-preview",
    });
    expect(buildProviderSummary({})).toEqual({
      provider: "heuristic",
      recommendedModel: "local-heuristic",
    });
  });
});
