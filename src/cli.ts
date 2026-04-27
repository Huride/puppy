#!/usr/bin/env node
import "./config/env.js";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import {
  getAntigravityAuthStatus,
  getCodexAuthStatus,
  readProviderKeyFromEnv,
  saveAntigravityApiKey,
  saveClaudeApiKey,
  saveOpenAIApiKey,
  saveActiveProvider,
  saveGeminiApiKey,
} from "./auth/setup.js";
import { launchDesktopCompanion } from "./cli-desktop.js";
import { openOverlayUrl } from "./cli-open.js";
import { getConnectionChoices, needsConnectionSetup, parseConnectionChoice, type ConnectionChoiceId } from "./cli-onboarding.js";
import { parseCliArgs } from "./cli-options.js";
import { runUpgrade } from "./cli-upgrade.js";
import { analyzeWithProvider, heuristicCoach } from "./coach/gemini.js";
import { getProviderDoctorRows, getRecommendedModel, resolveProvider, type LlmProvider } from "./coach/provider.js";
import { getPackageVersion } from "./package-info.js";
import { startOverlayServer } from "./server/overlay-server.js";
import { detectRunningAgents, type RunningAgent } from "./session/agent-detect.js";
import { writePlanSnapshot } from "./session/plan-share.js";
import { sampleResources } from "./session/resources.js";
import { computeSignals } from "./session/signals.js";
import type { AgentOutputEvent, CoachResult, OverlayState, SessionSignals } from "./session/types.js";
import { watchCommand } from "./session/watcher.js";

async function main(): Promise<void> {
  let options: ReturnType<typeof parseCliArgs>;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  if (options.mode === "setup") {
    await runDesktopOrBrowserCompanion({ forceSetup: true });
    return;
  }

  if (options.mode === "companion") {
    await runDesktopOrBrowserCompanion();
    return;
  }

  if (options.mode === "version") {
    console.log(getPackageVersion());
    return;
  }

  if (options.mode === "upgrade") {
    process.exitCode = await runUpgrade({ currentVersion: getPackageVersion() });
    return;
  }

  if (options.mode === "companion-server") {
    await runCompanion({ ensureConnection: false, openBrowser: false });
    return;
  }

  if (options.mode === "doctor") {
    await printDoctor();
    return;
  }

  if (options.mode === "auth") {
    await runAuth(options);
    return;
  }

  const command = options.command;
  const events: AgentOutputEvent[] = [];
  let totalObservedChars = 0;
  let lastEventAt = Date.now();
  let analysisInFlight = false;
  const provider = resolveProvider(options.provider, process.env);
  const overlay = await startOverlayServer();
  process.stderr.write(`Pawtrol overlay: ${overlay.url}\n`);
  process.stderr.write(`Pawtrol LLM: ${provider}${options.model ? ` (${options.model})` : ""}\n`);
  if (options.sharePlan) {
    process.stderr.write("Pawtrol plan sharing: .pawtrol/session-plan.md\n");
  }

  const maybeWritePlan = async (coach: CoachResult, signals: SessionSignals): Promise<void> => {
    if (options.sharePlan) {
      await writePlanSnapshot(process.cwd(), coach, signals, provider);
    }
  };

  const broadcastHeuristicState = async (): Promise<void> => {
    const signals = computeSignals(events, sampleResources(), secondsSince(lastEventAt), totalObservedChars);
    const coach = heuristicCoach(signals);
    overlay.broadcast(toOverlayState(coach, signals));
    await maybeWritePlan(coach, signals);
  };

  const broadcastAnalyzedState = async (): Promise<void> => {
    if (analysisInFlight) {
      return;
    }

    analysisInFlight = true;
    try {
      const signals = computeSignals(events, sampleResources(), secondsSince(lastEventAt), totalObservedChars);
      const coach = await safeAnalyze(signals, options.provider, options.model);
      overlay.broadcast(toOverlayState(coach, signals));
      await maybeWritePlan(coach, signals);
    } finally {
      analysisInFlight = false;
    }
  };

  const interval = setInterval(() => {
    void broadcastAnalyzedState();
  }, 5_000);

  try {
    await broadcastHeuristicState();
    const exitCode = await watchCommand(command, {
      onEvent: (event) => {
        events.push(event);
        totalObservedChars += event.line.length;
        lastEventAt = event.timestamp;
        if (events.length > 500) {
          events.splice(0, events.length - 500);
        }

        const output = `${event.line}\n`;
        if (event.stream === "stderr") {
          process.stderr.write(output);
          return;
        }

        process.stdout.write(output);
      },
    });

    process.exitCode = exitCode;
  } finally {
    clearInterval(interval);
    const signals = computeSignals(events, sampleResources(), secondsSince(lastEventAt), totalObservedChars);
    await maybeWritePlan(heuristicCoach(signals), signals);
    await overlay.close();
  }
}

