export type PassiveArtifactSourceType = "markdown" | "json" | "log";
export type PassiveArtifactConfidenceHint = "high" | "medium" | "low";

export type PassiveArtifactSnapshot = {
  sourceType: PassiveArtifactSourceType;
  sourcePath: string;
  providerLabel: string | null;
  appKind: string | null;
  taskHint: string | null;
  problemHint: string | null;
  contextPercent: number | null;
  tokenEtaMinutes: number | null;
  repeatedFailureKey: string | null;
  repeatedFailureCount: number | null;
  recentFileHints: string[];
  recentTestHints: string[];
  confidenceHint: PassiveArtifactConfidenceHint;
  updatedAt: string | null;
  staleReadyAt: string | null;
  stale: boolean | null;
};

export function parsePassiveArtifact(input: {
  path: string;
  sourceType?: PassiveArtifactSourceType;
  kind?: "summary" | "log";
  content: string;
  now?: Date;
}): PassiveArtifactSnapshot {
  const sourceType = detectSourceType(input);
  switch (sourceType) {
    case "markdown":
      return parseMarkdownArtifact(input.path, input.content, input.now);
    case "json":
      return parseJsonArtifact(input.path, input.content, input.now);
    case "log":
      return parseLogArtifact(input.path, input.content, input.now);
  }
}

function parseMarkdownArtifact(path: string, content: string, now?: Date): PassiveArtifactSnapshot {
  const lines = content.split(/\r?\n/);
  const fields = new Map<string, string>();
  const recentLines = collectRecentLines(lines);

  for (const line of lines) {
    const match = line.match(/^([A-Za-z ]+):\s*(.+)$/);
    if (!match) {
      continue;
    }
    fields.set(normalizeKey(match[1]), match[2].trim());
  }

  const providerLabel = normalizeProvider(fields.get("provider") ?? inferProvider(content, path));
  const taskHint = normalizeNullableText(fields.get("task"));
  const repeatedFailureKey = normalizeNullableText(fields.get("problem"));
  const updatedAt = parseTimestamp(fields.get("updated at"));
  const staleReadyAt = firstNonNullTimestamp(parseTimestamp(fields.get("stale ready at")), deriveStaleReadyAt(updatedAt));
  const stale = deriveStaleFlag(parseBoolean(fields.get("stale") ?? null), staleReadyAt, now);

  return {
    sourceType: "markdown",
    sourcePath: path,
    providerLabel,
    appKind: normalizeAppKind(providerLabel),
    taskHint,
    problemHint: repeatedFailureKey,
    contextPercent: parsePercent(fields.get("context")),
    tokenEtaMinutes: parseEtaMinutes(fields.get("token eta")),
    repeatedFailureKey,
    repeatedFailureCount: parseInteger(fields.get("repeated failure count")),
    recentFileHints: collectUniqueHints(recentLines, extractFileHints),
    recentTestHints: collectUniqueHints(recentLines, extractTestHints),
    confidenceHint: downgradeConfidenceIfStale("medium", stale),
    updatedAt,
    staleReadyAt,
    stale,
  };
}

function parseJsonArtifact(path: string, content: string, now?: Date): PassiveArtifactSnapshot {
  const managedAgentArtifact = isManagedAgentArtifactPath(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return managedAgentArtifact
      ? buildManagedEmptyJsonSnapshot(path)
      : buildEmptySnapshot(path, "json", inferProvider(content, path), "medium");
  }

  const data = isRecord(parsed) ? parsed : {};
  const repeatedFailure = isRecord(data.repeatedFailure) ? data.repeatedFailure : {};
  const providerLabel = normalizeProvider(readString(data.provider) ?? readString(data.providerLabel) ?? inferProvider(content, path));
  const appKind = normalizeNullableText(readString(data.appKind) ?? readString(data.app))
    ?? (managedAgentArtifact ? null : normalizeAppKind(providerLabel));
  const taskHint = normalizeNullableText(readString(data.task));
  const problemHint =
    normalizeNullableText(readString(data.problem)) ??
    normalizeNullableText(readString(data.problemHint));
  const baseConfidenceHint = parseConfidence(readString(data.confidence)) ?? "medium";
  const updatedAt = parseTimestamp(readString(data.updatedAt));
  const staleReadyAt = firstNonNullTimestamp(
    parseTimestamp(readString(data.staleReadyAt)),
    managedAgentArtifact ? null : deriveStaleReadyAt(updatedAt),
  );
  const stale = deriveStaleFlag(parseBoolean(readString(data.stale)), staleReadyAt, now);

  return {
    sourceType: "json",
    sourcePath: path,
    providerLabel,
    appKind,
    taskHint,
    problemHint,
    contextPercent: parseNumericValue(data.contextPercent),
    tokenEtaMinutes: parseNumericValue(data.tokenEtaMinutes),
    repeatedFailureKey:
      normalizeNullableText(readString(repeatedFailure.key)) ??
      normalizeNullableText(readString(data.repeatedFailureKey)),
    repeatedFailureCount:
      parseNumericValue(repeatedFailure.count) ??
      parseNumericValue(data.repeatedFailureCount),
    recentFileHints: readStringArray(data.recentFiles),
    recentTestHints: readStringArray(data.recentTests),
    confidenceHint: downgradeConfidenceIfStale(baseConfidenceHint, stale),
    updatedAt,
    staleReadyAt,
    stale,
  };
}

