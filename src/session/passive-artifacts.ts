import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  CURRENT_ARTIFACT_WINDOW_MS,
  getPassiveArtifactRoots,
  type PassiveArtifactConfig,
  type PassiveArtifactRoot,
  type PassiveArtifactSourceScope,
} from "./passive-artifact-config.js";

export type PassiveArtifactKindHint = "summary" | "log";
export type PassiveArtifactCategory = "markdown" | "json" | "log";

export type PassiveArtifactCandidate = {
  path: string;
  category: PassiveArtifactCategory;
  kindHint: PassiveArtifactKindHint;
  sourceScope: PassiveArtifactSourceScope;
  mtimeMs: number;
  updatedAt: string;
  ageMs: number;
  ageMinutes: number;
  isCurrent: boolean;
};

type PassiveArtifactRootContext = {
  path: string;
  scope: PassiveArtifactSourceScope;
  provider: "codex" | "claude" | "gemini" | "pawtrol" | null;
};

export type PassiveArtifactSelection = {
  summary: PassiveArtifactCandidate | null;
  log: PassiveArtifactCandidate | null;
  staleSummary: PassiveArtifactCandidate | null;
  staleLog: PassiveArtifactCandidate | null;
  currentWindowMs: number;
};

const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", "coverage"]);
const KNOWN_SUMMARY_NAMES = new Set([
  "session-plan",
  "session-summary",
  "session-snapshot",
  "passive-session",
  "pawtrol-session",
  "codex-session",
  "claude-session",
  "gemini-session",
]);
const KNOWN_SUMMARY_DIRECTORY_MARKERS = [".pawtrol", ".codex", ".claude", "Application Support/Pawtrol", "Application Support/Codex", "Application Support/Claude"];

export async function discoverPassiveArtifacts(options: {
  cwd: string;
  homeDir: string;
  env?: Record<string, string | undefined>;
  config?: PassiveArtifactConfig;
  extraPaths?: string[];
  now?: Date;
  statFn?: (path: string) => Promise<{ mtimeMs: number }>;
  walkFilesFn?: (path: string) => Promise<string[]>;
}): Promise<PassiveArtifactCandidate[]> {
  const roots = compactTraversalRoots(getPassiveArtifactRoots(options));
  const now = options.now ?? new Date();
  const statFn = options.statFn ?? defaultStatFn;
  const walkFilesFn = options.walkFilesFn ?? walkFiles;
  const artifacts: PassiveArtifactCandidate[] = [];
  const seenFiles = new Set<string>();

  for (const root of roots) {
    const files = await walkFilesFn(root.path);
    for (const filePath of files) {
      const normalizedFilePath = path.resolve(filePath);
      if (seenFiles.has(normalizedFilePath)) {
        continue;
      }

      const descriptor = classifyArtifactPath(filePath, root);
      if (!descriptor) {
        continue;
      }

      const fileStat = await readArtifactStat(filePath, statFn);
      if (!fileStat) {
        continue;
      }

      seenFiles.add(normalizedFilePath);
      const ageMs = Math.max(0, now.getTime() - fileStat.mtimeMs);
      artifacts.push({
        path: filePath,
        category: descriptor.category,
        kindHint: descriptor.kindHint,
        sourceScope: root.scope,
        mtimeMs: fileStat.mtimeMs,
        updatedAt: new Date(fileStat.mtimeMs).toISOString(),
        ageMs,
        ageMinutes: Math.floor(ageMs / 60000),
        isCurrent: ageMs <= CURRENT_ARTIFACT_WINDOW_MS,
      });
    }
  }

  return artifacts.sort(compareDiscoveryOrder);
}

export function selectPassiveArtifacts(options: {
  candidates: PassiveArtifactCandidate[];
  now?: Date;
  currentWindowMs?: number;
}): PassiveArtifactSelection {
  const now = options.now ?? new Date();
  const currentWindowMs = options.currentWindowMs ?? CURRENT_ARTIFACT_WINDOW_MS;
  const normalized = options.candidates.map((candidate) => normalizeCandidate(candidate, now, currentWindowMs));
  const summaries = normalized.filter((candidate) => candidate.kindHint === "summary");
  const logs = normalized.filter((candidate) => candidate.kindHint === "log");

  return {
    summary: pickBestCurrent(summaries),
    log: pickBestCurrent(logs),
    staleSummary: pickBestStale(summaries),
    staleLog: pickBestStale(logs),
    currentWindowMs,
  };
}

