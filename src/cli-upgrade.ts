import { execFile, spawnSync } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { formatProvisioningReport } from "./cli-onboarding.js";
import { provisionAgentArtifacts } from "./session/agent-artifact-install.js";
import type { AgentArtifactProvisionSummary } from "./session/agent-artifact-install.js";

const execFileAsync = promisify(execFile);

export type InstallResult = {
  status: number | null;
  error?: Error;
};

export type RunUpgradeOptions = {
  currentVersion: string;
  getLatestVersion?: () => Promise<string>;
  installLatest?: () => InstallResult;
  provisionArtifacts?: () => Promise<AgentArtifactProvisionSummary>;
  write?: (message: string) => void;
};

export async function runUpgrade(options: RunUpgradeOptions): Promise<number> {
  const write = options.write ?? ((message: string) => process.stderr.write(message));
  let latestVersion: string;
  try {
    latestVersion = (await (options.getLatestVersion ?? getLatestPawtrolVersion)()).trim();
  } catch (error) {
    write(`Unable to check the latest Pawtrol version: ${error instanceof Error ? error.message : String(error)}\n`);
    write("Try again later, or run: npm install -g pawtrol@latest\n");
    return 1;
  }

  write(`Pawtrol current: ${options.currentVersion}\n`);
  write(`Pawtrol latest: ${latestVersion}\n`);

  if (compareVersions(options.currentVersion, latestVersion) >= 0) {
    write(`Pawtrol is already up to date: ${options.currentVersion}\n`);
    return 0;
  }

  write("Updating Pawtrol with npm install -g pawtrol@latest...\n");
  const result = (options.installLatest ?? installLatestPawtrol)();
  if (result.error) {
    write(`Pawtrol upgrade failed: ${result.error.message}\n`);
    write("Try: sudo npm install -g pawtrol@latest\n");
    return 1;
  }

  if (result.status !== 0) {
    write("Pawtrol upgrade failed.\n");
    write("If this is a permission error, try: sudo npm install -g pawtrol@latest\n");
    return typeof result.status === "number" ? result.status : 1;
  }

  const provisioning = await (options.provisionArtifacts ?? provisionGlobalAgentArtifacts)();
  for (const line of formatProvisioningReport(provisioning)) {
    write(`${line}\n`);
  }
  write("Pawtrol upgrade complete. Close and reopen Pawtrol to use the new version.\n");
  return 0;
}

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export async function getLatestPawtrolVersion(): Promise<string> {
  const result = await execFileAsync("npm", ["view", "pawtrol", "version"], { timeout: 15_000 });
  return result.stdout.trim();
}

export function installLatestPawtrol(): InstallResult {
  const result = spawnSync("npm", ["install", "-g", "pawtrol@latest"], { stdio: "inherit" });
  return {
    status: result.status,
    error: result.error,
  };
}

async function provisionGlobalAgentArtifacts(): Promise<AgentArtifactProvisionSummary> {
  return provisionAgentArtifacts({
    homeDir: os.homedir(),
    env: process.env,
  });
}

function parseVersionParts(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}
