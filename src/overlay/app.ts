import type { OverlayState, SessionStatus } from "../session/types.js";
import {
  chooseDisplayedPetState,
  classifyPetPointerGesture,
  describeIssueFocus,
  getBehaviorBubbleLine,
  getInteractionBubbleLine,
  getMetricFillPercent,
  getPetBubbleLine,
} from "./pet-presenter.js";

declare global {
  interface Window {
    puppyDesktop?: {
      setMode: (mode: "active" | "kennel") => Promise<{ ok: boolean }>;
      moveWindowBy: (deltaX: number, deltaY: number) => Promise<{ ok: boolean }>;
      saveGeminiKey: (apiKey: string) => Promise<{ ok: boolean; message: string }>;
      loginProvider: (provider: string, apiKey: string) => Promise<{ ok: boolean; message: string }>;
      onCommand: (handler: (command: "enter-kennel" | "exit-kennel" | "set-template", value?: string) => void) => void;
    };
  }
}

const statusColors: Record<SessionStatus, string> = {
  normal: "#277a46",
  watch: "#8f6815",
  risk: "#b35216",
  intervene: "#b42318",
};

const bubble = requireElement<HTMLElement>("bubble");
const pet = requireElement<HTMLButtonElement>("pet");
const kennel = requireElement<HTMLButtonElement>("kennel");
const popup = requireElement<HTMLElement>("popup");
const popupTitle = requireElement<HTMLElement>("popupTitle");
const statusBadge = requireElement<HTMLElement>("statusBadge");
const issueTitle = requireElement<HTMLElement>("issueTitle");
const issueDetail = requireElement<HTMLElement>("issueDetail");
const context = requireElement<HTMLElement>("context");
const tokenEta = requireElement<HTMLElement>("tokenEta");
const loop = requireElement<HTMLElement>("loop");
const cpu = requireElement<HTMLElement>("cpu");
const memory = requireElement<HTMLElement>("memory");
const contextBar = requireElement<HTMLElement>("contextBar");
const tokenBar = requireElement<HTMLElement>("tokenBar");
const loopBar = requireElement<HTMLElement>("loopBar");
const cpuBar = requireElement<HTMLElement>("cpuBar");
const memoryBar = requireElement<HTMLElement>("memoryBar");
const contextHint = requireElement<HTMLElement>("contextHint");
const tokenHint = requireElement<HTMLElement>("tokenHint");
const loopHint = requireElement<HTMLElement>("loopHint");
const cpuHint = requireElement<HTMLElement>("cpuHint");
const memoryHint = requireElement<HTMLElement>("memoryHint");
const summary = requireElement<HTMLElement>("summary");
const recommendation = requireElement<HTMLElement>("recommendation");

let latestState: OverlayState | null = null;
let latestPetState: OverlayState["petState"] = "walking";
let reconnectTimer: number | undefined;
let happyLineIndex = 0;
let affectionLineIndex = 0;
let attentionLineIndex = 0;
let lastAttentionSignature = "";
let idleTurn = 0;
let idleTimer: number | undefined;
let idleBubbleTimer: number | undefined;
let pettingTimer: number | undefined;
let kennelTimer: number | undefined;
let pointerStart: { x: number; y: number } | null = null;
let lastWindowMovePoint: { x: number; y: number } | null = null;
let isMovingWindow = false;
let isKennelMode = false;
let suppressNextClick = false;

connect();

window.puppyDesktop?.onCommand((command, value) => {
  handleDesktopCommand(command, value);
});

window.addEventListener("puppy:command", (event) => {
  const detail = (event as CustomEvent<{ command?: unknown; value?: unknown }>).detail;
  if (!detail || typeof detail.command !== "string") {
    return;
  }

  handleDesktopCommand(detail.command, typeof detail.value === "string" ? detail.value : undefined);
});

applyTemplate("Bori");

pet.addEventListener("click", () => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  if (isKennelMode) {
    return;
  }

  const isHidden = popup.classList.toggle("hidden");
  pet.setAttribute("aria-expanded", String(!isHidden));
  if (latestState?.status === "normal") {
    setPetState(chooseDisplayedPetState(latestState, idleTurn, isPopupOpen()));
  }
});

pet.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  pointerStart = { x: event.clientX, y: event.clientY };
  lastWindowMovePoint = { x: event.screenX, y: event.screenY };
  isMovingWindow = false;
  pet.setPointerCapture(event.pointerId);
});

