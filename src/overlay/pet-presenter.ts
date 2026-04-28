import type { OverlayState, PetBehaviorState, SessionStatus } from "../session/types.js";

type InteractionBubbleKind = "hover" | "petting" | "kennelEnter" | "kennelExit";
type PointerPoint = { x: number; y: number };
type PointerRect = { left: number; top: number; width: number; height: number };
export type CompanionName = "보리" | "나비" | "모찌";
export type PetPointerGesture = "kennel" | "petting" | "move" | "none";
export type PetPointerZone = "body" | "move";

const moveGestureThreshold = 16;
const pettingGestureThreshold = 12;

export const behaviorBubbleLines: Record<
  Extract<PetBehaviorState, "walking" | "sitting" | "lying" | "sniffing" | "stretching" | "watching" | "sleepy" | "kennel">,
  string[]
> = {
  walking: [
    "총총. 옆에서 같이 걸어볼게요.",
    "꼬리 살랑, 흐름 따라가는 중이에요.",
    "앞발 톡톡. 지금은 조용히 순찰해요.",
    "멍. 한 바퀴만 돌고 올게요.",
  ],
  sitting: [
    "얌전히 앉아서 보고 있어요.",
    "앞발 모으고 대기 중이에요.",
    "꼬리만 살짝 흔들게요.",
    "멍. 여기 앉아 있을게요.",
  ],
  lying: [
    "잠깐 납작 엎드려 있을게요.",
    "배 깔고 쉬면서도 보고 있어요.",
    "낮잠 자세지만 귀는 열려 있어요.",
    "꼬리만 살짝, 조용히 대기해요.",
  ],
  sniffing: [
    "킁킁. 로그 냄새 맡는 중이에요.",
    "킁, 이상한 냄새는 아직 약해요.",
    "코를 바닥에 붙이고 살펴볼게요.",
    "킁킁. 단서가 있나 볼게요.",
  ],
  stretching: [
    "앞발 쭉. 잠깐 기지개 켜요.",
    "몸 쭉 펴고 다시 볼게요.",
    "꼬리 털고 집중 준비해요.",
    "멍. 기지개 끝나면 다시 순찰해요.",
  ],
  watching: [
    "귀 쫑긋. 지금 흐름 보고 있어요.",
    "눈 동그랗게 뜨고 지켜볼게요.",
    "꼬리 멈춤. 살짝 집중 중이에요.",
    "멍. 이 구간은 같이 볼게요.",
  ],
  sleepy: [
    "꾸벅... 그래도 보고 있어요.",
    "눈은 반쯤 감아도 귀는 열려요.",
    "잠깐 졸지만 신호 오면 깰게요.",
    "꼬리 느리게 살랑. 조용한 상태예요.",
  ],
  kennel: [
    "집 안에서 조용히 기다릴게요.",
    "멍. 필요하면 집 문 톡톡 해주세요.",
    "작은 집에 쏙 들어가 있을게요.",
    "집에서 귀만 쫑긋 세울게요.",
  ],
};

export const demoBehaviorBubbleLines: typeof behaviorBubbleLines = {
  walking: [
    "데모 산책 중이에요. 총총.",
    "데모 흐름 따라 걸어볼게요.",
    "데모라서 가볍게 순찰해요.",
    "데모 화면 한 바퀴 돌아요.",
  ],
  sitting: [
    "데모 상태예요. 얌전히 앉아볼게요.",
    "데모 로그 옆에 앉아 있어요.",
    "데모 중이라 조용히 대기해요.",
    "데모 화면에서 앞발 모으고 있어요.",
  ],
  lying: [
    "데모 상태예요. 잠깐 누워볼게요.",
    "데모 로그 보며 엎드려 있어요.",
    "데모라서 낮잠 자세만 보여줘요.",
    "데모 중에도 귀는 열려 있어요.",
  ],
  sniffing: [
    "데모 로그를 킁킁 맡는 중이에요.",
    "데모 단서를 킁 하고 찾아요.",
    "데모라서 냄새만 살짝 볼게요.",
    "데모 화면 아래를 킁킁.",
  ],
  stretching: [
    "데모 중 기지개 쭉.",
    "데모라서 앞발만 쭉 펴요.",
    "데모 흐름 전에 몸을 풀어요.",
    "데모 화면에서 꼬리 털고 있어요.",
  ],
  watching: [
    "데모 상태예요. 귀 쫑긋.",
    "데모 로그를 조용히 보고 있어요.",
    "데모 중이라 눈만 동그랗게 떠요.",
    "데모 흐름을 지켜보는 중이에요.",
  ],
  sleepy: [
    "데모라서 살짝 꾸벅해요.",
    "데모 중 잠깐 졸린 척해요.",
    "데모 화면에서 느리게 꼬리 살랑.",
    "데모 상태예요. 조용히 쉬어요.",
  ],
  kennel: [
    "데모 집 안에서 기다릴게요.",
    "데모 상태라 집에 쏙 들어가요.",
    "데모 집 문 뒤에서 귀 쫑긋.",
    "데모라서 작은 집에 머물게요.",
  ],
};

