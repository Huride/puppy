import { describe, expect, it, vi } from "vitest";
import {
  parseMacBatterySnapshot,
  parseMacCpuPercent,
  parseMacCpuSnapshot,
  parseMacMemoryPercent,
  parseMacMemorySnapshot,
  parseMacStorageSnapshot,
  sampleResources,
} from "../src/session/resources.js";
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

  it("streams stderr lines from a child process", async () => {
    const lines: string[] = [];
    const exitCode = await watchCommand(["node", "-e", "console.error('warn puppy')"], {
      onEvent: (event) => {
        if (event.stream === "stderr") {
          lines.push(event.line);
        }
      },
    });

    expect(exitCode).toBe(0);
    expect(lines).toContain("warn puppy");
  });

  it("does not print terminal output directly", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await watchCommand(["node", "-e", "console.log('quiet puppy')"], {
        onEvent: () => undefined,
      });
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("propagates non-zero exit codes", async () => {
    const exitCode = await watchCommand(["node", "-e", "process.exit(7)"], {
      onEvent: () => undefined,
    });

    expect(exitCode).toBe(7);
  });

  it("rejects an empty command", async () => {
    await expect(
      watchCommand([], {
        onEvent: () => undefined,
      }),
    ).rejects.toThrow("No command provided after --");
  });
});

describe("sampleResources", () => {
  it("returns approximate system resource percentages", () => {
    const usage = sampleResources();

    expect(usage.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(usage.cpuPercent).toBeLessThanOrEqual(100);
    expect(usage.memoryPercent).toBeGreaterThanOrEqual(0);
    expect(usage.memoryPercent).toBeLessThanOrEqual(100);
  });

  it("parses macOS Activity Monitor style CPU usage from top output", () => {
    expect(parseMacCpuPercent("CPU usage: 10.82% user, 15.7% sys, 74.9% idle")).toBe(27);
  });

  it("parses macOS CPU breakdown details", () => {
    expect(parseMacCpuSnapshot("CPU usage: 10.82% user, 15.7% sys, 74.9% idle")).toEqual({
      cpuPercent: 27,
      userPercent: 10.8,
      systemPercent: 15.7,
      idlePercent: 74.9,
    });
  });

  it("parses macOS memory used from anonymous, wired, and compressed pages", () => {
    const vmStat = [
      "Mach Virtual Memory Statistics: (page size of 16384 bytes)",
      "Pages free:                                8192.",
      "Anonymous pages:                         246643.",
      "Pages wired down:                        180366.",
      "Pages occupied by compressor:            409552.",
      "File-backed pages:                       166490.",
    ].join("\n");

    expect(parseMacMemoryPercent(vmStat, 17_179_869_184)).toBe(80);
  });

  it("parses macOS memory breakdown details", () => {
    const vmStat = [
      "Mach Virtual Memory Statistics: (page size of 16384 bytes)",
      "Anonymous pages:                         246643.",
      "Pages wired down:                        180366.",
      "Pages occupied by compressor:            409552.",
    ].join("\n");

    expect(parseMacMemorySnapshot(vmStat, 17_179_869_184)).toEqual({
      memoryPercent: 80,
      appUsedGb: 4,
      wiredGb: 3,
      compressedGb: 6.7,
    });
  });

  it("parses macOS storage usage from df output", () => {
    const dfOutput = [
      "Filesystem   1024-blocks      Used Available Capacity iused ifree %iused  Mounted on",
      "/dev/disk3s5   494385888 384800000  109585888    78% 123456 654321   16%   /",
    ].join("\n");

    expect(parseMacStorageSnapshot(dfOutput)).toEqual({
      usedPercent: 78,
      usedGb: 394,
      totalGb: 506.3,
    });
  });

  it("parses macOS battery status from pmset output", () => {
    const pmset = [
      "Now drawing from 'Battery Power'",
      " -InternalBattery-0\t98%; discharging; 5:10 remaining present: true",
    ].join("\n");

    expect(parseMacBatterySnapshot(pmset)).toEqual({
      percent: 98,
      powerSource: "배터리",
      isCharging: false,
    });
  });
});
