import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURRENT_ARTIFACT_WINDOW_MS,
  getPassiveArtifactRoots,
  parsePassiveArtifactPathList,
} from "../src/session/passive-artifact-config.js";
import {
  discoverPassiveArtifacts,
  selectPassiveArtifacts,
  type PassiveArtifactCandidate,
} from "../src/session/passive-artifacts.js";
import { parsePassiveArtifact } from "../src/session/passive-artifact-parse.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe("passive artifact config", () => {
  it("collects cwd, fixed home roots, and user-added roots from env/config", () => {
    const roots = getPassiveArtifactRoots({
      cwd: "/repo",
      homeDir: "/Users/tester",
      env: {
        PAWTROL_PASSIVE_ARTIFACT_PATHS: " /env/one ,/env/two\n/env/three,, ",
      },
      config: {
        passiveArtifactPaths: ["/cfg/one", " /cfg/two ", "", "/env/two"],
      },
    });

    expect(roots).toEqual([
      { path: "/repo", scope: "cwd" },
      { path: "/Users/tester/.pawtrol", scope: "home_app" },
      { path: "/Users/tester/.pawtrol/agents/codex", scope: "home_app" },
      { path: "/Users/tester/.pawtrol/agents/claude", scope: "home_app" },
      { path: "/Users/tester/.pawtrol/agents/gemini", scope: "home_app" },
      { path: "/Users/tester/.codex", scope: "home_app" },
      { path: "/Users/tester/.claude", scope: "home_app" },
      { path: "/Users/tester/.gemini", scope: "home_app" },
      { path: "/Users/tester/Library/Application Support/Pawtrol", scope: "home_app" },
      { path: "/Users/tester/Library/Application Support/Codex", scope: "home_app" },
      { path: "/Users/tester/Library/Application Support/Claude", scope: "home_app" },
      { path: "/env/one", scope: "extra" },
      { path: "/env/two", scope: "extra" },
      { path: "/env/three", scope: "extra" },
      { path: "/cfg/one", scope: "extra" },
      { path: "/cfg/two", scope: "extra" },
    ]);
  });

  it("parses path lists conservatively", () => {
    expect(parsePassiveArtifactPathList(undefined)).toEqual([]);
    expect(parsePassiveArtifactPathList(" , \n ")).toEqual([]);
    expect(parsePassiveArtifactPathList("/one:/two;/three,\n/four")).toEqual([
      "/one",
      "/two",
      "/three",
      "/four",
    ]);
  });

  it("prefers a Gemini-compatible env root over the ~/.gemini fallback", () => {
    const roots = getPassiveArtifactRoots({
      cwd: "/repo",
      homeDir: "/Users/tester",
      env: {
        ANTIGRAVITY_HOME: "/Users/tester/.antigravity",
      },
    });

    expect(roots).toContainEqual({
      path: "/Users/tester/.antigravity",
      scope: "home_app",
    });
    expect(roots).not.toContainEqual({
      path: "/Users/tester/.gemini",
      scope: "home_app",
    });
  });

  it("falls back to ~/.gemini when Gemini-compatible env values are blank", () => {
    const roots = getPassiveArtifactRoots({
      cwd: "/repo",
      homeDir: "/Users/tester",
      env: {
        ANTIGRAVITY_HOME: " ",
        GEMINI_HOME: "\t",
      },
    });

    expect(roots).toContainEqual({
      path: "/Users/tester/.gemini",
      scope: "home_app",
    });
    expect(roots).not.toContainEqual({
      path: " ",
      scope: "home_app",
    });
  });
});