pet.addEventListener("pointermove", (event) => {
  event.preventDefault();
  const gesture = classifyPetPointerGesture(pointerStart, { x: event.clientX, y: event.clientY });
  if (!isMovingWindow && gesture !== "move") {
    return;
  }

  isMovingWindow = true;
  suppressNextClick = true;
  const previous = lastWindowMovePoint ?? { x: event.screenX, y: event.screenY };
  const deltaX = event.screenX - previous.x;
  const deltaY = event.screenY - previous.y;
  lastWindowMovePoint = { x: event.screenX, y: event.screenY };
  if (deltaX !== 0 || deltaY !== 0) {
    void window.puppyDesktop?.moveWindowBy(deltaX, deltaY);
  }
});

pet.addEventListener("pointerup", (event) => {
  event.preventDefault();
  const gesture = classifyPetPointerGesture(pointerStart, { x: event.clientX, y: event.clientY });
  if (isMovingWindow) {
    suppressNextClick = true;
  } else if (gesture === "kennel") {
    suppressNextClick = true;
    enterKennelMode();
  } else if (gesture === "petting") {
    suppressNextClick = true;
    playPettingInteraction();
  }
  pointerStart = null;
  lastWindowMovePoint = null;
  isMovingWindow = false;
  if (pet.hasPointerCapture(event.pointerId)) {
    pet.releasePointerCapture(event.pointerId);
  }
});

pet.addEventListener("pointercancel", (event) => {
  event.preventDefault();
  pointerStart = null;
  lastWindowMovePoint = null;
  isMovingWindow = false;
  if (pet.hasPointerCapture(event.pointerId)) {
    pet.releasePointerCapture(event.pointerId);
  }
});

pet.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

kennel.addEventListener("click", () => {
  exitKennelMode();
});

pet.addEventListener("pointerenter", () => {
  if (!isUrgent(latestState?.status)) {
    setPetState("happy");
    renderBubble(getInteractionBubbleLine("hover", happyLineIndex, latestState?.popup.isDemo === true));
    happyLineIndex += 1;
  }
});

pet.addEventListener("pointerleave", () => {
  if (!isUrgent(latestState?.status)) {
    setPetState(latestState ? chooseDisplayedPetState(latestState, idleTurn, isPopupOpen()) : latestPetState);
    renderBubble(latestState ? getPetBubbleLine(latestState, attentionLineIndex) : null);
  }
});

function connect(): void {
  window.clearTimeout(reconnectTimer);

  const socket = new WebSocket(`ws://${window.location.host}`);

  socket.addEventListener("message", (event: MessageEvent<string>) => {
    const state = parseOverlayState(event.data);
    if (!state) {
      return;
    }

    latestState = state;
    render(state);
  });

  socket.addEventListener("close", () => {
    reconnectTimer = window.setTimeout(connect, 1_000);
  });
}

function parseOverlayState(payload: string): OverlayState | null {
  try {
    return JSON.parse(payload) as OverlayState;
  } catch {
    return null;
  }
}

function handleDesktopCommand(command: string, value?: string): void {
  if (command === "enter-kennel") {
    enterKennelMode();
    return;
  }

  if (command === "exit-kennel") {
    exitKennelMode();
    return;
  }

  if (command === "set-template" && value) {
    applyTemplate(value);
  }
}

function render(state: OverlayState): void {
  if (isKennelMode) {
    return;
  }

  renderAttentionBubble(state);
  latestPetState = state.petState;
  setPetState(chooseDisplayedPetState(state, idleTurn, isPopupOpen()));
  scheduleIdleAction();

  popupTitle.textContent = state.popup.isDemo ? `DEMO · ${state.popup.title}` : state.popup.title;
  statusBadge.textContent = state.status.toUpperCase();
  statusBadge.style.backgroundColor = statusColors[state.status];
  const issue = describeIssueFocus(state);
  issueTitle.textContent = state.popup.isDemo ? issue.title.replace("문제 작업:", "데모 작업:") : issue.title;
  issueDetail.textContent = state.popup.isDemo ? `데모 로그 기준입니다. ${issue.detail}` : issue.detail;
  context.textContent = formatPercent(state.popup.contextPercent);
  tokenEta.textContent = formatEta(state.popup.tokenEtaMinutes);
  loop.textContent = `${state.popup.repeatedFailureCount}x`;
  cpu.textContent = formatPercent(state.popup.cpuPercent);
  memory.textContent = formatPercent(state.popup.memoryPercent);
  renderMeter(contextBar, state.popup.contextPercent);
  renderMeter(tokenBar, tokenEtaPressure(state.popup.tokenEtaMinutes));
  renderMeter(loopBar, state.popup.repeatedFailureCount * 25);
  renderMeter(cpuBar, state.popup.cpuPercent);
  renderMeter(memoryBar, state.popup.memoryPercent);
  contextHint.textContent = contextPressureHint(state.popup.contextPercent);
  tokenHint.textContent = tokenEtaHint(state.popup.tokenEtaMinutes);
  loopHint.textContent = loopHintText(state.popup.repeatedFailureCount, state.popup.repeatedFailureKey);
  cpuHint.textContent = resourceHint("CPU", state.popup.cpuPercent);
  memoryHint.textContent = resourceHint("메모리", state.popup.memoryPercent);
  summary.textContent = state.popup.summary;
  recommendation.textContent = state.popup.recommendation;
}

