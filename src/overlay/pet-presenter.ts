import type { OverlayState, SessionStatus } from "../session/types.js";

export const petBubbleLines: Record<Exclude<SessionStatus, "normal"> | "happy" | "affection", string[]> = {
  watch: [
    "슬슬 한 번만 봐주면 좋겠어요.",
    "진행은 되는데 냄새가 조금 이상해요.",
    "컨텍스트가 꽤 찼어요. 정리 타이밍일지도요.",
    "테스트 흐름을 한 번 확인해볼까요?",
    "아직 괜찮지만 집중해서 볼 구간이에요.",
    "여기서 한 번 방향 체크하면 좋아요.",
    "작업은 가고 있어요. 다만 살짝 주의!",
    "로그가 길어지고 있어요. 다음 액션만 확인해봐요.",
    "지금은 큰 문제 전 단계예요. 방향만 살짝 점검해요.",
    "보리가 보기엔 한 번 숨 고르면 좋아요.",
  ],
  risk: [
    "멍! 컨텍스트가 꽉 차가요.",
    "멍멍! 같은 실패가 반복되고 있어요.",
    "잠깐만요. 토큰 여유가 많이 줄었어요.",
    "이쯤에서 요약하고 새 흐름으로 가는 게 좋아요.",
    "테스트가 같은 곳에서 맴돌고 있어요.",
    "지금은 제가 짖어야 할 타이밍이에요.",
    "컨텍스트 압력이 높아요. 정리 먼저 해요.",
    "이대로 더 돌리기 전에 실패 원인을 좁혀봐요.",
    "지금 로그는 새 판단보다 정리가 더 필요해 보여요.",
    "반복 신호가 보여요. 작은 범위로 줄이면 좋아요.",
  ],
  intervene: [
    "멍멍멍! 지금은 직접 봐주세요.",
    "멈춰서 방향을 다시 잡는 게 좋아요.",
    "토큰이나 루프 상태가 위험해요.",
    "지금 계속 맡기면 삽질이 길어질 수 있어요.",
    "제가 보기엔 사람 손길이 필요해요.",
    "여기서 커맨드를 끊고 상태를 확인해요.",
    "큰 결정을 하기 전에 체크가 필요해요.",
    "계속 맡기면 같은 곳을 더 돌 가능성이 높아요.",
    "지금은 자동 진행보다 원인 확인이 먼저예요.",
    "세션을 멈추고 실패 로그부터 정리해요.",
  ],
  happy: [
    "좋아요. 잠깐 쓰다듬 받고 다시 볼게요.",
    "꼬리 흔드는 중이에요. 세션은 계속 지켜보고 있어요.",
    "히히. 지금 흐름은 제가 옆에서 보고 있을게요.",
    "좋아요, 손길 확인. 위험 신호 생기면 바로 알려드릴게요.",
    "기분 좋아졌어요. 다시 터미널 상태를 볼게요.",
    "잠깐 쉬었다가 다음 신호를 체크할게요.",
  ],
  affection: [
    "멍! 좋아요. 손길 확인했어요.",
    "꼬리 붕붕 흔드는 중이에요.",
    "멍멍. 기분 좋아졌어요.",
    "히히, 쓰다듬 받으면서도 상태는 보고 있어요.",
    "좋아요. 위험 신호가 오면 바로 짖을게요.",
    "멍! 잠깐 충전하고 다시 옆에서 볼게요.",
  ],
};

export function getPetBubbleLine(state: OverlayState, turn = 0): string | null {
  if (state.status === "normal") {
    return null;
  }

  const lines = petBubbleLines[state.status];
  return lines[(buildSessionSeed(state) + turn) % lines.length];
}

export function getHappyBubbleLine(index: number): string {
  const lines = petBubbleLines.happy;
  return lines[index % lines.length];
}

export function getAffectionBubbleLine(index: number): string {
  const lines = petBubbleLines.affection;
  return lines[index % lines.length];
}

export function describeIssueFocus(state: OverlayState): { title: string; detail: string } {
  const failureKey = state.popup.repeatedFailureKey;
  if (failureKey && state.popup.repeatedFailureCount > 1) {
    const [task, reason] = splitFailureKey(failureKey);
    return {
      title: `문제 작업: ${task}`,
      detail: `${reason} 실패가 ${state.popup.repeatedFailureCount}번 반복됐어요. 이 작업은 잠깐 멈추고 원인부터 보는 게 좋아요.`,
    };
  }

  if (state.popup.contextPercent >= 70) {
    return {
      title: "주의 지점: 컨텍스트",
      detail: `컨텍스트 창이 ${Math.round(state.popup.contextPercent)}%까지 찼어요. 긴 작업이면 요약 후 이어가는 편이 좋아요.`,
    };
  }

  if (state.popup.tokenEtaMinutes !== null && state.popup.tokenEtaMinutes <= 10) {
    return {
      title: "주의 지점: 토큰",
      detail: `현재 흐름이면 약 ${Math.round(state.popup.tokenEtaMinutes)}분 안에 여유가 줄어들 수 있어요.`,
    };
  }

  if (state.popup.cpuPercent >= 80 || state.popup.memoryPercent >= 80) {
    return {
      title: "주의 지점: 시스템 부하",
      detail: `CPU ${Math.round(state.popup.cpuPercent)}%, 메모리 ${Math.round(state.popup.memoryPercent)}% 상태예요. 무거운 작업이 겹쳤는지 확인해요.`,
    };
  }

  return {
    title: "현재 작업: 안정적",
    detail: "반복 실패나 큰 리소스 압박은 아직 보이지 않아요.",
  };
}

export function getMetricFillPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function shouldEnterKennel(startX: number | null, endX: number): boolean {
  return startX !== null && endX - startX >= 58;
}

export function shouldTriggerPetting(startX: number | null, endX: number): boolean {
  return startX !== null && Math.abs(endX - startX) >= 10 && !shouldEnterKennel(startX, endX);
}

function buildSessionSeed(state: OverlayState): number {
  return (
    Math.round(state.popup.contextPercent) +
    Math.round(state.popup.cpuPercent / 2) +
    Math.round(state.popup.memoryPercent / 3) +
    state.popup.repeatedFailureCount * 7 +
    (state.popup.tokenEtaMinutes ?? 0)
  );
}

function splitFailureKey(failureKey: string): [string, string] {
  const [rawTask, ...rawReason] = failureKey.split(":");
  const task = rawTask.trim() || "알 수 없는 작업";
  const reason = rawReason.join(":").trim() || "같은 오류";
  return [task, reason];
}
