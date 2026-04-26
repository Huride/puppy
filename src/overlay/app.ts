import type { OverlayState, SessionStatus } from "../session/types.js";
import { getHappyBubbleLine, getPetBubbleLine } from "./pet-presenter.js";

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
const context = requireElement<HTMLElement>("context");
const tokenEta = requireElement<HTMLElement>("tokenEta");
const loop = requireElement<HTMLElement>("loop");
const cpu = requireElement<HTMLElement>("cpu");
const memory = requireElement<HTMLElement>("memory");
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
  context.textContent = formatPercent(state.popup.contextPercent);
  tokenEta.textContent = formatEta(state.popup.tokenEtaMinutes);
  loop.textContent = `${state.popup.repeatedFailureCount}x`;
  cpu.textContent = formatPercent(state.popup.cpuPercent);
  memory.textContent = formatPercent(state.popup.memoryPercent);
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

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing overlay element: ${id}`);
  }

  return element as T;
}