function setPetState(state: OverlayState["petState"]): void {
  pet.classList.remove(
    "walking",
    "sitting",
    "lying",
    "stretching",
    "sniffing",
    "watching",
    "happy",
    "alert",
    "sleepy",
    "petting",
    "kennel",
  );
  pet.classList.add(state);
}

function playPettingInteraction(): void {
  if (isKennelMode) {
    return;
  }

  window.clearTimeout(pettingTimer);
  pet.classList.add("petting");
  setPetState("petting");
  renderBubble(getInteractionBubbleLine("petting", affectionLineIndex, latestState?.popup.isDemo === true));
  affectionLineIndex += 1;

  pettingTimer = window.setTimeout(() => {
    pet.classList.remove("petting");
    if (!isKennelMode) {
      setPetState(latestState ? chooseDisplayedPetState(latestState, idleTurn, isPopupOpen()) : latestPetState);
      renderBubble(latestState ? getPetBubbleLine(latestState, attentionLineIndex) : null);
    }
  }, 1_050);
}

function scheduleIdleAction(): void {
  if (isKennelMode || latestState?.status !== "normal") {
    window.clearTimeout(idleTimer);
    idleTimer = undefined;
    return;
  }

  if (idleTimer !== undefined) {
    return;
  }

  const delay = idleTurn === 0 ? 1_200 : 4_000 + Math.round(Math.random() * 5_000);
  idleTimer = window.setTimeout(() => {
    idleTimer = undefined;
    playIdleAction();
  }, delay);
}

function playIdleAction(): void {
  if (isKennelMode || latestState?.status !== "normal") {
    return;
  }

  const popupOpen = isPopupOpen();
  idleTurn += 1;
  const displayedState = chooseDisplayedPetState(latestState, idleTurn, popupOpen);
  setPetState(displayedState);

  if (!popupOpen && idleTurn % 2 === 0 && isBehaviorBubbleState(displayedState)) {
    renderBubble(getBehaviorBubbleLine(displayedState, idleTurn, latestState.popup.isDemo === true));
    window.clearTimeout(idleBubbleTimer);
    idleBubbleTimer = window.setTimeout(() => {
      if (latestState?.status === "normal") {
        renderBubble(null);
      }
    }, 2_300);
  }

  scheduleIdleAction();
}

function renderAttentionBubble(state: OverlayState): void {
  const signature = buildAttentionSignature(state);
  if (signature !== lastAttentionSignature) {
    lastAttentionSignature = signature;
    attentionLineIndex = 0;
  }

  renderBubble(getPetBubbleLine(state, attentionLineIndex));
  if (state.status !== "normal") {
    attentionLineIndex += 1;
  }
}

function renderBubble(message: string | null): void {
  if (!message) {
    bubble.textContent = "";
    bubble.classList.add("hidden");
    return;
  }

  bubble.textContent = message;
  bubble.classList.remove("hidden");
}

function enterKennelMode(): void {
  if (isKennelMode) {
    return;
  }

  window.clearTimeout(pettingTimer);
  window.clearTimeout(idleTimer);
  window.clearTimeout(idleBubbleTimer);
  window.clearTimeout(kennelTimer);
  pet.classList.remove("petting");
  isKennelMode = true;
  popup.classList.add("hidden");
  renderBubble(getInteractionBubbleLine("kennelEnter", attentionLineIndex, latestState?.popup.isDemo === true));
  void window.puppyDesktop?.setMode("kennel");
  kennel.classList.remove("hidden");
  kennel.classList.remove("exiting");
  kennel.classList.add("entering");
  setPetState("walking");
  pet.classList.add("kennel-entering");
  kennelTimer = window.setTimeout(() => {
    if (!isKennelMode) {
      return;
    }

    pet.classList.add("hidden");
    pet.classList.remove("walking", "kennel-entering");
    kennel.classList.remove("entering");
    window.clearTimeout(idleBubbleTimer);
    idleBubbleTimer = window.setTimeout(() => {
      if (isKennelMode) {
        renderBubble(null);
      }
    }, 1_400);
  }, 780);
}