async function walkFiles(rootPath: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    if (shouldSkipFsError(error)) {
      return [];
    }
    throw error;
  }

  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      files.push(...(await walkFiles(entryPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function classifyArtifactPath(
  filePath: string,
  root: PassiveArtifactRootContext,
): Pick<PassiveArtifactCandidate, "category" | "kindHint"> | null {
  const extension = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();
  const artifactName = stripExtension(baseName);

  if ((extension === ".md" || extension === ".markdown" || extension === ".json") && isPlausibleSummaryPath(filePath, artifactName, root)) {
    return extension === ".json"
      ? { category: "json", kindHint: "summary" }
      : { category: "markdown", kindHint: "summary" };
  }

  if (extension === ".log") {
    return { category: "log", kindHint: "log" };
  }

  if (extension === ".txt" && isPlausibleTextLogName(artifactName)) {
    return { category: "log", kindHint: "log" };
  }

  return null;
}

function isPlausibleSummaryPath(filePath: string, baseName: string, root: PassiveArtifactRootContext): boolean {
  if (KNOWN_SUMMARY_NAMES.has(baseName)) {
    return true;
  }

  if (baseName === "history" && root.provider === "gemini") {
    return true;
  }

  if (baseName !== "history") {
    return false;
  }

  const normalizedPath = filePath.split(path.sep).join("/");
  return KNOWN_SUMMARY_DIRECTORY_MARKERS.some((marker) => normalizedPath.includes(marker));
}

function isPlausibleTextLogName(baseName: string): boolean {
  return /(log|output|trace|transcript|history|session)/.test(baseName);
}

function compactTraversalRoots(roots: PassiveArtifactRoot[]): PassiveArtifactRootContext[] {
  const rootContexts = roots.map((root) => ({
    ...root,
    provider: inferRootProvider(root.path),
  }));

  return rootContexts.filter((root) => {
    if (!isNestedPawtrolAgentRoot(root.path)) {
      return true;
    }

    return !rootContexts.some((candidate) => candidate.path !== root.path && containsDescendantRoot(candidate.path, root.path));
  });
}

function inferRootProvider(rootPath: string): PassiveArtifactRootContext["provider"] {
  const normalized = rootPath.split(/[\\/]+/).filter(Boolean).map((part) => part.toLowerCase());

  if (normalized.includes(".codex")) {
    return "codex";
  }
  if (normalized.includes(".claude")) {
    return "claude";
  }
  if (normalized.includes(".gemini") || normalized.includes(".antigravity")) {
    return "gemini";
  }
  if (normalized.includes(".pawtrol")) {
    const agentIndex = normalized.lastIndexOf("agents");
    const agentName = agentIndex >= 0 ? normalized[agentIndex + 1] : null;
    if (agentName === "codex" || agentName === "claude" || agentName === "gemini") {
      return agentName;
    }
    return "pawtrol";
  }

  return null;
}

function isNestedPawtrolAgentRoot(rootPath: string): boolean {
  const normalized = rootPath.split(/[\\/]+/).filter(Boolean).map((part) => part.toLowerCase());
  const pawtrolIndex = normalized.lastIndexOf(".pawtrol");
  return pawtrolIndex >= 0 && normalized[pawtrolIndex + 1] === "agents" && normalized.length > pawtrolIndex + 2;
}

function containsDescendantRoot(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function stripExtension(baseName: string): string {
  const extension = path.extname(baseName);
  return extension.length > 0 ? baseName.slice(0, -extension.length) : baseName;
}

async function readArtifactStat(
  filePath: string,
  statFn: (path: string) => Promise<{ mtimeMs: number }>,
): Promise<{ mtimeMs: number } | null> {
  try {
    return await statFn(filePath);
  } catch (error) {
    if (shouldSkipFsError(error)) {
      return null;
    }
    throw error;
  }
}

async function defaultStatFn(filePath: string): Promise<{ mtimeMs: number }> {
  return stat(filePath);
}

function shouldSkipFsError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "ENOENT" || error.code === "EACCES" || error.code === "EPERM";
}

function normalizeCandidate(
  candidate: PassiveArtifactCandidate,
  now: Date,
  currentWindowMs: number,
): PassiveArtifactCandidate {
  const ageMs = Math.max(0, now.getTime() - candidate.mtimeMs);
  return {
    ...candidate,
    updatedAt: new Date(candidate.mtimeMs).toISOString(),
    ageMs,
    ageMinutes: Math.floor(ageMs / 60000),
    isCurrent: ageMs <= currentWindowMs,
  };
}

function pickBestCurrent(candidates: PassiveArtifactCandidate[]): PassiveArtifactCandidate | null {
  return [...candidates]
    .filter((candidate) => candidate.isCurrent)
    .sort(compareCurrentSelectionPriority)
    .at(0) ?? null;
}

function pickBestStale(candidates: PassiveArtifactCandidate[]): PassiveArtifactCandidate | null {
  return [...candidates]
    .filter((candidate) => !candidate.isCurrent)
    .sort(compareFreshness)
    .at(0) ?? null;
}

function compareFreshness(left: PassiveArtifactCandidate, right: PassiveArtifactCandidate): number {
  if (right.mtimeMs !== left.mtimeMs) {
    return right.mtimeMs - left.mtimeMs;
  }
  return left.path.localeCompare(right.path);
}

function compareCurrentSelectionPriority(left: PassiveArtifactCandidate, right: PassiveArtifactCandidate): number {
  const managedPriority = managedArtifactRank(left.path) - managedArtifactRank(right.path);
  if (managedPriority !== 0) {
    return managedPriority;
  }

  return compareFreshness(left, right);
}

function managedArtifactRank(artifactPath: string): number {
  const normalized = artifactPath.split(/[\\/]+/).filter(Boolean).map((part) => part.toLowerCase());
  const pawtrolIndex = normalized.lastIndexOf(".pawtrol");
  const agentName = pawtrolIndex >= 0 && normalized[pawtrolIndex + 1] === "agents" ? normalized[pawtrolIndex + 2] : null;

  return agentName === "codex" || agentName === "claude" || agentName === "gemini" ? 0 : 1;
}

function compareDiscoveryOrder(left: PassiveArtifactCandidate, right: PassiveArtifactCandidate): number {
  const scopeOrder = compareScope(left.sourceScope, right.sourceScope);
  if (scopeOrder !== 0) {
    return scopeOrder;
  }
  return left.path.localeCompare(right.path);
}

function compareScope(left: PassiveArtifactSourceScope, right: PassiveArtifactSourceScope): number {
  return scopeRank(left) - scopeRank(right);
}

function scopeRank(scope: PassiveArtifactRoot["scope"]): number {
  switch (scope) {
    case "cwd":
      return 0;
    case "home_app":
      return 1;
    case "extra":
      return 2;
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "ENOENT";
}