export const interactionBubbleLines: Record<InteractionBubbleKind, string[]> = {
  hover: [
    "멍? 불렀어요?",
    "꼬리 살랑. 여기 있어요.",
    "귀 쫑긋! 손 가까워졌어요.",
    "멍. 잠깐 눈 맞출게요.",
  ],
  petting: [
    "멍! 쓰다듬 좋아요.",
    "손길 확인, 꼬리 붕붕!",
    "히히. 앞발 꾹 누르고 있을게요.",
    "멍멍. 기분 좋아졌어요.",
  ],
  kennelEnter: [
    "집으로 총총 들어갈게요.",
    "멍. 작은 집에 쏙 들어가요.",
    "필요하면 불러주세요. 집에 있을게요.",
    "꼬리 살랑이며 집으로 가요.",
  ],
  kennelExit: [
    "멍! 다시 나왔어요.",
    "집에서 나왔어요. 옆에 있을게요.",
    "꼬리 털고 복귀했어요.",
    "불러서 나왔어요. 다시 볼게요.",
  ],
};

const demoInteractionBubbleLines: Record<InteractionBubbleKind, string[]> = {
  hover: [
    "데모 중이에요. 멍?",
    "데모 화면에서 꼬리 살랑.",
    "데모 상태지만 손은 반가워요.",
    "데모 {name}, 귀 쫑긋.",
  ],
  petting: [
    "데모 쓰다듬 확인. 멍!",
    "데모 중에도 꼬리 붕붕.",
    "데모 손길이라도 좋아요.",
    "데모 {name} 기분 좋아졌어요.",
  ],
  kennelEnter: [
    "데모 집으로 총총 들어가요.",
    "데모 상태라 집에 쏙.",
    "데모 집 안에서 기다릴게요.",
    "데모 {name}, 집으로 이동해요.",
  ],
  kennelExit: [
    "데모 집에서 다시 나왔어요.",
    "데모 {name} 복귀했어요.",
    "데모 상태로 다시 옆에 있어요.",
    "데모 집 문 열고 나왔어요.",
  ],
};

export const petBubbleLines: Record<Exclude<SessionStatus, "normal"> | "idle" | "demoIdle" | "happy" | "affection", string[]> = {
  idle: behaviorBubbleLines.sitting,
  demoIdle: demoBehaviorBubbleLines.sitting,
  watch: [
    "킁. 이 구간은 한 번만 같이 봐요.",
    "귀 쫑긋. 테스트 흐름이 살짝 길어요.",
    "꼬리 멈춤. 컨텍스트 정리 타이밍일 수 있어요.",
    "멍. 다음 액션 하나만 좁혀봐요.",
    "아직 괜찮지만 같은 냄새가 나요.",
    "킁킁. 실패 로그 주변만 살펴봐요.",
    "작업은 가요. 다만 방향만 확인해요.",
    "로그가 길어요. 볼 파일을 하나로 줄여요.",
    "멍. 큰 문제 전이라 작게 점검해요.",
    "{name} 귀가 쫑긋했어요. 잠깐만요.",
  ],
  risk: [
    "멍! 같은 실패 냄새가 진해요. 원인부터 좁혀요.",
    "멍멍. 테스트가 맴돌아요. 단일 케이스만 봐요.",
    "토큰 여유가 줄어요. 지금 로그를 짧게 묶어요.",
    "컨텍스트가 빵빵해요. 목표와 변경 파일을 정리해요.",
    "킁. 실패 로그가 반복돼요. 전체 실행은 줄여요.",
    "{name}가 짖을 타이밍이에요. 원인 파일만 확인해요.",
    "컨텍스트 압력이 높아요. 새 판단 전에 요약해요.",
    "더 돌리기 전에 실패 이유 하나만 잡아요.",
    "로그가 너무 자라요. 다음 명령을 작게 줄여요.",
    "반복 신호예요. 테스트 범위를 한 칸 줄여요.",
  ],
  intervene: [
    "멍멍멍! 지금은 멈추고 실패 로그부터 봐요.",
    "멈춰요. 같은 원인을 계속 밟고 있어요.",
    "루프 냄새가 강해요. 명령을 끊고 상태를 봐요.",
    "계속 가면 같은 실패가 더 쌓일 수 있어요.",
    "사람 손길 필요해요. 문제 파일부터 직접 봐요.",
    "여기서 잠깐 정지. 마지막 실패만 정리해요.",
    "큰 결정 전이에요. 근거 로그를 먼저 고정해요.",
    "자동 진행보다 원인 확인이 먼저예요. 멍!",
    "세션을 멈추고 실패 로그를 짧게 묶어요.",
    "{name}가 세게 짖어요. 지금은 방향 재설정이에요.",
  ],
  happy: interactionBubbleLines.hover,
  affection: interactionBubbleLines.petting,
};

