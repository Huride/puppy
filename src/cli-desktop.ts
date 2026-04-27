import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SpawnLike = (
  command: string,
  args: string[],
  options: { cwd: string; detached: true; stdio: "ignore"; env: NodeJS.ProcessEnv },
) => { unref: () => void };

export type DesktopCompanionLaunchOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  forceSetup?: boolean;
  electronPath?: string | false;
  mainPath?: string;
  spawn?: SpawnLike;
};

export function buildDesktopCompanionEnv(options: {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  forceSetup?: boolean;
}): NodeJS.ProcessEnv {
  const env = options.env ?? process.env;
  return {
    ...env,
    PAWTROL_DESKTOP_COMPANION: "1",
    PAWTROL_DEMO: "0",
    PAWTROL_FORCE_SETUP: options.forceSetup ? "1" : "0",
    PAWTROL_ENV_PATH: env.PAWTROL_ENV_PATH ?? path.join(options.cwd, ".env.local"),
  };
}

export async function launchDesktopCompanion(options: DesktopCompanionLaunchOptions = {}): Promise<boolean> {
  const cwd = options.cwd ?? process.cwd();
  const electronPath = options.electronPath ?? resolveElectronPath();
  if (!electronPath) {
    return false;
  }

  try {
    const spawnDesktop = options.spawn ?? spawn;
    const child = spawnDesktop(electronPath, [options.mainPath ?? resolveDesktopMainPath()], {
      cwd,
      detached: true,
      stdio: "ignore",
      env: buildDesktopCompanionEnv({
        cwd,
        env: options.env,
        forceSetup: options.forceSetup,
      }),
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function resolveDesktopMainPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "desktop/main.js");
}

function resolveElectronPath(): string | false {
  try {
    const require = createRequire(import.meta.url);
    const electronPath = require("electron") as unknown;
    return typeof electronPath === "string" ? electronPath : false;
  } catch {
    return false;
  }
}
