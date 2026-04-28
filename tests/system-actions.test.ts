import { describe, expect, it } from "vitest";
import {
  buildAvailableSystemActions,
  buildSystemActionCommand,
  resolveAllowedArtifactPath,
  type SystemActionId,
} from "../src/desktop/system-actions.js";

describe("system actions", () => {
  it("enables all macOS CTA actions when an artifact path is available", () => {
    expect(
      buildAvailableSystemActions({
        platform: "darwin",
        artifactPath: "/repo/.pawtrol/session-plan.md",
      }),
    ).toEqual<SystemActionId[]>([
      "activity-monitor",
      "storage-settings",
      "network-settings",
      "open-artifact-path",
    ]);
  });

  it("keeps artifact reveal unavailable when there is no grounded artifact path", () => {
    expect(
      buildAvailableSystemActions({
        platform: "darwin",
        artifactPath: null,
      }),
    ).toEqual<SystemActionId[]>([
      "activity-monitor",
      "storage-settings",
      "network-settings",
    ]);
  });

  it("routes storage CTA to macOS system settings", () => {
    expect(
      buildSystemActionCommand("storage-settings", {
        platform: "darwin",
      }),
    ).toEqual({
      type: "open-url",
      target: "x-apple.systempreferences:com.apple.settings.Storage",
    });
  });

  it("routes network CTA to macOS system settings", () => {
    expect(
      buildSystemActionCommand("network-settings", {
        platform: "darwin",
      }),
    ).toEqual({
      type: "open-url",
      target: "x-apple.systempreferences:com.apple.Network-Settings.extension",
    });
  });

  it("routes Activity Monitor CTA to the native utility app", () => {
    expect(
      buildSystemActionCommand("activity-monitor", {
        platform: "darwin",
      }),
    ).toEqual({
      type: "open-application",
      target: "Activity Monitor",
    });
  });

  it("routes artifact CTA to Finder reveal when a path is present", () => {
    expect(
      buildSystemActionCommand("open-artifact-path", {
        platform: "darwin",
        artifactPath: "/repo/.pawtrol/session-plan.md",
      }),
    ).toEqual({
      type: "reveal-path",
      target: "/repo/.pawtrol/session-plan.md",
    });
  });

  it("returns null for unavailable artifact routing or unsupported platforms", () => {
    expect(
      buildSystemActionCommand("open-artifact-path", {
        platform: "darwin",
        artifactPath: null,
      }),
    ).toBeNull();
    expect(
      buildSystemActionCommand("activity-monitor", {
        platform: "linux",
      }),
    ).toBeNull();
  });

  it("rejects renderer-supplied artifact paths outside the allowed passive roots", () => {
    expect(
      buildSystemActionCommand("open-artifact-path", {
        platform: "darwin",
        artifactPath: "/Users/test/Secrets/private.txt",
        allowedArtifactRoots: [
          "/Users/test/.pawtrol",
          "/Users/test/.codex",
        ],
      }),
    ).toBeNull();
  });

  it("normalizes and accepts artifact paths within an allowed passive root", () => {
    expect(
      resolveAllowedArtifactPath({
        platform: "darwin",
        artifactPath: "/Users/test/.pawtrol/../.pawtrol/session-plan.md",
        allowedArtifactRoots: ["/Users/test/.pawtrol"],
      }),
    ).toBe("/Users/test/.pawtrol/session-plan.md");
  });
});
