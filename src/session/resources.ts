import os from "node:os";
import { execFileSync } from "node:child_process";
import type { ResourceUsage } from "./types.js";

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

export function parseMacCpuPercent(topOutput: string): number | null {
  const match = topOutput.match(/CPU usage:\s*([\d.]+)%\s*user,\s*([\d.]+)%\s*sys/i);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return clampPercent(Number(match[1]) + Number(match[2]));
}

export function parseMacMemoryPercent(vmStatOutput: string, totalBytes: number): number | null {
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

  // Activity Monitor's "Memory Used" is closest to app/anonymous memory + wired + compressed memory.
  // File-backed inactive pages are intentionally excluded because macOS can reclaim them as cache.
  const usedBytes = (anonymous + wired + compressor) * pageSize;
  return clampPercent((usedBytes / totalBytes) * 100);
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

    return {
      cpuPercent: parseMacCpuPercent(topOutput) ?? fallback.cpuPercent,
      memoryPercent: parseMacMemoryPercent(vmStatOutput, os.totalmem()) ?? fallback.memoryPercent,
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

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
