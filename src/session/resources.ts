import os from "node:os";
import type { ResourceUsage } from "./types.js";

export function sampleResources(): ResourceUsage {
  // MVP overlay signal: approximate system-wide usage, not per-process CPU.
  const total = os.totalmem();
  const free = os.freemem();
  const memoryPercent = Math.round(((total - free) / total) * 100);
  const load = os.loadavg()[0] ?? 0;
  const cpuPercent = Math.max(0, Math.min(100, Math.round((load / os.cpus().length) * 100)));

  return { cpuPercent, memoryPercent };
}
