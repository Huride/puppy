import { describe, expect, it, vi } from "vitest";
import {
  createResourceSampler,
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
    expect(parseMacCpuPercent("CPU usage: 10.82% user, 15.7% sys, 74.9% idle")).toBeCloseTo(26.5, 1);
  });

  it("parses macOS CPU breakdown details", () => {
    expect(parseMacCpuSnapshot("CPU usage: 10.82% user, 15.7% sys, 74.9% idle")).toEqual({
      cpuPercent: 26.5,
      userPercent: 10.8,
      systemPercent: 15.7,
      idlePercent: 74.9,
      samples: [26.5],
    });
  });

  it("parses CPU samples into a bounded sparkline history", () => {
    const samples = Array.from({ length: 24 }, (_, index) => index + 1);

    expect(parseMacCpuSnapshot("CPU usage: 28.9% user, 5.8% sys, 65.3% idle\n", samples)).toEqual({
      cpuPercent: 34.7,
      userPercent: 28.9,
      systemPercent: 5.8,
      idlePercent: 65.3,
      samples: [...samples.slice(1), 34.7],
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
      usedPercent: 77.8,
      usedGb: 384.8,
      totalGb: 494.4,
    });
  });

  it("parses macOS battery status from pmset output", () => {
    const pmset = [
      "Now drawing from 'Battery Power'",
      " -InternalBattery-0\t98%; discharging; 5:10 remaining present: true",
      "Health Information:",
      "Cycle Count: 45",
      "Maximum Capacity: 91%",
      "Temperature: 30.6 C",
    ].join("\n");

    expect(parseMacBatterySnapshot(pmset)).toEqual({
      percent: 98,
      powerSource: "배터리",
      isCharging: false,
      cycleCount: 45,
      maxCapacityPercent: 91,
      temperatureCelsius: 30.6,
    });
  });

  it("reads the live battery percent from the status line even when health percent appears earlier", () => {
    const pmset = [
      "Now drawing from 'Battery Power'",
      "Health Information:",
      "Maximum Capacity: 91%",
      "Cycle Count: 45",
      " -InternalBattery-0\t96%; discharging; 4:10 remaining present: true",
      "Temperature: 30.6 C",
    ].join("\n");

    expect(parseMacBatterySnapshot(pmset)).toEqual({
      percent: 96,
      powerSource: "배터리",
      isCharging: false,
      cycleCount: 45,
      maxCapacityPercent: 91,
      temperatureCelsius: 30.6,
    });
  });

  it("accumulates CPU samples per sampler instance and resets deterministically", () => {
    const topOutputs = [
      "CPU usage: 11.2% user, 3.3% sys, 85.5% idle",
      "CPU usage: 20.1% user, 4.4% sys, 75.5% idle",
      "CPU usage: 7.5% user, 2.5% sys, 90.0% idle",
    ];
    const vmStatOutput = [
      "Mach Virtual Memory Statistics: (page size of 16384 bytes)",
      "Anonymous pages:                         246643.",
      "Pages wired down:                        180366.",
      "Pages occupied by compressor:            409552.",
    ].join("\n");
    const dfOutput = [
      "Filesystem   1024-blocks      Used Available Capacity iused ifree %iused  Mounted on",
      "/dev/disk3s5   494385888 384800000  109585888    78% 123456 654321   16%   /",
    ].join("\n");
    const pmsetOutput = [
      "Now drawing from 'Battery Power'",
      " -InternalBattery-0\t98%; discharging; 5:10 remaining present: true",
    ].join("\n");
    let topIndex = 0;
    const execStub = vi.fn((command: string) => {
      if (command === "top") {
        return topOutputs[topIndex++] ?? topOutputs.at(-1) ?? "";
      }
      if (command === "vm_stat") {
        return vmStatOutput;
      }
      if (command === "df") {
        return dfOutput;
      }
      if (command === "pmset") {
        return pmsetOutput;
      }
      throw new Error(`unexpected command: ${command}`);
    });

    const samplerA = createResourceSampler({
      platform: "darwin",
      totalmem: () => 17_179_869_184,
      execFileSync: execStub,
    });
    const samplerB = createResourceSampler({
      platform: "darwin",
      totalmem: () => 17_179_869_184,
      execFileSync: execStub,
    });

    expect(samplerA.sampleResources().cpuDetail?.samples).toEqual([14.5]);
    expect(samplerA.sampleResources().cpuDetail?.samples).toEqual([14.5, 24.5]);
    expect(samplerB.sampleResources().cpuDetail?.samples).toEqual([10]);

    samplerA.reset();

    expect(samplerA.sampleResources().cpuDetail?.samples).toEqual([10]);
  });

  it("preserves prior CPU history when a sample temporarily has no cpuDetail", () => {
    const topOutputs = [
      "CPU usage: 11.2% user, 3.3% sys, 85.5% idle",
      "top output without cpu usage line",
      "CPU usage: 20.1% user, 4.4% sys, 75.5% idle",
    ];
    const vmStatOutput = [
      "Mach Virtual Memory Statistics: (page size of 16384 bytes)",
      "Anonymous pages:                         246643.",
      "Pages wired down:                        180366.",
      "Pages occupied by compressor:            409552.",
    ].join("\n");
    const dfOutput = [
      "Filesystem   1024-blocks      Used Available Capacity iused ifree %iused  Mounted on",
      "/dev/disk3s5   494385888 384800000  109585888    78% 123456 654321   16%   /",
    ].join("\n");
    const pmsetOutput = [
      "Now drawing from 'Battery Power'",
      " -InternalBattery-0\t98%; discharging; 5:10 remaining present: true",
    ].join("\n");
    let topIndex = 0;
    const execStub = vi.fn((command: string) => {
      if (command === "top") {
        return topOutputs[topIndex++] ?? topOutputs.at(-1) ?? "";
      }
      if (command === "vm_stat") {
        return vmStatOutput;
      }
      if (command === "df") {
        return dfOutput;
      }
      if (command === "pmset") {
        return pmsetOutput;
      }
      throw new Error(`unexpected command: ${command}`);
    });
    const sampler = createResourceSampler({
      platform: "darwin",
      totalmem: () => 17_179_869_184,
      execFileSync: execStub,
    });

    expect(sampler.sampleResources().cpuDetail?.samples).toEqual([14.5]);
    expect(sampler.sampleResources().cpuDetail).toBeUndefined();
    expect(sampler.sampleResources().cpuDetail?.samples).toEqual([14.5, 24.5]);
  });
});