function buildManagedEmptyJsonSnapshot(path: string): PassiveArtifactSnapshot {
  return {
    sourceType: "json",
    sourcePath: path,
    providerLabel: normalizeProvider(inferProvider("", path)),
    appKind: null,
    taskHint: null,
    problemHint: null,
    contextPercent: null,
    tokenEtaMinutes: null,
    repeatedFailureKey: null,
    repeatedFailureCount: null,
    recentFileHints: [],
    recentTestHints: [],
    confidenceHint: "medium",
    updatedAt: null,
    staleReadyAt: null,
    stale: null,
  };
}

function parseLogArtifact(path: string, content: string, now?: Date): PassiveArtifactSnapshot {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const providerLabel = normalizeProvider(inferProvider(content, path));
  const repeatedFailures = collectRepeatedFailures(lines);
  const primaryFailure = repeatedFailures[0] ?? null;

  return {
    sourceType: "log",
    sourcePath: path,
    providerLabel,
    appKind: normalizeAppKind(providerLabel),
    taskHint: null,
    problemHint: primaryFailure?.key ?? null,
    contextPercent: null,
    tokenEtaMinutes: null,
    repeatedFailureKey: primaryFailure?.key ?? null,
    repeatedFailureCount: primaryFailure?.count ?? null,
    recentFileHints: collectUniqueHints(lines, extractFileHints),
    recentTestHints: collectUniqueHints(lines, extractTestHints),
    confidenceHint: "low",
    updatedAt: null,
    staleReadyAt: null,
    stale: null,
  };
}

function buildEmptySnapshot(
  path: string,
  sourceType: PassiveArtifactSourceType,
  providerLabel: string | null,
  confidenceHint: PassiveArtifactConfidenceHint,
): PassiveArtifactSnapshot {
  return {
    sourceType,
    sourcePath: path,
    providerLabel,
    appKind: normalizeAppKind(providerLabel),
    taskHint: null,
    problemHint: null,
    contextPercent: null,
    tokenEtaMinutes: null,
    repeatedFailureKey: null,
    repeatedFailureCount: null,
    recentFileHints: [],
    recentTestHints: [],
    confidenceHint,
    updatedAt: null,
    staleReadyAt: null,
    stale: null,
  };
}

function collectRecentLines(lines: string[]): string[] {
  const index = lines.findIndex((line) => line.trim().toLowerCase() === "## recent lines");
  if (index === -1) {
    return [];
  }

  const recentLines: string[] = [];

  for (const line of lines.slice(index + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      break;
    }
    if (!trimmed.startsWith("- ")) {
      continue;
    }
    const entry = trimmed.slice(2).trim();
    if (entry.length > 0) {
      recentLines.push(entry);
    }
  }

  return recentLines;
}

function collectRepeatedFailures(lines: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();

  for (const line of lines) {
    const failure = extractFailureKey(line);
    if (!failure) {
      continue;
    }
    counts.set(failure, (counts.get(failure) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.key.localeCompare(right.key);
    });
}

function extractFailureKey(line: string): string | null {
  const match = line.match(/FAIL\s+(.+)/i);
  if (match) {
    return match[1].trim();
  }

  return null;
}

function extractFileHints(line: string): string[] {
  const matches = line.match(/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/g) ?? [];
  return matches.filter((candidate) => candidate.includes("/") && !isLikelyTestFile(candidate));
}

function extractTestHints(line: string): string[] {
  const matches = line.match(/[A-Za-z0-9_./-]+\.(?:spec|test)\.[A-Za-z0-9]+/g) ?? [];
  return matches;
}

function collectUniqueHints(lines: string[], extractor: (line: string) => string[]): string[] {
  const unique = new Set<string>();

  for (const line of lines) {
    for (const hint of extractor(line)) {
      unique.add(hint);
    }
  }

  return [...unique];
}

function inferProvider(content: string, path: string): string | null {
  return inferProviderFromPath(path) ?? inferProviderFromBracketedContent(content);
}

function normalizeAppKind(providerLabel: string | null): string | null {
  if (!providerLabel) {
    return null;
  }

  switch (providerLabel) {
    case "codex":
    case "claude":
    case "gemini":
    case "pawtrol":
      return providerLabel;
    default:
      return providerLabel;
  }
}

function normalizeProvider(value: string | null): string | null {
  const normalized = normalizeNullableText(value)?.toLowerCase() ?? null;
  if (normalized === "antigravity") {
    return "gemini";
  }
  return normalized;
}

function normalizeNullableText(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown" || trimmed.toLowerCase() === "none") {
    return null;
  }
  return trimmed;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parsePercent(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d{1,3})\s*%/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function parseEtaMinutes(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d+)/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function parseInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/-?\d+/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[0], 10);
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseTimestamp(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function parseBoolean(value: string | null): boolean | null {
  switch (value?.trim().toLowerCase()) {
    case "true":
    case "yes":
    case "1":
      return true;
    case "false":
    case "no":
    case "0":
      return false;
    default:
      return null;
  }
}

function deriveStaleReadyAt(updatedAt: string | null): string | null {
  if (!updatedAt) {
    return null;
  }

  const parsed = Date.parse(updatedAt);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed + 15 * 60 * 1000).toISOString();
}

