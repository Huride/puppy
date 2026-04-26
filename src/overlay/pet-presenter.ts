import type { OverlayState, SessionStatus } from "../session/types.js";

export const petBubbleLines: Record<Exclude<SessionStatus, "normal"> | "happy", string[]> = {
  watch: [
    "슬슬 한 번만 봐주면 좋겠어요.",
    "진행은 되는데 냄새가 조금 이상해요.",
    "컨텍스트가 꽤 찼어요. 정리 타이밍일지도요.",
    "테스트 흐름을 한 번 확인해볼까요?",
    "아직 괜찮지만 집중해서 볼 구간이에요.",
    "여기서 한 번 방향 체크하면 좋아요.",
    "작업은 가고 있어요. 다만 살짝 주의!",
  ],
  risk: [
    "멍! 컨텍스트가 꽉 차가요.",
    "멍멍! 같은 실패가 반복되고 있어요.",
    "잠깐만요. 토큰 여유가 많이 줄었어요.",
    "이쯤에서 요약하고 새 흐름으로 가는 게 좋아요.",
    "테스트가 같은 곳에서 맴돌고 있어요.",
    "지금은 제가 짖어야 할 타이밍이에요.",
    "컨텍스트 압력이 높아요. 정리 먼저 해요.",
  ],
  intervene: [
    "멍멍멍! 지금은 직접 봐주세요.",
    "멈춰서 방향을 다시 잡는 게 좋아요.",
    "토큰이나 루프 상태가 위험해요.",
    "지금 계속 맡기면 삽질이 길어질 수 있어요.",
    "제가 보기엔 사람 손길이 필요해요.",
    "여기서 커맨드를 끊고 상태를 확인해요.",
    "큰 결정을 하기 전에 체크가 필요해요.",
  ],
  happy: [
    "고롱고롱...",
    "좋아요. 꼬리 흔드는 중!",
    "쓰다듬 감사합니다.",
    "히히, 계속 지켜볼게요.",
    "기분 좋아졌어요.",
    "작업실 경비견 모드 유지 중.",
  ],
};

export function getPetBubbleLine(state: OverlayState): string | null {
  if (state.status === "normal") {
    return null;
  }

  const lines = petBubbleLines[state.status];
  return lines[buildSessionSeed(state) % lines.length];
}

export function getHappyBubbleLine(index: number): string {
  const lines = petBubbleLines.happy;
  return lines[index % lines.length];
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
