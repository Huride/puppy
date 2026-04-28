import path from "node:path";
import { resolveAgentArtifactHomes } from "./agent-artifact-home.js";

export const CURRENT_ARTIFACT_WINDOW_MS = 15 * 60 * 1000;
export const PASSIVE_ARTIFACT_PATHS_ENV = "PAWTROL_PASSIVE_ARTIFACT_PATHS";

export type PassiveArtifactSourceScope = "cwd" | "home_app" | "extra";

export type PassiveArtifactRoot = {
  path: string;
  scope: PassiveArtifactSourceScope;
};

export type PassiveArtifactConfig = {
  passiveArtifactPaths?: string[];
};

export function getDefaultPassiveArtifactRoots(homeDir: string, env?: Record<string, string | undefined>): PassiveArtifactRoot[] {
  const homes = resolveAgentArtifactHomes({ homeDir, env });

  return [
    { path: path.join(homeDir, ".pawtrol"), scope: "home_app" },
    { path: homes.codex.pawtrolRoot, scope: "home_app" },
    { path: homes.claude.pawtrolRoot, scope: "home_app" },
    { path: homes.gemini.pawtrolRoot, scope: "home_app" },
    { path: homes.codex.configRoot, scope: "home_app" },
    { path: homes.claude.configRoot, scope: "home_app" },
    { path: homes.gemini.configRoot, scope: "home_app" },
    { path: path.join(homeDir, "Library", "Application Support", "Pawtrol"), scope: "home_app" },
    { path: path.join(homeDir, "Library", "Application Support", "Codex"), scope: "home_app" },
    { path: path.join(homeDir, "Library", "Application Support", "Claude"), scope: "home_app" },
  ];
}

export function parsePassiveArtifactPathList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n,;:]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function getPassiveArtifactRoots(options: {
  cwd: string;
  homeDir: string;
  env?: Record<string, string | undefined>;
  config?: PassiveArtifactConfig;
  extraPaths?: string[];
}): PassiveArtifactRoot[] {
  const envPaths = parsePassiveArtifactPathList(options.env?.[PASSIVE_ARTIFACT_PATHS_ENV]);
  const configPaths = normalizePathList(options.config?.passiveArtifactPaths);
  const directPaths = normalizePathList(options.extraPaths);

  return dedupeRoots([
    { path: options.cwd, scope: "cwd" },
    ...getDefaultPassiveArtifactRoots(options.homeDir, options.env),
    ...envPaths.map<PassiveArtifactRoot>((entry) => ({ path: entry, scope: "extra" })),
    ...configPaths.map<PassiveArtifactRoot>((entry) => ({ path: entry, scope: "extra" })),
    ...directPaths.map<PassiveArtifactRoot>((entry) => ({ path: entry, scope: "extra" })),
  ]);
}

function normalizePathList(entries: string[] | undefined): string[] {
  if (!entries) {
    return [];
  }

  return entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function dedupeRoots(roots: PassiveArtifactRoot[]): PassiveArtifactRoot[] {
  const seen = new Set<string>();
  const deduped: PassiveArtifactRoot[] = [];

  for (const root of roots) {
    const key = path.resolve(root.path);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(root);
  }

  return deduped;
}