function firstNonNullTimestamp(...values: Array<string | null>): string | null {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return null;
}

function deriveStaleFlag(explicit: boolean | null, staleReadyAt: string | null, now?: Date): boolean | null {
  if (explicit !== null) {
    return explicit;
  }
  if (!staleReadyAt || !now) {
    return null;
  }
  return Date.parse(staleReadyAt) <= now.getTime();
}

function detectSourceType(input: {
  path: string;
  sourceType?: PassiveArtifactSourceType;
  kind?: "summary" | "log";
  content: string;
}): PassiveArtifactSourceType {
  if (input.sourceType) {
    return input.sourceType;
  }

  if (input.kind === "log") {
    return "log";
  }

  const trimmed = input.content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // fall through
    }
  }

  if (looksLikeMarkdownSummary(input.path, input.content, input.kind)) {
    return "markdown";
  }

  return input.kind === "summary" ? "markdown" : "log";
}

function looksLikeMarkdownSummary(path: string, content: string, kind?: "summary" | "log"): boolean {
  if (kind === "summary" && /\.(md|markdown)$/i.test(path)) {
    return true;
  }

  if (/^#\s+Pawtrol Session Plan/m.test(content)) {
    return true;
  }

  const summaryMarkers = [/^Context:\s+/m, /^Token ETA:\s+/m, /^Repeated failure count:\s+/m, /^## Recent Lines$/m];
  const markerCount = summaryMarkers.filter((pattern) => pattern.test(content)).length;
  return markerCount >= 2;
}

function inferProviderFromPath(pathValue: string): string | null {
  const normalized = pathValue.split(/[\\/]+/).filter(Boolean).map((part) => part.toLowerCase());
  const baseName = normalized.at(-1) ?? "";
  const managedAgentProvider = inferManagedAgentProvider(normalized);

  if (managedAgentProvider) {
    return managedAgentProvider;
  }

  if (normalized.includes(".codex") || baseName.startsWith("codex")) {
    return "codex";
  }
  if (normalized.includes(".claude") || baseName.startsWith("claude")) {
    return "claude";
  }
  if (normalized.includes(".pawtrol") || baseName.startsWith("pawtrol")) {
    return "pawtrol";
  }
  if (
    normalized.includes(".gemini") ||
    normalized.includes(".antigravity") ||
    baseName.startsWith("gemini")
  ) {
    return "gemini";
  }

  return null;
}

function isManagedAgentArtifactPath(pathValue: string): boolean {
  const normalized = pathValue.split(/[\\/]+/).filter(Boolean).map((part) => part.toLowerCase());
  const pawtrolIndex = normalized.lastIndexOf(".pawtrol");

  if (pawtrolIndex === -1 || normalized[pawtrolIndex + 1] !== "agents") {
    return false;
  }

  return inferManagedAgentProvider(normalized.slice(pawtrolIndex + 1)) !== null;
}

function inferManagedAgentProvider(parts: string[]): "codex" | "claude" | "gemini" | null {
  const agentIndex = parts.lastIndexOf("agents");
  const agentName = agentIndex >= 0 ? parts[agentIndex + 1] : null;

  if (agentName === "codex" || agentName === "claude" || agentName === "gemini") {
    return agentName;
  }

  return null;
}

function inferProviderFromBracketedContent(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const bracketMatch = trimmed.match(/^\[(codex|claude|gemini|pawtrol)\]/i);
    if (bracketMatch) {
      return bracketMatch[1].toLowerCase();
    }
  }

  return null;
}

function downgradeConfidenceIfStale(
  confidenceHint: PassiveArtifactConfidenceHint,
  stale: boolean | null,
): PassiveArtifactConfidenceHint {
  return stale ? "low" : confidenceHint;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function parseConfidence(value: string | null): PassiveArtifactConfidenceHint | null {
  switch (value?.toLowerCase()) {
    case "high":
    case "medium":
    case "low":
      return value.toLowerCase() as PassiveArtifactConfidenceHint;
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLikelyTestFile(value: string): boolean {
  return /\.(spec|test)\./.test(value);
}
