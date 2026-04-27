import { describe, expect, it, vi } from "vitest";
import { openOverlayUrl } from "../src/cli-open.js";

describe("openOverlayUrl", () => {
  it("uses the absolute macOS open command before PATH lookup", async () => {
    const execFile = vi.fn().mockResolvedValue(undefined);

    const opened = await openOverlayUrl("http://localhost:8787", {
      platform: "darwin",
      execFile,
    });

    expect(opened).toBe(true);
    expect(execFile).toHaveBeenCalledWith("/usr/bin/open", ["http://localhost:8787"], { timeout: 4_000 });
  });

  it("falls back to PATH open on macOS when /usr/bin/open fails", async () => {
    const execFile = vi.fn().mockRejectedValueOnce(new Error("missing")).mockResolvedValueOnce(undefined);

    const opened = await openOverlayUrl("http://localhost:8787", {
      platform: "darwin",
      execFile,
    });

    expect(opened).toBe(true);
    expect(execFile).toHaveBeenLastCalledWith("open", ["http://localhost:8787"], { timeout: 4_000 });
  });
});