async function runDesktopOrBrowserCompanion(options: { forceSetup?: boolean } = {}): Promise<void> {
  const launched = await launchDesktopCompanion({ forceSetup: options.forceSetup });
  if (launched) {
    process.stderr.write("Pawtrol companion window opened.\n");
    return;
  }

  process.stderr.write("Pawtrol desktop window could not be opened. Falling back to browser overlay.\n");
  await runCompanion({ forceSetup: options.forceSetup, ensureConnection: true, openBrowser: true });
}

async function runCompanion(options: { forceSetup?: boolean; ensureConnection?: boolean; openBrowser?: boolean } = {}): Promise<void> {
  if (options.ensureConnection ?? true) {
    await ensureCompanionConnection(options.forceSetup ?? false);
  }

  const provider = resolveProvider("auto");
  const overlay = await startOverlayServer();
  process.stderr.write(`Pawtrol overlay: ${overlay.url}\n`);
  process.stderr.write(`Pawtrol LLM: ${provider} (${getRecommendedModel(provider)})\n`);
  process.stderr.write("Pawtrol passive watch: running coding agents are detected automatically. Press Ctrl+C to stop.\n");
  if (options.openBrowser ?? true) {
    const opened = await openOverlayUrl(overlay.url);
    if (!opened) {
      process.stderr.write(`Open ${overlay.url} in your browser to see Bori.\n`);
    }
  }

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    await overlay.close();
  };

  const broadcast = async (): Promise<void> => {
    const agents = await detectRunningAgents();
    const signals = computeSignals(agentEvents(agents), sampleResources(), agents.length > 0 ? 0 : 30, agentTextSize(agents));
    const coach =
      agents.length > 0
        ? await safeAnalyze(signals, "auto", undefined)
        : heuristicCoach({
            ...signals,
            idleSeconds: 30,
          });

    overlay.broadcast(
      toOverlayState(
        agents.length > 0
          ? coach
          : {
              ...coach,
              status: "normal",
              summary: "실행 중인 코딩 에이전트를 기다리고 있어요.",
              recommendation: "Codex, Claude, Antigravity 같은 코딩 에이전트를 시작하면 자동으로 감지할게요.",
              petMessage: "멍... 에이전트가 시작되면 알려줘요.",
            },
        signals,
      ),
    );
  };

  const interval = setInterval(() => {
    void broadcast();
  }, 15_000);

  await broadcast();
  await new Promise<void>((resolve) => {
    const stop = (): void => resolve();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  clearInterval(interval);
  await close();
}

async function ensureCompanionConnection(forceSetup: boolean): Promise<void> {
  const codex = await getCodexAuthStatus();
  const antigravity = await getAntigravityAuthStatus();
  const status = { env: process.env, codex, antigravity };

  if (!forceSetup && !needsConnectionSetup(status)) {
    if (resolveProvider("auto") === "heuristic" && codex.authenticated) {
      const envPath = saveActiveProvider("codex");
      process.stderr.write(`Active Pawtrol provider: codex (${envPath})\n`);
    }
    return;
  }

  await runConnectionOnboarding();
}

async function runConnectionOnboarding(): Promise<void> {
  if (!process.stdin.isTTY) {
    process.stderr.write("Pawtrol connection is not configured. Continuing with local heuristic because stdin is not interactive.\n");
    saveActiveProvider("heuristic");
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.stdout.write("Pawtrol needs a connection for smarter coaching.\n\nChoose one:\n");
    getConnectionChoices().forEach((choice, index) => {
      process.stdout.write(`  ${index + 1}. ${choice.label}\n`);
    });

    let selected: ConnectionChoiceId | undefined;
    while (!selected) {
      selected = parseConnectionChoice(await rl.question("\nSelect connection: "));
      if (!selected) {
        process.stdout.write("Please choose a number from 1 to 6.\n");
      }
    }

    if (selected === "heuristic") {
      const envPath = saveActiveProvider("heuristic");
      process.stdout.write(`Active Pawtrol provider: heuristic (${envPath})\n`);
      return;
    }

    if (selected === "codex") {
      await runAuth({ mode: "auth", target: "codex", apiKey: undefined, statusOnly: false });
      return;
    }

    if (selected === "antigravity") {
      const apiKey = await rl.question("Gemini API key for Antigravity/Gemini: ");
      await runAuth({ mode: "auth", target: "antigravity", apiKey, statusOnly: false });
      return;
    }

    const apiKey = await rl.question(`${selected.toUpperCase()} API key: `);
    await runAuth({ mode: "auth", target: selected, apiKey, statusOnly: false });
  } finally {
    rl.close();
  }
}

function agentEvents(agents: RunningAgent[]): AgentOutputEvent[] {
  return agents.map((agent) => ({
    type: "agent_output",
    stream: "stdout",
    line: `[pawtrol] detected ${agent.kind} process: ${agent.command}`,
    timestamp: Date.now(),
  }));
}

function agentTextSize(agents: RunningAgent[]): number {
  return agents.reduce((total, agent) => total + agent.command.length, 0);
}

async function runAuth(options: Extract<ReturnType<typeof parseCliArgs>, { mode: "auth" }>): Promise<void> {
  if (options.target === "gemini") {
    const apiKey = options.apiKey ?? readProviderKeyFromEnv("gemini");
    if (!apiKey) {
      console.error("Gemini API key가 없어요. `pawtrol login gemini --key <api-key>` 또는 GEMINI_API_KEY 환경변수로 실행해 주세요.");
      process.exitCode = 1;
      return;
    }

    const envPath = saveGeminiApiKey(apiKey);
    console.log(`Gemini API key saved to ${envPath}`);
    console.log(`Recommended model: ${getRecommendedModel("gemini")}`);
    return;
  }

  if (options.target === "openai") {
    const apiKey = options.apiKey ?? readProviderKeyFromEnv("openai");
    if (!apiKey) {
      console.error("OpenAI API key가 없어요. `pawtrol login openai --key <api-key>` 또는 OPENAI_API_KEY 환경변수로 실행해 주세요.");
      process.exitCode = 1;
      return;
    }

    const envPath = saveOpenAIApiKey(apiKey);
    console.log(`OpenAI API key saved to ${envPath}`);
    console.log(`Recommended model: ${getRecommendedModel("openai")}`);
    return;
  }

  if (options.target === "claude") {
    const apiKey = options.apiKey ?? readProviderKeyFromEnv("claude");
    if (!apiKey) {
      console.error("Claude API key가 없어요. `pawtrol login claude --key <api-key>` 또는 ANTHROPIC_API_KEY 환경변수로 실행해 주세요.");
      process.exitCode = 1;
      return;
    }

    const envPath = saveClaudeApiKey(apiKey);
    console.log(`Claude API key saved to ${envPath}`);
    console.log(`Recommended model: ${getRecommendedModel("claude")}`);
    return;
  }

  if (options.target === "antigravity") {
    const apiKey = options.apiKey ?? readProviderKeyFromEnv("gemini");
    if (apiKey && !options.statusOnly) {
      const envPath = saveAntigravityApiKey(apiKey);
      console.log(`Antigravity/Gemini API key saved to ${envPath}`);
      console.log(`Recommended model: ${getRecommendedModel("gemini")}`);
    }

    const status = await getAntigravityAuthStatus();
    console.log(`Antigravity/Gemini command: ${status.installedCommand ?? "missing"}`);
    console.log(`Antigravity/Gemini API key: ${status.apiKeyConfigured ? "configured" : "missing"}`);
    console.log(`Antigravity/Gemini auth: ${status.authenticated ? "ready" : "missing"}`);
    console.log(status.detail);

    if (!status.authenticated) {
      process.exitCode = 1;
    }
    return;
  }

  const status = await getCodexAuthStatus();
  if (options.statusOnly || status.authenticated || !status.installed) {
    console.log(`Codex CLI: ${status.installed ? "installed" : "missing"}`);
    console.log(`Codex auth: ${status.authenticated ? "authenticated" : "missing"}`);
    console.log(status.detail);
    if (status.authenticated && !options.statusOnly) {
      const envPath = saveActiveProvider("codex");
      console.log(`Active Pawtrol provider: codex (${envPath})`);
    }
    return;
  }

  console.log("Codex CLI login을 시작합니다. 브라우저 또는 터미널 안내에 따라 인증해 주세요.");
  const result = spawnSync("codex", ["login"], { stdio: "inherit" });
  if (result.error) {
    console.error(`Codex login 실행 실패: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = typeof result.status === "number" ? result.status : 1;
  if (process.exitCode === 0) {
    const envPath = saveActiveProvider("codex");
    console.log(`Active Pawtrol provider: codex (${envPath})`);
  }
}

async function printDoctor(): Promise<void> {
  console.log("Pawtrol provider check");
  for (const row of getProviderDoctorRows()) {
    console.log(
      `${row.provider}: ${row.configured ? "configured" : "missing"} (${row.envVar}, model: ${row.recommendedModel})`,
    );
  }
  console.log(`auto resolves to: ${resolveProvider("auto")}`);
  console.log(`active login provider: ${process.env.PAWTROL_PROVIDER || "auto"}`);
  console.log(`recommended model: ${getRecommendedModel(resolveProvider("auto"))}`);

  const codex = await getCodexAuthStatus();
  console.log(`codex cli: ${codex.installed ? "installed" : "missing"}`);
  console.log(`codex auth: ${codex.authenticated ? "authenticated" : "missing"}`);

  const antigravity = await getAntigravityAuthStatus();
  console.log(`antigravity/gemini cli: ${antigravity.installedCommand ?? "missing"}`);
  console.log(`antigravity/gemini auth: ${antigravity.authenticated ? "ready" : "missing"}`);
}

async function safeAnalyze(signals: SessionSignals, provider: LlmProvider, model: string | undefined): Promise<CoachResult> {
  try {
    return await analyzeWithProvider(signals, { provider, model });
  } catch {
    return heuristicCoach(signals);
  }
}

function toOverlayState(coach: CoachResult, signals: SessionSignals): OverlayState {
  return {
    status: coach.status,
    petState:
      coach.status === "risk" || coach.status === "intervene"
        ? "alert"
        : coach.status === "watch"
          ? "watching"
          : signals.idleSeconds > 8
            ? "sitting"
            : "walking",
    message: coach.petMessage,
    popup: {
      title: "Bori's Checkup",
      contextPercent: signals.contextPercent,
      tokenEtaMinutes: signals.tokenEtaMinutes,
      repeatedFailureCount: signals.repeatedFailureCount,
      repeatedFailureKey: signals.repeatedFailureKey,
      cpuPercent: signals.resourceUsage.cpuPercent,
      memoryPercent: signals.resourceUsage.memoryPercent,
      summary: coach.summary,
      recommendation: coach.recommendation,
      isDemo: process.env.PAWTROL_DEMO === "1",
    },
  };
}

function secondsSince(timestamp: number): number {
  return Math.round((Date.now() - timestamp) / 1_000);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
