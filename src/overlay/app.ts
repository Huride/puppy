import type { OverlayState, SessionStatus } from "../session/types.js";
import { describeIssueFocus, getHappyBubbleLine, getMetricFillPercent, getPetBubbleLine } from "./pet-presenter.js";

const statusColors: Record<SessionStatus, string> = {
  normal: "#277a46",
  watch: "#8f6815",
  risk: "#b35216",
  intervene: "#b42318",
};

const bubble = requireElement<HTMLElement>("bubble");
const pet = requireElement<HTMLButtonElement>("pet");
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

connect();

pet.addEventListener("click", () => {
  const isHidden = popup.classList.toggle("hidden");
  pet.setAttribute("aria-expanded", String(!isHidden));
});

pet.addEventListener("pointerenter", () => {
  if (!isUrgent(latestState?.status)) {
    setPetState("happy");
    renderBubble(getHappyBubbleLine(happyLineIndex));
    happyLineIndex += 1;
  }
});

pet.addEventListener("pointerleave", () => {
  if (!isUrgent(latestState?.status)) {
    setPetState(latestPetState);
    renderBubble(latestState ? getPetBubbleLine(latestState) : null);
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

function render(state: OverlayState): void {
  renderBubble(getPetBubbleLine(state));
  latestPetState = state.petState;
  setPetState(state.petState);

  popupTitle.textContent = state.popup.title;
  statusBadge.textContent = state.status.toUpperCase();
  statusBadge.style.backgroundColor = statusColors[state.status];
  const issue = describeIssueFocus(state);
  issueTitle.textContent = issue.title;
  issueDetail.textContent = issue.detail;
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
  pet.classList.remove("idle", "walking", "alert", "happy");
  pet.classList.add(state);
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