function exitKennelMode(): void {
  if (!isKennelMode) {
    return;
  }

  window.clearTimeout(kennelTimer);
  void window.puppyDesktop?.setMode("active");
  kennel.classList.remove("hidden", "entering");
  kennel.classList.add("exiting");
  pet.classList.remove("hidden", "kennel-entering");
  setPetState("walking");
  pet.classList.add("kennel-exiting");
  renderBubble(getInteractionBubbleLine("kennelExit", attentionLineIndex, latestState?.popup.isDemo === true));
  kennelTimer = window.setTimeout(() => {
    isKennelMode = false;
    kennel.classList.add("hidden");
    kennel.classList.remove("exiting");
    pet.classList.remove("kennel-exiting", "walking");
    if (latestState) {
      render(latestState);
    }
    renderBubble(getInteractionBubbleLine("kennelExit", attentionLineIndex, latestState?.popup.isDemo === true));
    window.clearTimeout(idleBubbleTimer);
    idleBubbleTimer = window.setTimeout(() => {
      if (!isKennelMode && latestState?.status === "normal") {
        renderBubble(null);
      }
    }, 2_300);
  }, 920);
}

function isPopupOpen(): boolean {
  return !popup.classList.contains("hidden");
}

function isBehaviorBubbleState(state: OverlayState["petState"]): state is Parameters<typeof getBehaviorBubbleLine>[0] {
  return (
    state === "walking" ||
    state === "sitting" ||
    state === "lying" ||
    state === "sniffing" ||
    state === "stretching" ||
    state === "watching" ||
    state === "sleepy" ||
    state === "kennel"
  );
}

function applyTemplate(template: string): void {
  document.body.dataset.template = template.toLowerCase();
}

function buildAttentionSignature(state: OverlayState): string {
  return [
    state.status,
    state.popup.repeatedFailureKey ?? "",
    state.popup.repeatedFailureCount,
    Math.floor(state.popup.contextPercent / 10),
    state.popup.tokenEtaMinutes ?? "",
  ].join("|");
}

function renderMeter(element: HTMLElement, value: number): void {
  const percent = getMetricFillPercent(value);
  element.style.width = `${percent}%`;
  element.dataset.tone = percent >= 80 ? "risk" : percent >= 60 ? "watch" : "normal";
}

function isUrgent(status: SessionStatus | undefined): boolean {
  return status === "risk" || status === "intervene";
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatEta(minutes: number | null): string {
  if (minutes === null) {
    return "-";
  }

  return minutes <= 1 ? "<1m" : `${Math.round(minutes)}m`;
}

function tokenEtaPressure(minutes: number | null): number {
  if (minutes === null) {
    return 0;
  }

  return Math.max(0, 100 - minutes * 5);
}

function contextPressureHint(percent: number): string {
  if (percent >= 80) {
    return "곧 요약하고 새 세션으로 넘기는 게 좋아요.";
  }

  if (percent >= 60) {
    return "긴 작업이면 중간 요약을 준비해요.";
  }

  return "아직 컨텍스트 여유가 있어요.";
}

function tokenEtaHint(minutes: number | null): string {
  if (minutes === null) {
    return "최근 로그에서 토큰 ETA를 아직 못 찾았어요.";
  }

  if (minutes <= 10) {
    return "지금 속도면 곧 토큰 압박이 올 수 있어요.";
  }

  return `${Math.round(minutes)}분 정도 여유가 있어 보여요.`;
}

function loopHintText(count: number, key: string | null): string {
  if (count >= 3) {
    return key ? `${key} 쪽이 반복되고 있어요.` : "같은 실패가 반복되고 있어요.";
  }

  if (count > 0) {
    return "실패가 있었지만 아직 반복 루프는 약해요.";
  }

  return "반복 실패는 감지되지 않았어요.";
}

function resourceHint(label: string, percent: number): string {
  if (percent >= 80) {
    return `${label} 부하가 높아요. 빌드/테스트가 겹쳤는지 확인해요.`;
  }

  if (percent >= 60) {
    return `${label} 사용량이 올라가는 중이에요.`;
  }

  return `${label} 상태는 안정적이에요.`;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing overlay element: ${id}`);
  }

  return element as T;
}
