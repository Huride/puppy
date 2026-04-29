import path from "node:path";
import type { RunningAgent } from "./agent-detect.js";
import { buildAvailableSystemActions } from "../desktop/system-actions.js";
import type { PassiveArtifactSnapshot } from "./passive-artifact-parse.js";
import type { PassiveArtifactCandidate } from "./passive-artifacts.js";
import type { CoachResult, PopupSystemActionId, SessionSignals } from "./types.js";

export type PassiveArtifactObservation = {
  artifact: PassiveArtifactCandidate;
  snapshot: PassiveArtifactSnapshot;
};

export type PassiveCompanionArtifacts = {
  summary?: PassiveArtifactObservation | null;
  log?: PassiveArtifactObservation | null;
  staleSummary?: PassiveArtifactObservation | null;
  staleLog?: PassiveArtifactObservation | null;
};

export type PassiveCompanionOverlayState = {
  providerLabel?: string;
  modelLabel?: string;
  observationMode: "passive";
  observedAgents: string[];
  observationSourceLabel?: string;
  updatedAtLabel?: string;
  confidenceLabel: "low" | "medium";
  isStale: boolean;
  contextPercent?: number | null;
  tokenEtaMinutes?: number | null;
  repeatedFailureCount?: number | null;
  repeatedFailureKey?: string | null;
  availableSystemActions?: PopupSystemActionId[];
};

export type PassiveCompanionEvaluation = {
  coach: CoachResult;
  overlay: PassiveCompanionOverlayState;
};

export function buildPassiveCompanionCoach(
  signals: SessionSignals,
  agents: RunningAgent[],
  artifacts?: PassiveCompanionArtifacts,
): CoachResult {
  return evaluatePassiveCompanion(signals, agents, artifacts).coach;
}