describe("passive artifact discovery", () => {
  it("discovers supported files under the cwd subtree and tagged roots", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");
    const extraDir = path.join(tempRoot, "extra");

    await mkdir(path.join(cwd, ".pawtrol"), { recursive: true });
    await mkdir(path.join(homeDir, ".codex"), { recursive: true });
    await mkdir(extraDir, { recursive: true });

    await writeFile(path.join(cwd, ".pawtrol", "session-plan.md"), "# summary\n", "utf8");
    await writeFile(path.join(homeDir, ".codex", "history.json"), "{\"ok\":true}\n", "utf8");
    await writeFile(path.join(extraDir, "agent.log"), "log line\n", "utf8");
    await writeFile(path.join(extraDir, "session.txt"), "plain text session log\n", "utf8");
    await writeFile(path.join(cwd, "notes.txt"), "ignore me\n", "utf8");
    await writeFile(path.join(cwd, "README.md"), "# unrelated repo doc\n", "utf8");
    await writeFile(path.join(cwd, "package.json"), "{\"name\":\"repo\"}\n", "utf8");

    const artifacts = await discoverPassiveArtifacts({
      cwd,
      homeDir,
      extraPaths: [extraDir],
    });

    expect(artifacts.map((artifact) => ({
      baseName: path.basename(artifact.path),
      category: artifact.category,
      kindHint: artifact.kindHint,
      sourceScope: artifact.sourceScope,
    }))).toEqual([
      {
        baseName: "session-plan.md",
        category: "markdown",
        kindHint: "summary",
        sourceScope: "cwd",
      },
      {
        baseName: "history.json",
        category: "json",
        kindHint: "summary",
        sourceScope: "home_app",
      },
      {
        baseName: "agent.log",
        category: "log",
        kindHint: "log",
        sourceScope: "extra",
      },
      {
        baseName: "session.txt",
        category: "log",
        kindHint: "log",
        sourceScope: "extra",
      },
    ]);

    for (const artifact of artifacts) {
      expect(artifact.mtimeMs).toBeGreaterThan(0);
      expect(artifact.updatedAt).toMatch(/T/);
      expect(typeof artifact.ageMs).toBe("number");
    }
  });

  it("ignores unrelated markdown and json files while keeping plausible summary artifacts", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");

    await mkdir(path.join(cwd, ".pawtrol"), { recursive: true });
    await mkdir(path.join(cwd, "docs"), { recursive: true });
    await mkdir(path.join(homeDir, ".codex"), { recursive: true });

    await writeFile(path.join(cwd, ".pawtrol", "session-summary.md"), "# summary\n", "utf8");
    await writeFile(path.join(homeDir, ".codex", "codex-session.json"), "{\"ok\":true}\n", "utf8");
    await writeFile(path.join(cwd, "README.md"), "# repo readme\n", "utf8");
    await writeFile(path.join(cwd, "docs", "notes.markdown"), "# notes\n", "utf8");
    await writeFile(path.join(cwd, "docs", "migration-plan.md"), "# not a passive session artifact\n", "utf8");
    await writeFile(path.join(cwd, "package.json"), "{\"name\":\"repo\"}\n", "utf8");
    await writeFile(path.join(cwd, "tsconfig.json"), "{\"compilerOptions\":{}}\n", "utf8");
    await writeFile(path.join(cwd, "docs", "history.json"), "{\"kind\":\"fixture\"}\n", "utf8");

    const artifacts = await discoverPassiveArtifacts({
      cwd,
      homeDir,
    });

    expect(artifacts.filter((artifact) => artifact.kindHint === "summary").map((artifact) => path.basename(artifact.path))).toEqual([
      "session-summary.md",
      "codex-session.json",
    ]);
  });

  it("discovers a history artifact under an env-resolved Gemini-compatible root and attributes it to Gemini", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");
    const antigravityHome = path.join(homeDir, ".antigravity");

    await mkdir(antigravityHome, { recursive: true });
    await writeFile(path.join(antigravityHome, "history.json"), "{\"task\":\"triage artifact routing\"}\n", "utf8");

    const artifacts = await discoverPassiveArtifacts({
      cwd,
      homeDir,
      env: {
        ANTIGRAVITY_HOME: antigravityHome,
      },
    });

    expect(artifacts.map((artifact) => path.basename(artifact.path))).toContain("history.json");

    const geminiArtifact = artifacts.find((artifact) => artifact.path === path.join(antigravityHome, "history.json"));
    expect(geminiArtifact?.kindHint).toBe("summary");

    const snapshot = parsePassiveArtifact({
      path: geminiArtifact?.path ?? path.join(antigravityHome, "history.json"),
      kind: geminiArtifact?.kindHint ?? "summary",
      sourceType: geminiArtifact?.category ?? "json",
      content: "{\"task\":\"triage artifact routing\"}\n",
    });

    expect(snapshot.providerLabel).toBe("gemini");
    expect(snapshot.appKind).toBe("gemini");
  });

  it("skips large non-artifact directories while scanning the cwd subtree", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");

    await mkdir(path.join(cwd, ".pawtrol"), { recursive: true });
    await mkdir(path.join(cwd, "node_modules", "pkg"), { recursive: true });
    await writeFile(path.join(cwd, ".pawtrol", "session-plan.md"), "# summary\n", "utf8");
    await writeFile(path.join(cwd, "node_modules", "pkg", "session-plan.md"), "# should be ignored\n", "utf8");

    const artifacts = await discoverPassiveArtifacts({
      cwd,
      homeDir,
    });

    expect(artifacts.map((artifact) => artifact.path)).toEqual([path.join(cwd, ".pawtrol", "session-plan.md")]);
  });

  it("accepts plain-text log names conservatively", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");
    const extraDir = path.join(tempRoot, "extra");

    await mkdir(extraDir, { recursive: true });
    await writeFile(path.join(extraDir, "transcript.txt"), "transcript\n", "utf8");
    await writeFile(path.join(extraDir, "codex-output.txt"), "output\n", "utf8");
    await writeFile(path.join(extraDir, "notes.txt"), "ignore\n", "utf8");

    const artifacts = await discoverPassiveArtifacts({
      cwd,
      homeDir,
      extraPaths: [extraDir],
    });

    expect(artifacts.map((artifact) => path.basename(artifact.path))).toEqual([
      "codex-output.txt",
      "transcript.txt",
    ]);
  });

  it("deduplicates overlapping roots and preserves the first-seen scope", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");
    const duplicateRoot = path.join(cwd, ".pawtrol");

    await mkdir(duplicateRoot, { recursive: true });
    await writeFile(path.join(duplicateRoot, "session-plan.md"), "# summary\n", "utf8");

    const artifacts = await discoverPassiveArtifacts({
      cwd,
      homeDir,
      extraPaths: [cwd, duplicateRoot],
      env: {
        PAWTROL_PASSIVE_ARTIFACT_PATHS: `${cwd},${duplicateRoot}`,
      },
    });

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.sourceScope).toBe("cwd");
  });

  it("skips files that disappear between directory walk and stat", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");
    const flappyDir = path.join(cwd, ".pawtrol");

    await mkdir(flappyDir, { recursive: true });
    await writeFile(path.join(flappyDir, "session-plan.md"), "# summary\n", "utf8");
    await writeFile(path.join(flappyDir, "session.log"), "line\n", "utf8");

    const artifacts = await discoverPassiveArtifacts({
      cwd,
      homeDir,
      statFn: async (targetPath) => {
        if (targetPath.endsWith("session-plan.md")) {
          const error = new Error("gone") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
        const { stat } = await import("node:fs/promises");
        return stat(targetPath);
      },
    });

    expect(artifacts.map((artifact) => path.basename(artifact.path))).toEqual(["session.log"]);
  });

  it("does not traverse nested Pawtrol agent roots when the parent Pawtrol root is already scanned", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");
    const traversedRoots: string[] = [];

    await mkdir(path.join(homeDir, ".pawtrol", "agents", "gemini"), { recursive: true });

    await discoverPassiveArtifacts({
      cwd,
      homeDir,
      walkFilesFn: async (rootPath) => {
        traversedRoots.push(rootPath);
        return [];
      },
    });

    expect(traversedRoots).toContain(path.join(homeDir, ".pawtrol"));
    expect(traversedRoots).not.toContain(path.join(homeDir, ".pawtrol", "agents", "codex"));
    expect(traversedRoots).not.toContain(path.join(homeDir, ".pawtrol", "agents", "claude"));
    expect(traversedRoots).not.toContain(path.join(homeDir, ".pawtrol", "agents", "gemini"));
  });

  it("prefers a current Pawtrol-managed Gemini summary and log pair", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pawtrol-passive-artifacts-"));
    tempDirs.push(tempRoot);

    const cwd = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");
    const managedGeminiRoot = path.join(homeDir, ".pawtrol", "agents", "gemini");
    const legacyGeminiRoot = path.join(homeDir, ".gemini");
    const now = new Date("2026-04-28T12:00:00.000Z");

    await mkdir(managedGeminiRoot, { recursive: true });
    await mkdir(legacyGeminiRoot, { recursive: true });
    await writeFile(path.join(managedGeminiRoot, "gemini-session.json"), "{\"task\":\"fix overlay spinner\"}\n", "utf8");
    await writeFile(path.join(managedGeminiRoot, "session.log"), "[gemini] still working\n", "utf8");
    await writeFile(path.join(legacyGeminiRoot, "history.json"), "{\"task\":\"stale legacy summary\"}\n", "utf8");

    const staleMtimeMs = now.getTime() - 20 * 60 * 1000;
    await Promise.all([
      import("node:fs/promises").then(({ utimes }) =>
        utimes(path.join(managedGeminiRoot, "gemini-session.json"), now, now),
      ),
      import("node:fs/promises").then(({ utimes }) =>
        utimes(path.join(managedGeminiRoot, "session.log"), now, now),
      ),
      import("node:fs/promises").then(({ utimes }) =>
        utimes(path.join(legacyGeminiRoot, "history.json"), new Date(staleMtimeMs), new Date(staleMtimeMs)),
      ),
    ]);

    const artifacts = await discoverPassiveArtifacts({
      cwd,
      homeDir,
      now,
    });

    expect(artifacts.map((artifact) => path.relative(homeDir, artifact.path))).toContain(".pawtrol/agents/gemini/gemini-session.json");

    const selected = selectPassiveArtifacts({
      candidates: artifacts,
      now,
    });

    expect(selected.summary?.path).toBe(path.join(managedGeminiRoot, "gemini-session.json"));
    expect(selected.log?.path).toBe(path.join(managedGeminiRoot, "session.log"));
    expect(selected.staleSummary?.path).toBe(path.join(legacyGeminiRoot, "history.json"));
  });

  it("prefers current Pawtrol-managed artifacts over competing current legacy provider artifacts", () => {
    const now = new Date("2026-04-28T12:00:00.000Z");
    const managedSummary = buildCandidate(
      "/Users/tester/.pawtrol/agents/gemini/gemini-session.json",
      "summary",
      "json",
      "home_app",
      now,
      4,
    );
    const legacySummary = buildCandidate(
      "/Users/tester/.gemini/history.json",
      "summary",
      "json",
      "home_app",
      now,
      1,
    );
    const managedLog = buildCandidate(
      "/Users/tester/.pawtrol/agents/gemini/session.log",
      "log",
      "log",
      "home_app",
      now,
      5,
    );
    const legacyLog = buildCandidate(
      "/Users/tester/.gemini/history.log",
      "log",
      "log",
      "home_app",
      now,
      2,
    );

    const result = selectPassiveArtifacts({
      now,
      candidates: [legacySummary, managedSummary, legacyLog, managedLog],
    });

    expect(result.summary?.path).toBe(managedSummary.path);
    expect(result.log?.path).toBe(managedLog.path);
  });

  it("does not let managed preference override a fresher current artifact from another provider", () => {
    const now = new Date("2026-04-28T12:00:00.000Z");
    const olderManagedGeminiSummary = buildCandidate(
      "/Users/tester/.pawtrol/agents/gemini/gemini-session.json",
      "summary",
      "json",
      "home_app",
      now,
      8,
    );
    const fresherLegacyCodexSummary = buildCandidate(
      "/Users/tester/.codex/history.json",
      "summary",
      "json",
      "home_app",
      now,
      1,
    );
    const olderManagedGeminiLog = buildCandidate(
      "/Users/tester/.pawtrol/agents/gemini/session.log",
      "log",
      "log",
      "home_app",
      now,
      7,
    );
    const fresherLegacyCodexLog = buildCandidate(
      "/Users/tester/.codex/history.log",
      "log",
      "log",
      "home_app",
      now,
      2,
    );

    const result = selectPassiveArtifacts({
      now,
      candidates: [
        olderManagedGeminiSummary,
        fresherLegacyCodexSummary,
        olderManagedGeminiLog,
        fresherLegacyCodexLog,
      ],
    });

    expect(result.summary?.path).toBe(fresherLegacyCodexSummary.path);
    expect(result.log?.path).toBe(fresherLegacyCodexLog.path);
  });

  it("prefers one recent summary artifact and one recent log artifact while preserving stale metadata", () => {
    const now = new Date("2026-04-28T12:00:00.000Z");
    const recentSummary = buildCandidate("/repo/.pawtrol/session-plan.md", "summary", "markdown", "cwd", now, 5);
    const recentLog = buildCandidate("/repo/.pawtrol/codex.log", "log", "log", "cwd", now, 6);
    const staleSummary = buildCandidate("/Users/tester/.codex/history.json", "summary", "json", "home_app", now, 35);

    const result = selectPassiveArtifacts({
      now,
      candidates: [staleSummary, recentLog, recentSummary],
    });

    expect(result.summary?.path).toBe(recentSummary.path);
    expect(result.log?.path).toBe(recentLog.path);
    expect(result.staleSummary?.path).toBe(staleSummary.path);
    expect(result.currentWindowMs).toBe(CURRENT_ARTIFACT_WINDOW_MS);
    expect(result.summary?.ageMinutes).toBe(5);
    expect(result.log?.ageMinutes).toBe(6);
    expect(result.staleSummary?.isCurrent).toBe(false);
  });

  it("treats artifacts older than fifteen minutes as stale", () => {
    const now = new Date("2026-04-28T12:00:00.000Z");
    const staleSummary = buildCandidate("/repo/.pawtrol/session-plan.md", "summary", "markdown", "cwd", now, 16);

    const result = selectPassiveArtifacts({
      now,
      candidates: [staleSummary],
    });

    expect(result.summary).toBeNull();
    expect(result.log).toBeNull();
    expect(result.staleSummary?.path).toBe(staleSummary.path);
    expect(result.staleSummary?.ageMs).toBe(16 * 60 * 1000);
  });

  it("prefers the freshest current candidate when multiple summaries or logs compete", () => {
    const now = new Date("2026-04-28T12:00:00.000Z");
    const olderSummary = buildCandidate("/repo/.pawtrol/session-plan.md", "summary", "markdown", "cwd", now, 9);
    const newerSummary = buildCandidate("/repo/.pawtrol/session-summary.md", "summary", "markdown", "cwd", now, 2);
    const olderLog = buildCandidate("/repo/.pawtrol/session.log", "log", "log", "cwd", now, 7);
    const newerLog = buildCandidate("/repo/.pawtrol/transcript.txt", "log", "log", "cwd", now, 1);

    const result = selectPassiveArtifacts({
      now,
      candidates: [olderSummary, olderLog, newerSummary, newerLog],
    });

    expect(result.summary?.path).toBe(newerSummary.path);
    expect(result.log?.path).toBe(newerLog.path);
  });
});

function buildCandidate(
  artifactPath: string,
  kindHint: PassiveArtifactCandidate["kindHint"],
  category: PassiveArtifactCandidate["category"],
  sourceScope: PassiveArtifactCandidate["sourceScope"],
  now: Date,
  ageMinutes: number,
): PassiveArtifactCandidate {
  const ageMs = ageMinutes * 60 * 1000;
  const mtimeMs = now.getTime() - ageMs;
  return {
    path: artifactPath,
    category,
    kindHint,
    sourceScope,
    mtimeMs,
    updatedAt: new Date(mtimeMs).toISOString(),
    ageMs,
    ageMinutes,
    isCurrent: ageMs <= CURRENT_ARTIFACT_WINDOW_MS,
  };
}
