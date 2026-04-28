# Passive Companion File Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file-based passive companion integration, explicit passive/watch diagnostics, compact two-column status UI, and macOS action CTAs while keeping packaged macOS behavior stable.

**Architecture:** Split the work into four layers: artifact discovery, artifact parsing/normalization, passive companion evaluation, and compact status rendering. Keep `watch` mode behavior intact, make `passive` mode explicitly lower-confidence, and gate packaged macOS overlay behavior behind small policy helpers so stability fixes stay isolated from renderer logic.

**Tech Stack:** TypeScript, Electron, express/ws overlay server, existing Pawtrol session/coaching pipeline, Vitest.

---

## File Map

**Create**
- `src/session/passive-artifacts.ts` — discover candidate summary/log artifacts from cwd, home defaults, env, and config paths
- `src/session/passive-artifact-parse.ts` — parse Markdown/JSON/text artifacts into a normalized passive snapshot
- `src/session/passive-artifact-config.ts` — read env/config path additions and default home search roots
- `src/session/passive-companion.ts` — merge process-detect signals and artifact snapshot into conservative passive coaching output
- `src/desktop/system-actions.ts` — map CTA ids to macOS targets (Activity Monitor, Storage, Network, open paths, watch instructions)
- `tests/passive-artifacts.test.ts` — discovery/recency/priority tests
- `tests/passive-artifact-parse.test.ts` — Markdown/JSON/text parsing tests
- `tests/system-actions.test.ts` — CTA routing tests

**Modify**
- `src/cli.ts` — feed passive mode with artifact-backed snapshot data and overlay metadata
- `src/session/types.ts` — extend overlay/popup metadata for source, updated-at, confidence, stale, CTA availability
- `src/overlay/index.html` — replace current long metric layout with compact two-column stat boxes and CTA buttons
- `src/overlay/app.ts` — render compact passive/watch metadata, unknown/stale hints, CTA button behavior
- `src/overlay/styles.css` — compact panel layout, two-column stat grid, CTA styling
- `src/desktop/preload.ts` — expose CTA action bridge to renderer
- `src/desktop/main.ts` — handle CTA commands, packaged stability policy, and keep passive companion packaged behavior conservative
- `src/desktop/window-shape-mode.ts` — packaged macOS stability policy helpers
- `tests/overlay-markup.test.ts` — assert compact stat/CTA markup
- `tests/overlay-presenter.test.ts` — assert unknown/stale/passive metadata copy
- `tests/desktop.test.ts` — assert packaged behavior policy

---

### Task 1: Add Artifact Discovery

**Files:**
- Create: `src/session/passive-artifacts.ts`
- Create: `src/session/passive-artifact-config.ts`
- Test: `tests/passive-artifacts.test.ts`

- [ ] **Step 1: Write failing artifact discovery tests**

```ts
import { describe, expect, it } from "vitest";
import { selectPassiveArtifacts } from "../src/session/passive-artifacts.js";

describe("passive artifact discovery", () => {
  it("prefers one recent summary artifact and one recent log artifact", async () => {
    const result = await selectPassiveArtifacts({
      cwd: "/repo",
      homeDir: "/Users/test",
      now: new Date("2026-04-28T12:00:00Z"),
      extraPaths: [],
      candidates: [
        { path: "/repo/.pawtrol/session-plan.md", mtimeMs: Date.parse("2026-04-28T11:55:00Z"), kind: "summary" },
        { path: "/repo/.pawtrol/codex.log", mtimeMs: Date.parse("2026-04-28T11:54:00Z"), kind: "log" },
      ],
    });

    expect(result.summary?.path).toBe("/repo/.pawtrol/session-plan.md");
    expect(result.log?.path).toBe("/repo/.pawtrol/codex.log");
  });

  it("ignores artifacts older than 15 minutes for current mode", async () => {
    const result = await selectPassiveArtifacts({
      cwd: "/repo",
      homeDir: "/Users/test",
      now: new Date("2026-04-28T12:00:00Z"),
      extraPaths: [],
      candidates: [
        { path: "/repo/.pawtrol/session-plan.md", mtimeMs: Date.parse("2026-04-28T11:30:00Z"), kind: "summary" },
      ],
    });

    expect(result.summary).toBeNull();
    expect(result.staleSummary?.path).toBe("/repo/.pawtrol/session-plan.md");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/passive-artifacts.test.ts`  
