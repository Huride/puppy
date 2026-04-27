import path from "node:path";

export function resolveDesktopEnvPath(userDataPath: string, env: Record<string, string | undefined> = process.env): string {
  return env.PAWTROL_ENV_PATH?.trim() || path.join(userDataPath, ".env.local");
}
