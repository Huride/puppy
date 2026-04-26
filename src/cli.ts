#!/usr/bin/env node
import "./config/env.js";
import { spawnSync } from "node:child_process";
import {
  getAntigravityAuthStatus,
  getCodexAuthStatus,
  readGeminiKeyFromEnv,
  saveAntigravityApiKey,
  saveGeminiApiKey,
} from "./auth/setup.js";
import { parseCliArgs } from "./cli-options.js";
import { analyzeWithProvider, heuristicCoach } from "./coach/gemini.js";
import { getProviderDoctorRows, getRecommendedModel, resolveProvider, type LlmProvider } from "./coach/provider.js";
import { startOverlayServer } from "./server/overlay-server.js";
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
  process.stderr.write(`Puppy overlay: ${overlay.url}\n`);
  process.stderr.write(`Puppy LLM: ${provider}${options.model ? ` (${options.model})` : ""}\n`);
  if (options.sharePlan) {
    process.stderr.write("Puppy plan sharing: .puppy/session-plan.md\n");
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

async function runAuth(options: Extract<ReturnType<typeof parseCliArgs>, { mode: "auth" }>): Promise<void> {
  if (options.target === "gemini") {
    const apiKey = options.apiKey ?? readGeminiKeyFromEnv();
    if (!apiKey) {
      console.error("Gemini API key가 없어요. `puppy auth gemini --key <api-key>` 또는 GEMINI_API_KEY 환경변수로 실행해 주세요.");
      process.exitCode = 1;
      return;
    }

    const envPath = saveGeminiApiKey(apiKey);
    console.log(`Gemini API key saved to ${envPath}`);
    console.log(`Recommended model: ${getRecommendedModel("gemini")}`);
    return;
  }

  if (options.target === "antigravity") {
    const apiKey = options.apiKey ?? readGeminiKeyFromEnv();
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
}

async function printDoctor(): Promise<void> {
  console.log("Puppy provider check");
  for (const row of getProviderDoctorRows()) {
    console.log(
      `${row.provider}: ${row.configured ? "configured" : "missing"} (${row.envVar}, model: ${row.recommendedModel})`,
    );
  }
  console.log(`auto resolves to: ${resolveProvider("auto")}`);
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
    petState: coach.status === "risk" || coach.status === "intervene" ? "alert" : signals.idleSeconds > 8 ? "idle" : "walking",
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