Expected: FAIL because `selectPassiveArtifacts` does not exist.

- [ ] **Step 3: Implement minimal discovery/config modules**

```ts
// src/session/passive-artifact-config.ts
export function getDefaultPassiveArtifactRoots(homeDir: string): string[] {
  return [
    ".pawtrol",
    ".codex",
    ".claude",
    "Library/Application Support/Pawtrol",
    "Library/Application Support/Codex",
    "Library/Application Support/Claude",
  ].map((entry) => `${homeDir}/${entry}`);
}
```

```ts
// src/session/passive-artifacts.ts
export async function selectPassiveArtifacts(...) {
  // choose at most one summary and one log
  // current if <= 15 minutes old, stale otherwise
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/passive-artifacts.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/passive-artifact-config.ts src/session/passive-artifacts.ts tests/passive-artifacts.test.ts
git commit -m "feat: add passive artifact discovery"
```

### Task 2: Parse Markdown, JSON, and Text Artifacts

**Files:**
- Create: `src/session/passive-artifact-parse.ts`
- Test: `tests/passive-artifact-parse.test.ts`

- [ ] **Step 1: Write failing parser tests**

```ts
import { describe, expect, it } from "vitest";
import { parsePassiveArtifact } from "../src/session/passive-artifact-parse.js";

describe("passive artifact parser", () => {
  it("extracts structured fields from a session-plan markdown snapshot", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/.pawtrol/session-plan.md",
      content: "# Pawtrol Session Plan\n\nProvider: codex\nProblem: auth.spec.ts: refresh token expires too early\nContext: 82%\nToken ETA: 7m\nRepeated failure count: 3\n",
      kind: "summary",
    });

    expect(snapshot.providerLabel).toBe("codex");
    expect(snapshot.contextPercent).toBe(82);
    expect(snapshot.tokenEtaMinutes).toBe(7);
    expect(snapshot.repeatedFailureCount).toBe(3);
  });

  it("falls back to unknown values for plain text logs without grounded metrics", () => {
    const snapshot = parsePassiveArtifact({
      path: "/repo/codex.log",
      content: "editing src/auth/token.ts\nFAIL auth.spec.ts: refresh token expires too early\n",
      kind: "log",
    });

    expect(snapshot.contextPercent).toBeNull();
    expect(snapshot.tokenEtaMinutes).toBeNull();
    expect(snapshot.repeatedFailureKey).toContain("auth.spec.ts");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/passive-artifact-parse.test.ts`  
Expected: FAIL because parser module is missing.

- [ ] **Step 3: Implement minimal parser**

```ts
// src/session/passive-artifact-parse.ts
export function parsePassiveArtifact(input: {
  path: string;
  content: string;
  kind: "summary" | "log";
}) {
  // detect JSON first, then Markdown session-plan lines, then text heuristics
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/passive-artifact-parse.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/passive-artifact-parse.ts tests/passive-artifact-parse.test.ts
git commit -m "feat: parse passive companion artifacts"
```

