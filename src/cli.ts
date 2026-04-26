import "./config/env.js";
import { analyzeWithGemini, heuristicCoach } from "./coach/gemini.js";
import { startOverlayServer } from "./server/overlay-server.js";
import { sampleResources } from "./session/resources.js";
import { computeSignals } from "./session/signals.js";
import type { AgentOutputEvent, CoachResult, OverlayState, SessionSignals } from "./session/types.js";
import { watchCommand } from "./session/watcher.js";

async function main(): Promise<void> {
  const [subcommand, separatorOrFirst, ...rest] = process.argv.slice(2);

  if (subcommand !== "watch") {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const command = separatorOrFirst === "--" ? rest : [separatorOrFirst, ...rest].filter(Boolean);
  const events: AgentOutputEvent[] = [];
  let lastEventAt = Date.now();
  let analysisInFlight = false;
  const overlay = await startOverlayServer();
  process.stderr.write(`Puppy overlay: ${overlay.url}\n`);

  const broadcastHeuristicState = (): void => {
    const signals = computeSignals(events, sampleResources(), secondsSince(lastEventAt));
    const coach = heuristicCoach(signals);
    overlay.broadcast(toOverlayState(coach, signals));
  };

  const broadcastAnalyzedState = async (): Promise<void> => {
    if (analysisInFlight) {
      return;
    }

    analysisInFlight = true;
    try {
      const signals = computeSignals(events, sampleResources(), secondsSince(lastEventAt));
      const coach = await safeAnalyze(signals);
      overlay.broadcast(toOverlayState(coach, signals));
    } finally {
      analysisInFlight = false;
    }
  };

  const interval = setInterval(() => {
    void broadcastAnalyzedState();
  }, 5_000);

  try {
    broadcastHeuristicState();
    const exitCode = await watchCommand(command, {
      onEvent: (event) => {
        events.push(event);
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
    await overlay.close();
  }
}

function printUsage(): void {
  console.log("Usage: puppy watch -- <command>");
}

async function safeAnalyze(signals: SessionSignals): Promise<CoachResult> {
  try {
    return await analyzeWithGemini(signals);
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