export function evaluatePassiveCompanion(
  signals: SessionSignals,
  agents: RunningAgent[],
  artifacts: PassiveCompanionArtifacts = {},
): PassiveCompanionEvaluation {
  const observedAgents = Array.from(new Set(agents.map((agent) => agent.kind)));
  const agentSummary = observedAgents.length > 0 ? observedAgents.join(", ") : "none";
  const cpu = Math.round(signals.resourceUsage.cpuPercent);
  const memory = Math.round(signals.resourceUsage.memoryPercent);
  const resourcePressure = cpu >= 85 || memory >= 85;
  const primary = pickPrimaryObservation(artifacts);
  const isStale = primary ? isObservationStale(primary) : false;
  const confidenceLabel = primary ? deriveConfidence(primary, artifacts, isStale) : "low";
  const observationSourceLabel = primary ? formatObservationSourceLabel(primary, artifacts) : "passive-local";
  const updatedAtLabel = primary ? primary.snapshot.updatedAt ?? primary.artifact.updatedAt : undefined;
  const groundedTarget = primary ? pickGroundedTarget(primary.snapshot) : null;

  if (!primary) {
    const coach = resourcePressure
      ? {
          status: "risk" as const,
          summary: `${agentSummary} 프로세스는 감지했지만 passive detect / passive-local 모드라 실제 실패 로그는 아직 못 읽고 있어요.`,
          risk: `시스템 부하가 높아요. CPU ${cpu}%, 메모리 ${memory}% 상태입니다.`,
          recommendation: "지금은 메모리를 많이 쓰는 작업과 최근에 열어 둔 파일부터 줄이고, 무거운 테스트나 빌드가 겹쳤는지 먼저 확인하세요.",
          petMessage: "멍! 지금은 프로세스와 리소스만 보고 있어요.",
          evidence: [`감지된 에이전트 ${agentSummary}`, `CPU ${cpu}%`, `메모리 ${memory}%`, "passive detect 모드", "passive-local", "artifact 없음"],
          nextAction: "활성 상태 보기에서 메모리와 CPU를 많이 쓰는 프로세스를 먼저 정리하고, 방금 수정한 파일이나 실패가 난 테스트 근처를 확인하세요.",
        }
      : {
          status: "watch" as const,
          summary: `${agentSummary} 프로세스를 감지했어요. 다만 passive detect / passive-local 모드라 실제 코드 변경이나 최근 summary/log artifact는 아직 읽지 못해요.`,
          risk: "현재 상태창은 프로세스 존재와 시스템 리소스 위주로만 판단하고 있어요.",
          recommendation: "최근에 건드린 파일이나 마지막으로 실패한 테스트 이름이 있는지 먼저 확인하고, 같은 실패가 반복되는 지점부터 좁혀 보세요.",
          petMessage: "멍! 지금은 멀리서 지켜보는 중이에요.",
          evidence: [`감지된 에이전트 ${agentSummary}`, `CPU ${cpu}%`, `메모리 ${memory}%`, "passive detect 모드", "passive-local", "artifact 없음"],
          nextAction: "현재 열려 있는 작업 파일과 최근 실패 이름을 기준으로 먼저 범위를 좁히세요.",
        };

    return {
      coach,
      overlay: {
        observationMode: "passive",
        observedAgents,
        observationSourceLabel,
        updatedAtLabel,
        confidenceLabel,
        isStale,
        providerLabel: "passive-local",
        modelLabel: "no-llm",
        availableSystemActions: passiveSystemActions(false),
      },
    };
  }

  const sourceKindLabel = primary.artifact.kindHint === "summary" ? "summary artifact" : "log artifact";
  const summaryParts = [`${agentSummary} 프로세스를 감지했고 ${sourceKindLabel}를 통해 passive detect 중이에요.`];
  if (primary.snapshot.taskHint) {
    summaryParts.push(`작업 힌트: ${primary.snapshot.taskHint}.`);
  }
  if (primary.snapshot.problemHint) {
    summaryParts.push(`기록된 문제: ${primary.snapshot.problemHint}.`);
  }

  let risk = "artifact 기반 passive 모드라 현재 stdout/stderr 전체를 읽는 건 아니에요.";
  if (isStale) {
    risk = "지금 보고 있는 artifact가 오래돼서 현재 세션 상태와 다를 수 있어요.";
  } else if (resourcePressure) {
    risk = `시스템 부하가 높아요. CPU ${cpu}%, 메모리 ${memory}% 상태입니다.`;
  } else if ((primary.snapshot.repeatedFailureCount ?? 0) >= 2 && primary.snapshot.repeatedFailureKey) {
    risk = `artifact 기준으로 같은 실패가 반복된 흔적이 있어요: ${primary.snapshot.repeatedFailureKey} (${primary.snapshot.repeatedFailureCount}회).`;
  }

  let recommendation = "지금 잡힌 문제 흔적과 가장 가까운 파일이나 테스트부터 확인하세요.";
  if (isStale) {
    recommendation = "최근 artifact가 조금 지난 상태라, 마지막으로 바뀐 파일과 실패 기록이 아직 같은지 먼저 다시 확인하세요.";
  } else if (groundedTarget) {
    recommendation = `${groundedTarget} 근처 변경과 실패 기록부터 확인하고, 같은 원인이 반복되는지 먼저 좁혀 보세요.`;
  }

  const coach: CoachResult = {
    status: resourcePressure ? "risk" : "watch",
    summary: summaryParts.join(" "),
    risk,
    recommendation,
    petMessage: isStale ? "멍... 기록은 봤는데 조금 지난 흔적이에요." : "멍! 요약이나 로그 흔적을 같이 보고 있어요.",
    evidence: buildEvidence(agentSummary, cpu, memory, primary, confidenceLabel, updatedAtLabel),
    nextAction: groundedTarget
      ? `${groundedTarget} 기준으로 먼저 확인하고, 관련 파일이나 테스트 범위를 바로 줄이세요.`
      : "최근에 건드린 파일과 마지막 실패 기록을 기준으로 먼저 범위를 줄이세요.",
  };

  return {
    coach,
    overlay: {
      providerLabel: primary.snapshot.providerLabel ?? undefined,
      modelLabel: "no-llm",
      observationMode: "passive",
      observedAgents,
      observationSourceLabel,
      updatedAtLabel,
      confidenceLabel,
      isStale,
      contextPercent: primary.snapshot.contextPercent ?? null,
      tokenEtaMinutes: primary.snapshot.tokenEtaMinutes ?? null,
      repeatedFailureCount: primary.snapshot.repeatedFailureCount ?? null,
      repeatedFailureKey: primary.snapshot.repeatedFailureKey ?? null,
      availableSystemActions: passiveSystemActions(true),
    },
  };
}

