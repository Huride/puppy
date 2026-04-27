import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getPackageVersion(): string {
  const packageJson = readPackageJson();
  const version = parsePackageVersion(packageJson);
  if (!version) {
    throw new Error("Unable to read Pawtrol package version");
  }

  return version;
}

export function parsePackageVersion(packageJson: string): string | undefined {
  const parsed = JSON.parse(packageJson) as { version?: unknown };
  return typeof parsed.version === "string" ? parsed.version : undefined;
}

function readPackageJson(): string {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(dirname, "../../package.json"), path.resolve(dirname, "../package.json")];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      // Try the next runtime layout: source tree vs compiled dist tree.
    }
  }

  throw new Error("Unable to find package.json");
}