export function getPetBubbleLine(state: OverlayState, turn = 0, companionName: CompanionName = "보리"): string | null {
  if (state.status === "normal") {
    return null;
  }

  const lines = petBubbleLines[state.status];
  return formatCompanionLine(lines[(buildSessionSeed(state) + turn) % lines.length], companionName);
}

export function getHappyBubbleLine(index: number, companionName: CompanionName = "보리"): string {
  return getInteractionBubbleLine("hover", index, false, companionName);
}

export function getAffectionBubbleLine(index: number, companionName: CompanionName = "보리"): string {
  return getInteractionBubbleLine("petting", index, false, companionName);
}

export function getIdleBubbleLine(index: number, isDemo = false): string {
  return getBehaviorBubbleLine("sitting", index, isDemo);
}

export function getBehaviorBubbleLine(
  petState: Extract<PetBehaviorState, "walking" | "sitting" | "lying" | "sniffing" | "stretching" | "watching" | "sleepy" | "kennel">,
  index: number,
  isDemo = false,
): string {
  const lines = (isDemo ? demoBehaviorBubbleLines : behaviorBubbleLines)[petState];
  return lines[Math.abs(index) % lines.length];
}

export function getInteractionBubbleLine(
  kind: InteractionBubbleKind,
  index: number,
  isDemo = false,
  companionName: CompanionName = "보리",
): string {
  const lines = (isDemo ? demoInteractionBubbleLines : interactionBubbleLines)[kind];
  return formatCompanionLine(lines[index % lines.length], companionName);
}

export function getNormalIdlePetState(turn: number, popupOpen: boolean): PetBehaviorState {
  const openPopupStates: PetBehaviorState[] = ["sitting", "lying", "watching", "sleepy"];
  const quietStates: PetBehaviorState[] = ["walking", "sitting", "lying", "sniffing", "stretching", "watching", "sleepy"];
  const states = popupOpen ? openPopupStates : quietStates;
  return states[Math.abs(turn) % states.length];
}

export function chooseDisplayedPetState(state: OverlayState, idleTurn: number, popupOpen: boolean): PetBehaviorState {
  if (state.status === "intervene") {
    return "alert";
  }

  if (state.status === "risk") {
    return "sniffing";
  }

  if (state.status === "watch") {
    return "watching";
  }

  if (state.petState === "petting" || state.petState === "kennel" || state.petState === "happy") {
    return state.petState;
  }

  return getNormalIdlePetState(idleTurn, popupOpen);
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

export function getPetPointerZone(point: PointerPoint, rect: PointerRect): PetPointerZone {
  if (rect.width <= 0 || rect.height <= 0) {
    return "move";
  }

  const localX = (point.x - rect.left) / rect.width;
  const localY = (point.y - rect.top) / rect.height;
  const centeredBodyX = localX >= 0.32 && localX <= 0.76;
  const centeredBodyY = localY >= 0.46 && localY <= 0.82;

  return centeredBodyX && centeredBodyY ? "body" : "move";
}

export function classifyPetPointerGesture(
  start: PointerPoint | null,
  end: PointerPoint,
  startZone: PetPointerZone = "body",
): PetPointerGesture {
  if (!start) {
    return "none";
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const kennelVerticalSlack = Math.max(22, Math.min(42, Math.round(absX * 0.55)));
  const mostlyHorizontal = absY <= kennelVerticalSlack;
  const distance = Math.hypot(deltaX, deltaY);

  if (mostlyHorizontal && deltaX >= 58) {
    return "kennel";
  }

  if (startZone === "move") {
    return distance >= moveGestureThreshold ? "move" : "none";
  }

  const pettingVerticalSlack = Math.max(14, Math.min(32, Math.round(absX * 0.55)));
  if (absX >= pettingGestureThreshold && absX < 54 && absY <= pettingVerticalSlack) {
    return "petting";
  }

  if (distance >= moveGestureThreshold) {
    return "move";
  }

  return "none";
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

function formatCompanionLine(line: string, companionName: CompanionName): string {
  const formatted = line.replaceAll("{name}", companionName);
  if (formatted.includes(companionName)) {
    return formatted;
  }

  return `${companionName}: ${formatted}`;
}

function splitFailureKey(failureKey: string): [string, string] {
  const [rawTask, ...rawReason] = failureKey.split(":");
  const task = rawTask.trim() || "알 수 없는 작업";
  const reason = rawReason.join(":").trim() || "같은 오류";
  return [task, reason];
}
