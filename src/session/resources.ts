import os from "node:os";
import { execFileSync } from "node:child_process";
import type { ResourceUsage } from "./types.js";

const MAX_CPU_SAMPLE_HISTORY = 24;
let cpuSampleHistory: number[] = [];

export function sampleResources(): ResourceUsage {
  if (process.platform === "darwin") {
    return sampleMacResources();
  }

  return samplePortableResources();
}

export function samplePortableResources(): ResourceUsage {
  const total = os.totalmem();
  const free = os.freemem();
  const memoryPercent = Math.round(((total - free) / total) * 100);
  const load = os.loadavg()[0] ?? 0;
  const cpuPercent = Math.max(0, Math.min(100, Math.round((load / os.cpus().length) * 100)));

  return { cpuPercent, memoryPercent };
}

export function parseMacCpuSnapshot(
  topOutput: string,
  samples?: number[],
): (NonNullable<ResourceUsage["cpuDetail"]> & { cpuPercent: number }) | null {
  const match = topOutput.match(/CPU usage:\s*([\d.]+)%\s*user,\s*([\d.]+)%\s*sys,\s*([\d.]+)%\s*idle/i);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const userPercent = Number(match[1]);
  const systemPercent = Number(match[2]);
  const idlePercent = Number(match[3]);
  const cpuPercent = clampCpuPercent(userPercent + systemPercent);
  return {
    cpuPercent,
    userPercent: roundMetric(userPercent),
    systemPercent: roundMetric(systemPercent),
    idlePercent: roundMetric(idlePercent),
    samples: pushCpuSample(samples, cpuPercent),
  };
}

export function parseMacCpuPercent(topOutput: string): number | null {
  return parseMacCpuSnapshot(topOutput)?.cpuPercent ?? null;
}

export function parseMacMemorySnapshot(
  vmStatOutput: string,
  totalBytes: number,
): ResourceUsage["memoryDetail"] & { memoryPercent: number } | null {
  const pageSize = Number(vmStatOutput.match(/page size of (\d+) bytes/i)?.[1]);
  if (!pageSize || !Number.isFinite(pageSize) || totalBytes <= 0) {
    return null;
  }

  const anonymous = readVmStatPages(vmStatOutput, "Anonymous pages");
  const wired = readVmStatPages(vmStatOutput, "Pages wired down");
  const compressor = readVmStatPages(vmStatOutput, "Pages occupied by compressor");

  if (anonymous === null || wired === null || compressor === null) {
    return null;
  }

  const anonymousBytes = anonymous * pageSize;
  const wiredBytes = wired * pageSize;
  const compressedBytes = compressor * pageSize;
  const usedBytes = anonymousBytes + wiredBytes + compressedBytes;
  return {
    memoryPercent: clampPercent((usedBytes / totalBytes) * 100),
    appUsedGb: bytesToDisplayGb(anonymousBytes),
    wiredGb: bytesToDisplayGb(wiredBytes),
    compressedGb: bytesToDisplayGb(compressedBytes),
  };
}

export function parseMacMemoryPercent(vmStatOutput: string, totalBytes: number): number | null {
  return parseMacMemorySnapshot(vmStatOutput, totalBytes)?.memoryPercent ?? null;
}

export function parseMacStorageSnapshot(dfOutput: string): ResourceUsage["storageDetail"] | null {
  const lines = dfOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const dataLine = lines[1];
  if (!dataLine) {
    return null;
  }

  const match = dataLine.match(/^\S+\s+(\d+)\s+(\d+)\s+\d+\s+(\d+)%/);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const totalKb = Number(match[1]);
  const usedKb = Number(match[2]);
  const usedPercent = roundMetric((usedKb / totalKb) * 100);
  return {
    usedPercent: Math.max(0, Math.min(100, usedPercent)),
    usedGb: kilobytesToDisplayGb(usedKb),
    totalGb: kilobytesToDisplayGb(totalKb),
  };
}