function passiveSystemActions(hasArtifact: boolean): PopupSystemActionId[] {
  return buildAvailableSystemActions({
    platform: process.platform,
    artifactPath: hasArtifact ? "/trusted/passive-artifact" : null,
  });
}

function pickPrimaryObservation(artifacts: PassiveCompanionArtifacts): PassiveArtifactObservation | null {
  const currentCandidates = [artifacts.summary, artifacts.log].filter(
    (candidate): candidate is PassiveArtifactObservation => Boolean(candidate?.artifact.isCurrent),
  );

  if (currentCandidates.length > 0) {
    return currentCandidates.sort(compareObservationFreshness)[0] ?? null;
  }

  const staleCandidates = [artifacts.staleSummary, artifacts.staleLog].filter(
    (candidate): candidate is PassiveArtifactObservation => Boolean(candidate),
  );

  if (staleCandidates.length === 0) {
    return null;
  }

  return staleCandidates.sort(compareObservationFreshness)[0] ?? null;
}

function isObservationStale(observation: PassiveArtifactObservation): boolean {
  return observation.snapshot.stale ?? !observation.artifact.isCurrent;
}

function deriveConfidence(
  observation: PassiveArtifactObservation,
  artifacts: PassiveCompanionArtifacts,
  isStale: boolean,
): PassiveCompanionOverlayState["confidenceLabel"] {
  if (isStale) {
    return "low";
  }

  const hasSupportingCurrentLog = Boolean(artifacts.log?.artifact.isCurrent);
  return observation.artifact.kindHint === "summary" && hasSupportingCurrentLog && observation.snapshot.confidenceHint === "medium"
    ? "medium"
    : "low";
}

function formatObservationSourceLabel(
  primary: PassiveArtifactObservation,
  artifacts: PassiveCompanionArtifacts,
): string {
  const primaryLabel = `${primary.artifact.kindHint}:${path.basename(primary.artifact.path)}`;
  if (primary.artifact.kindHint === "summary" && artifacts.log?.artifact.isCurrent) {
    return `${primaryLabel} + log:${path.basename(artifacts.log.artifact.path)}`;
  }
  return primaryLabel;
}

function pickGroundedTarget(snapshot: PassiveArtifactSnapshot): string | null {
  return snapshot.recentTestHints[0] ?? snapshot.recentFileHints[0] ?? snapshot.repeatedFailureKey ?? snapshot.problemHint ?? null;
}

function buildEvidence(
  agentSummary: string,
  cpu: number,
  memory: number,
  primary: PassiveArtifactObservation,
  confidenceLabel: PassiveCompanionOverlayState["confidenceLabel"],
  updatedAtLabel: string | undefined,
): string[] {
  const evidence = [
    `감지된 에이전트 ${agentSummary}`,
    `CPU ${cpu}%`,
    `메모리 ${memory}%`,
    "passive detect 모드",
    `${primary.artifact.kindHint} artifact ${path.basename(primary.artifact.path)}`,
    `confidence ${confidenceLabel}`,
  ];

  if (updatedAtLabel) {
    evidence.push(`updated ${updatedAtLabel}`);
  }
  if (primary.snapshot.repeatedFailureKey) {
    evidence.push(`실패 ${primary.snapshot.repeatedFailureKey}`);
  }
  if (primary.snapshot.repeatedFailureCount !== null) {
    evidence.push(`반복 실패 ${primary.snapshot.repeatedFailureCount}회`);
  }

  return evidence;
}

function compareObservationFreshness(left: PassiveArtifactObservation, right: PassiveArtifactObservation): number {
  if (right.artifact.mtimeMs !== left.artifact.mtimeMs) {
    return right.artifact.mtimeMs - left.artifact.mtimeMs;
  }

  if (left.artifact.kindHint !== right.artifact.kindHint) {
    return left.artifact.kindHint === "summary" ? -1 : 1;
  }

  return left.artifact.path.localeCompare(right.artifact.path);
}
