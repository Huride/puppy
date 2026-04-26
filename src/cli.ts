#!/usr/bin/env node
import "./config/env.js";
import { parseCliArgs } from "./cli-options.js";
import { analyzeWithProvider, heuristicCoach } from "./coach/gemini.js";
import { getProviderDoctorRows, resolveProvider, type LlmProvider } from "./coach/provider.js";
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
    printDoctor();
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

function printDoctor(): void {
  console.log("Puppy provider check");
  for (const row of getProviderDoctorRows()) {
    console.log(`${row.provider}: ${row.configured ? "configured" : "missing"} (${row.envVar})`);
  }
  console.log(`auto resolves to: ${resolveProvider("auto")}`);
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