export function parseMacBatterySnapshot(pmsetOutput: string): ResourceUsage["batteryDetail"] | null {
  const sourceMatch = pmsetOutput.match(/Now drawing from '([^']+)'/i);
  const percentMatch = pmsetOutput.match(/(\d+)%/);
  if (!sourceMatch?.[1] || !percentMatch?.[1]) {
    return null;
  }

  const rawSource = sourceMatch[1].toLowerCase();
  const powerSource =
    rawSource.includes("battery") ? "배터리" : rawSource.includes("ac") ? "전원 어댑터" : sourceMatch[1];
  const isCharging = /\bcharging\b/i.test(pmsetOutput)
    ? true
    : /\bdischarging\b|battery power/i.test(pmsetOutput)
      ? false
      : null;
  const cycleCount = readOptionalNumber(pmsetOutput, /Cycle Count:\s*(\d+)/i);
  const maxCapacityPercent = readOptionalNumber(pmsetOutput, /Maximum Capacity:\s*([\d.]+)%/i);
  const temperatureCelsius = readOptionalNumber(pmsetOutput, /Temperature:\s*([\d.]+)\s*C/i);

  return {
    percent: clampPercent(Number(percentMatch[1])),
    powerSource,
    isCharging,
    cycleCount,
    maxCapacityPercent,
    temperatureCelsius,
  };
}

function sampleMacResources(): ResourceUsage {
  const fallback = samplePortableResources();

  try {
    const topOutput = execFileSync("top", ["-l", "1", "-n", "0", "-s", "0"], {
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const vmStatOutput = execFileSync("vm_stat", {
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const dfOutput = execFileSync("df", ["-k", "/System/Volumes/Data"], {
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const pmsetOutput = execFileSync("pmset", ["-g", "batt"], {
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const cpuSnapshot = parseMacCpuSnapshot(topOutput, cpuSampleHistory);
    const memorySnapshot = parseMacMemorySnapshot(vmStatOutput, os.totalmem());
    if (cpuSnapshot?.samples) {
      cpuSampleHistory = cpuSnapshot.samples;
    }

    return {
      cpuPercent: cpuSnapshot?.cpuPercent ?? fallback.cpuPercent,
      memoryPercent: memorySnapshot?.memoryPercent ?? fallback.memoryPercent,
      cpuDetail: cpuSnapshot
        ? {
            userPercent: cpuSnapshot.userPercent,
            systemPercent: cpuSnapshot.systemPercent,
            idlePercent: cpuSnapshot.idlePercent,
            samples: cpuSnapshot.samples,
          }
        : undefined,
      memoryDetail: memorySnapshot
        ? {
            appUsedGb: memorySnapshot.appUsedGb,
            wiredGb: memorySnapshot.wiredGb,
            compressedGb: memorySnapshot.compressedGb,
          }
        : undefined,
      storageDetail: parseMacStorageSnapshot(dfOutput) ?? undefined,
      batteryDetail: parseMacBatterySnapshot(pmsetOutput) ?? undefined,
    };
  } catch {
    return fallback;
  }
}

function readVmStatPages(output: string, label: string): number | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`${escapedLabel}:\\s+(\\d+)\\.`, "i"));
  return match?.[1] ? Number(match[1]) : null;
}

function pushCpuSample(samples: number[] | undefined, cpuPercent: number): number[] {
  const history = [...(samples ?? []), roundMetric(cpuPercent)];
  return history.slice(-MAX_CPU_SAMPLE_HISTORY);
}

function readOptionalNumber(output: string, pattern: RegExp): number | null {
  const value = output.match(pattern)?.[1];
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundMetric(parsed) : null;
}

function clampCpuPercent(value: number): number {
  return roundMetric(Math.max(0, Math.min(100, value)));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function bytesToDisplayGb(value: number): number {
  return roundMetric(value / 1_000_000_000);
}

function kilobytesToDisplayGb(value: number): number {
  return roundMetric(value / 1_000_000);
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}
