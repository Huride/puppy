import type { OverlayState } from "../session/types.js";

export function formatStatusBadge(state: OverlayState): string {
  return state.popup.isStale ? `${state.status.toUpperCase()} · STALE` : state.status.toUpperCase();
}

export function formatIssueDetail(state: OverlayState, detail: string): string {
  const prefix = state.popup.isDemo ? "데모 로그 기준입니다." : null;
  const staleNote =
    state.popup.observationMode === "passive" && state.popup.isStale ? "stale passive data라 최신 출력과 다를 수 있어요." : null;

  return [prefix, detail, staleNote].filter(Boolean).join(" ");
}

export function formatObservationModeLabel(state: OverlayState): string {
  if (state.popup.observationMode === "passive") {
    return state.popup.isStale ? "관측 모드: passive detect · stale passive data" : "관측 모드: passive detect";
  }

  if (state.popup.observationMode === "watch") {
    return "관측 모드: watch command";
  }

  return "관측 모드: unknown";
}

export function formatObservationSourceValue(state: OverlayState): string {
  return isResolvedPassiveSourceLabel(state.popup.observationSourceLabel) ? state.popup.observationSourceLabel : "unknown";
}

export function formatLastUpdatedValue(updatedAtLabel: string | undefined): string {
  return updatedAtLabel ?? "unknown";
}

export function formatConfidenceValue(confidenceLabel: OverlayState["popup"]["confidenceLabel"]): string {
  return confidenceLabel ?? "unknown";
}

export function observationSourceHintText(state: OverlayState): string {
  if (state.popup.observationMode === "watch") {
    return "watch mode는 실제 command 출력을 직접 읽어요.";
  }

  if (state.popup.observationMode === "passive") {
    return isResolvedPassiveSourceLabel(state.popup.observationSourceLabel)
      ? "passive detect는 발견한 artifact 기준으로만 추정해요."
      : "passive detect에서 아직 grounding artifact를 못 찾았어요.";
  }

  return "관측 소스가 아직 unknown이에요.";
}

export function lastUpdatedHintText(state: OverlayState): string {
  if (state.popup.updatedAtLabel) {
    return state.popup.isStale ? "stale passive data예요. artifact를 갱신하거나 watch mode로 전환하세요." : "현재 관측 기준 마지막 업데이트 시각이에요.";
  }

  return "업데이트 시각이 없어서 unknown으로 남겨뒀어요.";
}

export function confidenceHintText(state: OverlayState): string {
  if (!state.popup.confidenceLabel) {
    return "근거가 부족해서 confidence를 아직 unknown으로 남겨뒀어요.";
  }

  if (state.popup.observationMode === "watch") {
    return "watch mode라 실제 출력 기준 confidence예요.";
  }

  if (state.popup.isStale) {
    return "stale passive data라 confidence를 보수적으로 낮췄어요.";
  }

  return "passive detect라 artifact 근거 범위에서만 confidence를 표시해요.";
}

export function formatSessionMeta(state: OverlayState): string {
  const source =
    state.popup.observationMode === "watch"
      ? "실시간 로그"
      : isResolvedPassiveSourceLabel(state.popup.observationSourceLabel)
        ? `artifact ${state.popup.observationSourceLabel}`
        : "artifact/process 추정";
  const actualEngineLabel = state.popup.analysisEngineLabel ?? state.popup.providerLabel;
  const actualModelLabel = state.popup.analysisModelLabel ?? state.popup.modelLabel;
  const llm =
    state.popup.observationMode === "passive"
      ? `분석: ${actualEngineLabel ?? "passive-local"} / ${actualModelLabel ?? "no-llm"}`
      : `LLM: ${actualEngineLabel ?? "unknown"} / ${actualModelLabel ?? "unknown"}`;
  const fallback = state.popup.analysisFallbackLabel ? `fallback: ${state.popup.analysisFallbackLabel}` : null;
  const error = state.popup.analysisErrorLabel ? `오류: ${state.popup.analysisErrorLabel}` : null;
  const agents =
    state.popup.observedAgents && state.popup.observedAgents.length > 0
      ? `에이전트: ${state.popup.observedAgents.join(", ")}`
      : state.popup.observationMode === "passive"
        ? "에이전트: 미감지"
        : null;

  return [formatObservationModeLabel(state), `소스: ${source}`, llm, fallback, error, agents].filter(Boolean).join(" · ");
}

function isResolvedPassiveSourceLabel(label: string | undefined): label is string {
  return Boolean(label && label !== "waiting-for-agent" && label !== "passive-local");
}