### Task 3: Feed Passive Snapshot Into CLI Overlay State

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/session/types.ts`
- Modify: `src/session/passive-companion.ts`
- Test: `tests/passive-companion.test.ts`

- [ ] **Step 1: Extend passive companion tests**

```ts
it("marks passive-local mode as low confidence and no-llm", () => {
  const coach = buildPassiveCompanionCoach(signals, agents, {
    snapshot: null,
    stale: false,
  });
  expect(coach.recommendation).toContain("pawtrol watch -- <command>");
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/passive-companion.test.ts`  
Expected: FAIL because passive snapshot metadata is incomplete.

- [ ] **Step 3: Implement CLI + type updates**

```ts
// src/session/types.ts
popup: {
  providerLabel?: string;
  modelLabel?: string;
  observationMode?: "watch" | "passive";
  observationSourceLabel?: string;
  updatedAtLabel?: string;
  confidenceLabel?: "high" | "medium" | "low";
  isStale?: boolean;
  observedAgents?: string[];
}
```

```ts
// src/cli.ts
const passive = await collectPassiveCompanionSnapshot(...);
const coach = buildPassiveCompanionCoach(signals, agents, passive);
overlay.broadcast(toOverlayState(coach, signals, {
  observationMode: "passive",
  observationSourceLabel: passive.sourceLabel,
  updatedAtLabel: passive.updatedAtLabel,
  confidenceLabel: passive.confidence,
  isStale: passive.isStale,
}));
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/passive-companion.test.ts tests/llm-provider.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts src/session/types.ts src/session/passive-companion.ts tests/passive-companion.test.ts
git commit -m "feat: feed passive snapshot metadata into overlay"
```

### Task 4: Replace Status Panel With Compact Two-Column Grid

**Files:**
- Modify: `src/overlay/index.html`
- Modify: `src/overlay/app.ts`
- Modify: `src/overlay/styles.css`
- Test: `tests/overlay-markup.test.ts`
- Test: `tests/overlay-presenter.test.ts`

- [ ] **Step 1: Write/update failing markup tests**

```ts
expect(overlayHtml).toContain('id="sessionMetaSource"');
expect(overlayHtml).toContain('id="sessionMetaUpdatedAt"');
expect(overlayHtml).toContain('id="sessionMetaConfidence"');
expect(overlayHtml).toContain('id="ctaActivity"');
expect(overlayHtml).toContain('id="ctaStorage"');
expect(overlayHtml).toContain('id="ctaNetwork"');
```

- [ ] **Step 2: Run failing UI tests**

Run: `npm test -- tests/overlay-markup.test.ts tests/overlay-presenter.test.ts`  
Expected: FAIL because compact stat boxes and CTA controls do not exist yet.

- [ ] **Step 3: Implement compact panel**

```html
<section class="meta-grid">
  <article class="meta-card"><span>컨텍스트</span><strong id="context">unknown</strong><p id="contextHint">근거 없음</p></article>
  <article class="meta-card"><span>토큰 예측</span><strong id="tokenEta">unknown</strong><p id="tokenHint">근거 없음</p></article>
  <article class="meta-card"><span>반복 실패</span><strong id="loop">unknown</strong><p id="loopHint">근거 없음</p></article>
  <article class="meta-card"><span>관측 소스</span><strong id="sessionMetaSource">passive detect</strong><p id="sessionMetaAgents"></p></article>
  <article class="meta-card"><span>마지막 갱신</span><strong id="sessionMetaUpdatedAt">unknown</strong><p id="sessionMetaStale"></p></article>
  <article class="meta-card"><span>정밀도</span><strong id="sessionMetaConfidence">low</strong><p id="sessionMetaMode"></p></article>
</section>
```

- [ ] **Step 4: Update renderer binding logic**

```ts
context.textContent = state.popup.contextPercent === null ? "unknown" : `${state.popup.contextPercent}%`;
sessionMetaSource.textContent = state.popup.observationSourceLabel ?? "passive-local";
sessionMetaUpdatedAt.textContent = state.popup.updatedAtLabel ?? "unknown";
sessionMetaConfidence.textContent = state.popup.confidenceLabel ?? "low";
```

- [ ] **Step 5: Run UI tests**

Run: `npm test -- tests/overlay-markup.test.ts tests/overlay-presenter.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/overlay/index.html src/overlay/app.ts src/overlay/styles.css tests/overlay-markup.test.ts tests/overlay-presenter.test.ts
git commit -m "feat: compact passive companion status panel"
```

### Task 5: Add macOS CTA Actions

**Files:**
- Create: `src/desktop/system-actions.ts`
- Modify: `src/desktop/preload.ts`
- Modify: `src/desktop/main.ts`
- Test: `tests/system-actions.test.ts`

- [ ] **Step 1: Write failing CTA routing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildSystemActionCommand } from "../src/desktop/system-actions.js";

describe("system action routing", () => {
  it("routes storage CTA to macOS settings", () => {
    expect(buildSystemActionCommand("storage")).toEqual({
      kind: "open-url",
      target: "x-apple.systempreferences:com.apple.settings.Storage",
    });
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/system-actions.test.ts`  
Expected: FAIL because system action router does not exist.

- [ ] **Step 3: Implement action bridge**

```ts
// src/desktop/preload.ts
openSystemAction: (action: string) => ipcRenderer.invoke("puppy:open-system-action", action)
```

```ts
// src/desktop/main.ts
ipcMain.handle("puppy:open-system-action", async (_event, action) => {
  // use open / osascript / openExternal based on mapped action
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/system-actions.test.ts tests/desktop.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/desktop/system-actions.ts src/desktop/preload.ts src/desktop/main.ts tests/system-actions.test.ts tests/desktop.test.ts
git commit -m "feat: add passive companion system actions"
```

### Task 6: Lock Down Packaged macOS Stability

**Files:**
- Modify: `src/desktop/window-shape-mode.ts`
- Modify: `src/desktop/main.ts`
- Test: `tests/desktop.test.ts`

- [ ] **Step 1: Add failing packaged-policy tests**

```ts
expect(shouldUseInteractiveWindowShape(true, "darwin")).toBe(false);
expect(shouldUseDynamicInteractiveBounds(true, "darwin")).toBe(false);
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/desktop.test.ts`  
Expected: FAIL if packaged policy helpers are incomplete or not used.

- [ ] **Step 3: Make packaged behavior static**

```ts
const useInteractiveWindowShape = shouldUseInteractiveWindowShape(app.isPackaged);
const useDynamicInteractiveBounds = shouldUseDynamicInteractiveBounds(app.isPackaged);

if (!useDynamicInteractiveBounds) {
  // keep stable startup size and skip repeated interactive resize path
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/desktop.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/desktop/window-shape-mode.ts src/desktop/main.ts tests/desktop.test.ts
git commit -m "fix: stabilize packaged mac companion window"
```

### Task 7: Final Verification and Release Prep

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Run full test suite**

Run: `npm test`  
Expected: PASS across all test files.

- [ ] **Step 2: Run build**

Run: `npm run build`  
Expected: successful TypeScript compile and overlay asset copy.

- [ ] **Step 3: Bump patch version**

```bash
npm version patch --no-git-tag-version
```

- [ ] **Step 4: Commit release-ready changes**

```bash
git add package.json package-lock.json
git commit -m "chore: prepare passive companion release"
```

- [ ] **Step 5: Manual packaged checks**

Run packaged build or release artifact and verify:

- passive mode says when it is not precise
- file-backed passive mode shows source / updated-at / confidence
- context/token/repeated failure show `unknown` when ungrounded
- multi-monitor drag still works
- packaged macOS no longer leaves obvious ghost trails during normal idle behavior

---

## Self-Review

- Spec coverage: artifact discovery, parser, compact UI, confidence/source/updated-at, stale/unknown rules, macOS CTAs, packaged stability, and tests are all represented.
- Placeholder scan: all tasks include explicit files, commands, and concrete code targets.
- Type consistency: overlay popup metadata uses one naming scheme (`observationSourceLabel`, `updatedAtLabel`, `confidenceLabel`, `isStale`) across CLI, types, renderer, and tests.
