import type { OverlayState, PopupSystemActionId, SessionStatus } from "../session/types.js";
import {
  chooseDisplayedPetState,
  classifyPetPointerGesture,
  describeIssueFocus,
  getBehaviorBubbleLine,
  getInteractionBubbleLine,
  getPetBubbleLine,
  getPetPointerZone,
} from "./pet-presenter.js";
import type { CompanionName, PetPointerZone } from "./pet-presenter.js";
import {
  getHouseImageSrc,
  getHouseTemplateId,
  getPetImageSrc,
  getPetPoseForState,
  resolvePetPoseForTemplate,
} from "./pet-sprites.js";
import type { PetTemplateId } from "./pet-sprites.js";
import {
  formatIssueDetail,
  formatSessionMeta,
  formatStatusBadge,
} from "./popup-presenter.js";

declare global {
  interface Window {
    puppyDesktop?: {
      setMode: (mode: "active" | "kennel") => Promise<{ ok: boolean }>;
      openStatusWindow: () => Promise<{ ok: boolean }>;
      closeStatusWindow: () => Promise<{ ok: boolean }>;
      setPopupVisible: (visible: boolean) => Promise<{ ok: boolean }>;
      closePopupWindow: () => Promise<{ ok: boolean }>;
      moveWindowBy: (deltaX: number, deltaY: number) => Promise<{ ok: boolean }>;
      setMousePassthrough: (enabled: boolean) => Promise<{ ok: boolean }>;
      setInteractiveRect: (
        rect: {
          left: number;
          top: number;
          right: number;
          bottom: number;
          popupOpen: boolean;
          pet?: { left: number; top: number; right: number; bottom: number } | null;
        } | null,
      ) => Promise<{ ok: boolean }>;
      sendInteraction: (action: string, payload?: Record<string, number | string | boolean | null>) => Promise<{ ok: boolean }>;
      openSystemAction: (action: PopupSystemActionId) => Promise<{ ok: boolean; message?: string }>;
      saveGeminiKey: (apiKey: string) => Promise<{ ok: boolean; message: string }>;
      loginProvider: (provider: string, apiKey: string) => Promise<{ ok: boolean; message: string }>;
      onPopupVisibilityChanged: (handler: (visible: boolean) => void) => void;
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
const petHit = requireElement<HTMLElement>("petHit");
const kennel = requireElement<HTMLButtonElement>("kennel");
const petArt = requireElement<HTMLElement>("petArt");
const petFrame = requireElement<HTMLImageElement>("petFrame");
const heartBurst = requireElement<HTMLElement>("heartBurst");
const houseFrame = requireElement<HTMLImageElement>("houseFrame");
const kennelHouseFrame = requireElement<HTMLImageElement>("kennelHouseFrame");
const popup = requireElement<HTMLElement>("popup");
const popupClose = requireElement<HTMLButtonElement>("popupClose");
const popupTitle = requireElement<HTMLElement>("popupTitle");
const statusBadge = requireElement<HTMLElement>("statusBadge");
const issueTitle = requireElement<HTMLElement>("issueTitle");
const issueDetail = requireElement<HTMLElement>("issueDetail");
const loadingState = requireElement<HTMLElement>("loadingState");
const loadingLabel = requireElement<HTMLElement>("loadingLabel");
const context = requireElement<HTMLElement>("context");
const tokenEta = requireElement<HTMLElement>("tokenEta");
const cpu = requireElement<HTMLElement>("cpu");
const memory = requireElement<HTMLElement>("memory");
const storage = requireElement<HTMLElement>("storage");
const battery = requireElement<HTMLElement>("battery");
const contextBar = requireElement<HTMLElement>("contextBar");
const tokenBar = requireElement<HTMLElement>("tokenBar");
const cpuBar = requireElement<HTMLElement>("cpuBar");
const memoryBar = requireElement<HTMLElement>("memoryBar");
const storageBar = requireElement<HTMLElement>("storageBar");
const cpuSparkline = requireElement<HTMLElement>("cpuSparkline");
const cpuSparklineFill = requireElement<SVGPathElement>("cpuSparklineFill");
const cpuSparklineLine = requireElement<SVGPathElement>("cpuSparklineLine");
const contextHint = requireElement<HTMLElement>("contextHint");
const tokenHint = requireElement<HTMLElement>("tokenHint");
const cpuHint = requireElement<HTMLElement>("cpuHint");
const memoryHint = requireElement<HTMLElement>("memoryHint");
const storageHint = requireElement<HTMLElement>("storageHint");
const batteryHint = requireElement<HTMLElement>("batteryHint");
const batteryCapacityHint = requireElement<HTMLElement>("batteryCapacityHint");
const batteryCycleHint = requireElement<HTMLElement>("batteryCycleHint");
const batteryTemperatureHint = requireElement<HTMLElement>("batteryTemperatureHint");
const summary = requireElement<HTMLElement>("summary");
const recommendation = requireElement<HTMLElement>("recommendation");
const sessionMeta = requireElement<HTMLElement>("sessionMeta");
const ctaActivity = requireElement<HTMLButtonElement>("ctaActivity");
const ctaStorage = requireElement<HTMLButtonElement>("ctaStorage");
const ctaNetwork = requireElement<HTMLButtonElement>("ctaNetwork");
const ctaArtifacts = requireElement<HTMLButtonElement>("ctaArtifacts");

const ctaButtons: Partial<Record<PopupSystemActionId, HTMLButtonElement>> = {
  "activity-monitor": ctaActivity,
  "storage-settings": ctaStorage,
  "network-settings": ctaNetwork,
  "open-artifact-path": ctaArtifacts,
};

const DEFAULT_CPU_SPARKLINE_GEOMETRY = {
  width: 120,
  height: 28,
  topPadding: 2,
  singleSampleWidth: 10,
} as const;
const cpuSparklineGeometry = readCpuSparklineGeometry(cpuSparkline);

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
let pointerStartZone: PetPointerZone = "move";
let lastWindowMovePoint: { x: number; y: number } | null = null;
let pointerDownAt = 0;
let pointerTravel = 0;
let fallbackPointerStart: { x: number; y: number } | null = null;
let fallbackPointerDownAt = 0;
let fallbackPointerTravel = 0;
let isMovingWindow = false;
let isKennelMode = false;
let suppressNextClick = false;
let pendingMouseupTap = false;
let lastStatusOpenAt = 0;
let activeTemplate: PetTemplateId = "bori";
let interactiveRectFrame: number | undefined;
let desktopPopupVisible = false;

const searchParams = new URLSearchParams(window.location.search);
const viewMode = searchParams.get("view") === "status" ? "status" : "companion";
const useDetachedStatusWindow = viewMode === "companion";
const initialTemplate = searchParams.get("template") ?? "Bori";
const socketParam = searchParams.get("socket");

document.body.dataset.view = viewMode;

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

window.puppyDesktop?.onPopupVisibilityChanged((visible) => {
  desktopPopupVisible = visible;
});

applyTemplate(initialTemplate);
if (viewMode === "status") {
  popup.classList.remove("hidden");
  popupClose.classList.remove("hidden");
  pet.setAttribute("tabindex", "-1");
} else {
  popup.classList.add("hidden");
}
bindSpriteRecovery();
scheduleInteractiveRectReport();

pet.addEventListener("click", () => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  if (isKennelMode) {
    return;
  }

  openStatusPanel();
});

popupClose.addEventListener("click", () => {
  if (viewMode === "status") {
    void window.puppyDesktop?.closeStatusWindow();
    return;
  }

  popup.classList.add("hidden");
  void window.puppyDesktop?.setPopupVisible(false);
});

for (const [action, button] of Object.entries(ctaButtons) as Array<[PopupSystemActionId, HTMLButtonElement]>) {
  button.addEventListener("click", () => {
    void handleSystemActionClick(action);
  });
}

petHit.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  console.log("[pawtrol] pet pointerdown");
  pointerStart = { x: event.clientX, y: event.clientY };
  pointerStartZone = getPetPointerZone(pointerStart, petHit.getBoundingClientRect());
  lastWindowMovePoint = { x: event.screenX, y: event.screenY };
  pointerDownAt = Date.now();
  pointerTravel = 0;
  isMovingWindow = false;
  petHit.setPointerCapture(event.pointerId);
});

petHit.addEventListener("pointermove", (event) => {
  event.preventDefault();
  if (pointerStart) {
    pointerTravel = Math.max(pointerTravel, Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y));
  }
  if (shouldHoldForKennelDrag(pointerStart, { x: event.clientX, y: event.clientY })) {
    return;
  }

  const gesture = classifyPetPointerGesture(pointerStart, { x: event.clientX, y: event.clientY }, pointerStartZone);
  if (gesture === "kennel") {
    return;
  }

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

petHit.addEventListener("pointerup", (event) => {
  event.preventDefault();
  const pointerTap = pointerDownAt > 0 && Date.now() - pointerDownAt < 420 && pointerTravel < 24;
  pendingMouseupTap = pointerTap;
  const gesture = classifyPetPointerGesture(pointerStart, { x: event.clientX, y: event.clientY }, pointerStartZone);
  console.log(`[pawtrol] pet pointerup gesture=${gesture} tap=${pointerTap} travel=${pointerTravel.toFixed(1)}`);
  if (pointerTap) {
    suppressNextClick = true;
    openStatusPanel();
  } else if (gesture === "kennel") {
    suppressNextClick = true;
    enterKennelMode();
  } else if (isMovingWindow) {
    suppressNextClick = true;
  } else if (gesture === "petting") {
    suppressNextClick = true;
    playPettingInteraction();
  } else if (gesture === "none") {
    suppressNextClick = true;
    openStatusPanel();
  }
  pointerStart = null;
  pointerStartZone = "move";
  lastWindowMovePoint = null;
  pointerDownAt = 0;
  pointerTravel = 0;
  isMovingWindow = false;
  scheduleInteractiveRectReport();
  if (petHit.hasPointerCapture(event.pointerId)) {
    petHit.releasePointerCapture(event.pointerId);
  }
});

petHit.addEventListener("pointercancel", (event) => {
  event.preventDefault();
  pointerStart = null;
  pointerStartZone = "move";
  lastWindowMovePoint = null;
  pointerDownAt = 0;
  pointerTravel = 0;
  isMovingWindow = false;
  pendingMouseupTap = false;
  if (petHit.hasPointerCapture(event.pointerId)) {
    petHit.releasePointerCapture(event.pointerId);
  }
});

petHit.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

petHit.addEventListener("mouseup", (event) => {
  if (event.button !== 0 || isKennelMode || isMovingWindow) {
    pendingMouseupTap = false;
    return;
  }

  const quickTap = pendingMouseupTap || (pointerDownAt > 0 && Date.now() - pointerDownAt < 420 && pointerTravel < 24);
  console.log(`[pawtrol] pet mouseup tap=${quickTap} travel=${pointerTravel.toFixed(1)}`);
  pendingMouseupTap = false;
  if (!quickTap) {
    return;
  }

  openStatusPanel();
});

window.addEventListener(
  "pointerdown",
  (event) => {
    if (viewMode !== "companion" || event.button !== 0 || isKennelMode) {
      return;
    }

    fallbackPointerStart = { x: event.clientX, y: event.clientY };
    fallbackPointerDownAt = Date.now();
    fallbackPointerTravel = 0;
  },
  true,
);

window.addEventListener(
  "pointermove",
  (event) => {
    if (!fallbackPointerStart) {
      return;
    }

    fallbackPointerTravel = Math.max(
      fallbackPointerTravel,
      Math.hypot(event.clientX - fallbackPointerStart.x, event.clientY - fallbackPointerStart.y),
    );
  },
  true,
);

window.addEventListener(
  "pointerup",
  (event) => {
    if (viewMode !== "companion" || event.button !== 0 || isKennelMode) {
      fallbackPointerStart = null;
      fallbackPointerDownAt = 0;
      fallbackPointerTravel = 0;
      return;
    }

    const startedInsidePet = fallbackPointerStart ? pointInRect(fallbackPointerStart, pet.getBoundingClientRect()) : false;
    const endedInsidePet = pointInRect({ x: event.clientX, y: event.clientY }, pet.getBoundingClientRect());
    const quickTap =
      fallbackPointerDownAt > 0 &&
      Date.now() - fallbackPointerDownAt < 320 &&
      fallbackPointerTravel < 12 &&
      startedInsidePet &&
      endedInsidePet;

    if (quickTap) {
      console.log("[pawtrol] window pointerup fallback tap");
      openStatusPanel();
    }

    fallbackPointerStart = null;
    fallbackPointerDownAt = 0;
    fallbackPointerTravel = 0;
  },
  true,
);

window.addEventListener("resize", () => scheduleInteractiveRectReport());

kennel.addEventListener("click", () => {
  exitKennelMode();
});

pet.addEventListener("pointerenter", () => {
  if (!isUrgent(latestState?.status)) {
    setPetState("happy");
    renderBubble(getInteractionBubbleLine("hover", happyLineIndex, latestState?.popup.isDemo === true, getCompanionName()));
    happyLineIndex += 1;
  }
});

pet.addEventListener("pointerleave", () => {
  if (!isUrgent(latestState?.status)) {
    setPetState(latestState ? chooseDisplayedPetState(latestState, idleTurn, isPopupOpen()) : latestPetState);
    renderBubble(latestState ? getPetBubbleLine(latestState, attentionLineIndex, getCompanionName()) : null);
  }
});

function connect(): void {
  window.clearTimeout(reconnectTimer);

  const socketTarget =
    socketParam && socketParam.length > 0
      ? socketParam.replace(/^http/i, "ws")
      : `ws://${window.location.host}`;
  const socket = new WebSocket(socketTarget);

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
    return;
  }

  if (command === "petting") {
    playPettingInteraction();
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

  popupTitle.textContent = state.popup.isDemo ? `DEMO · ${getCompanionName()} 진단` : `${getCompanionName()} 진단`;
  statusBadge.textContent = formatStatusBadge(state);
  statusBadge.style.backgroundColor = statusColors[state.status];
  popup.classList.toggle("is-stale", state.popup.isStale === true);
  const loading = isLoadingState(state);
  loadingState.classList.toggle("hidden", !loading);
  loadingLabel.textContent =
    state.popup.observationMode === "watch"
      ? "실시간 로그와 시스템 정보를 읽는 중..."
      : "artifact와 시스템 정보를 읽는 중...";
  const issue = describeIssueFocus(state);
  issueTitle.textContent = state.popup.isDemo ? issue.title.replace("문제 작업:", "데모 작업:") : issue.title;
  issueDetail.textContent = formatIssueDetail(state, issue.detail);
  context.textContent = loading && state.popup.contextPercent === null ? "로딩 중" : formatPercent(state.popup.contextPercent);
  tokenEta.textContent = loading && state.popup.tokenEtaMinutes === null ? "로딩 중" : formatEta(state.popup.tokenEtaMinutes);
  cpu.textContent = loading && !state.popup.cpuDetail ? "로딩 중" : formatPercent(state.popup.cpuPercent);
  memory.textContent = loading && !state.popup.memoryDetail ? "로딩 중" : formatPercent(state.popup.memoryPercent);
  storage.textContent = loading && !state.popup.storageDetail ? "로딩 중" : formatStorageValue(state);
  battery.textContent = loading && !state.popup.batteryDetail ? "로딩 중" : formatBatteryValue(state);
  renderMeter(contextBar, state.popup.contextPercent);
  renderMeter(tokenBar, tokenEtaPressure(state.popup.tokenEtaMinutes));
  renderMeter(cpuBar, state.popup.cpuPercent);
  renderMeter(memoryBar, state.popup.memoryPercent);
  renderMeter(storageBar, state.popup.storageDetail?.usedPercent ?? null);
  renderCpuSparkline(state.popup.cpuDetail?.samples);
  contextHint.textContent = contextPressureHint(state.popup.contextPercent);
  tokenHint.textContent = tokenEtaHint(state.popup.tokenEtaMinutes);
  cpuHint.textContent = cpuUsageHint(state);
  memoryHint.textContent = memoryUsageHint(state);
  storageHint.textContent = storageUsageHint(state);
  batteryHint.textContent = batteryUsageHint(state);
  batteryCapacityHint.textContent = batteryCapacityUsageHint(state.popup.batteryDetail?.maxCapacityPercent, loading);
  batteryCycleHint.textContent = batteryCycleUsageHint(state.popup.batteryDetail?.cycleCount, loading);
  batteryTemperatureHint.textContent = batteryTemperatureUsageHint(state.popup.batteryDetail?.temperatureCelsius, loading);
  summary.textContent = state.popup.summary;
  recommendation.textContent = state.popup.recommendation;
  sessionMeta.textContent = formatSessionMeta(state);
  renderSystemActionButtons(state);
  scheduleInteractiveRectReport();
}

function renderSystemActionButtons(state: OverlayState): void {
  const desktop = window.puppyDesktop;
  const available = new Set(state.popup.availableSystemActions ?? []);

  for (const [action, button] of Object.entries(ctaButtons) as Array<[PopupSystemActionId, HTMLButtonElement]>) {
    const enabled = Boolean(desktop?.openSystemAction) && available.has(action);
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", String(!enabled));
  }
}

async function handleSystemActionClick(action: PopupSystemActionId): Promise<void> {
  if (!latestState) {
    return;
  }

  const desktop = window.puppyDesktop;
  if (!desktop?.openSystemAction) {
    return;
  }

  const available = new Set(latestState.popup.availableSystemActions ?? []);
  if (!available.has(action)) {
    return;
  }

  const result = await desktop.openSystemAction(action);
  if (!result.ok && result.message) {
    console.warn(`[pawtrol] system action failed: ${action} ${result.message}`);
  }
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
  const pose = resolvePetPoseForTemplate(activeTemplate, getPetPoseForState(state, { status: latestState?.status, turn: idleTurn }));
  petFrame.src = getPetImageSrc(activeTemplate, pose);
  houseFrame.src = getHouseImageSrc(activeTemplate);
  kennelHouseFrame.src = getHouseImageSrc(activeTemplate);
  document.body.dataset.house = getHouseTemplateId(activeTemplate);
  if (viewMode === "companion") {
    console.log(`[pawtrol] setPetState template=${activeTemplate} pose=${pose} src=${petFrame.src}`);
  }
}

function playPettingInteraction(): void {
  if (isKennelMode) {
    return;
  }

  window.clearTimeout(pettingTimer);
  pet.classList.add("petting");
  heartBurst.classList.remove("hidden");
  heartBurst.classList.remove("playing");
  void heartBurst.offsetWidth;
  heartBurst.classList.add("playing");
  setPetState("petting");
  renderBubble(getInteractionBubbleLine("petting", affectionLineIndex, latestState?.popup.isDemo === true, getCompanionName()));
  affectionLineIndex += 1;

  pettingTimer = window.setTimeout(() => {
    pet.classList.remove("petting");
    heartBurst.classList.add("hidden");
    heartBurst.classList.remove("playing");
    if (!isKennelMode) {
      setPetState(latestState ? chooseDisplayedPetState(latestState, idleTurn, isPopupOpen()) : latestPetState);
      renderBubble(latestState ? getPetBubbleLine(latestState, attentionLineIndex, getCompanionName()) : null);
    }
  }, 1_450);
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

  renderBubble(getPetBubbleLine(state, attentionLineIndex, getCompanionName()));
  if (state.status !== "normal") {
    attentionLineIndex += 1;
  }
}

function renderBubble(message: string | null): void {
  if (!message) {
    bubble.textContent = "";
    bubble.classList.add("hidden");
    scheduleInteractiveRectReport();
    return;
  }

  bubble.textContent = message;
  bubble.classList.remove("hidden");
  scheduleInteractiveRectReport();
}

function getInteractiveRect(): DOMRect | null {
  if (viewMode === "status") {
    return null;
  }

  const visibleElements = [petArt, pet, popup, kennel].filter((element) => !element.classList.contains("hidden"));
  if (!isPopupOpen() && !bubble.classList.contains("hidden")) {
    visibleElements.push(bubble);
  }
  if (visibleElements.length === 0) {
    return null;
  }

  const padding = 10;
  const rects = visibleElements.map((element) => element.getBoundingClientRect());
  const left = Math.min(...rects.map((rect) => rect.left)) - padding;
  const top = Math.min(...rects.map((rect) => rect.top)) - padding;
  const right = Math.max(...rects.map((rect) => rect.right)) + padding;
  const bottom = Math.max(...rects.map((rect) => rect.bottom)) + padding;

  return new DOMRect(left, top, right - left, bottom - top);
}

function scheduleInteractiveRectReport(): void {
  if (interactiveRectFrame !== undefined) {
    window.cancelAnimationFrame(interactiveRectFrame);
  }

  interactiveRectFrame = window.requestAnimationFrame(reportInteractiveRect);
}

function reportInteractiveRect(): void {
  const rect = getInteractiveRect();
  const petRect = !pet.classList.contains("hidden") && viewMode === "companion" ? pet.getBoundingClientRect() : null;
  void window.puppyDesktop?.setInteractiveRect(
    rect
      ? {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          popupOpen: isPopupOpen(),
          pet: petRect
            ? {
                left: petRect.left,
                top: petRect.top,
                right: petRect.right,
                bottom: petRect.bottom,
              }
            : null,
        }
      : null,
  );
}

function requestPopupWindowSize(): void {
  void window.puppyDesktop?.setInteractiveRect({
    left: 0,
    top: 0,
    right: 620,
    bottom: 1040,
    popupOpen: true,
  });
  window.setTimeout(scheduleInteractiveRectReport, 80);
  window.setTimeout(scheduleInteractiveRectReport, 220);
}

function toggleStatusPanel(): void {
  if (useDetachedStatusWindow) {
    desktopPopupVisible = !desktopPopupVisible;
    if (desktopPopupVisible) {
      void window.puppyDesktop?.openStatusWindow();
    } else {
      void window.puppyDesktop?.closeStatusWindow();
    }
    return;
  }

  const isHidden = popup.classList.toggle("hidden");
  pet.setAttribute("aria-expanded", String(!isHidden));
  if (!isHidden) {
    void window.puppyDesktop?.setPopupVisible(true);
    requestPopupWindowSize();
  } else {
    void window.puppyDesktop?.setPopupVisible(false);
  }
  scheduleInteractiveRectReport();
  if (latestState?.status === "normal") {
    setPetState(chooseDisplayedPetState(latestState, idleTurn, isPopupOpen()));
  }
}

function openStatusPanel(): void {
  console.log("[pawtrol] openStatusPanel");
  const now = Date.now();
  if (now - lastStatusOpenAt < 220) {
    return;
  }
  lastStatusOpenAt = now;

  if (useDetachedStatusWindow) {
    desktopPopupVisible = true;
    void window.puppyDesktop?.openStatusWindow();
    return;
  }

  if (popup.classList.contains("hidden")) {
    toggleStatusPanel();
    return;
  }

  pet.setAttribute("aria-expanded", "true");
}

function bindSpriteRecovery(): void {
  const restorePetFrame = () => {
    console.error(`[pawtrol] petFrame error src=${petFrame.currentSrc || petFrame.src} template=${activeTemplate}`);
    window.setTimeout(() => {
      const pose = resolvePetPoseForTemplate(
        activeTemplate,
        getPetPoseForState(latestPetState, { status: latestState?.status, turn: idleTurn }),
      );
      petFrame.src = getPetImageSrc(activeTemplate, pose);
    }, 30);
  };
  const restoreHouseFrame = () => {
    console.error(`[pawtrol] houseFrame error template=${activeTemplate}`);
    window.setTimeout(() => {
      houseFrame.src = getHouseImageSrc(activeTemplate);
      kennelHouseFrame.src = getHouseImageSrc(activeTemplate);
    }, 30);
  };

  petFrame.addEventListener("load", () => {
    if (viewMode === "companion") {
      console.log(`[pawtrol] petFrame load src=${petFrame.currentSrc || petFrame.src}`);
    }
  });
  petFrame.addEventListener("error", restorePetFrame);
  houseFrame.addEventListener("error", restoreHouseFrame);
  kennelHouseFrame.addEventListener("error", restoreHouseFrame);
}

function shouldHoldForKennelDrag(start: { x: number; y: number } | null, end: { x: number; y: number }): boolean {
  if (!start) {
    return false;
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  return deltaX > 0 && deltaX < 58 && Math.abs(deltaY) < 28;
}

function pointInRect(point: { x: number; y: number }, rect: DOMRect): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
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
  if (useDetachedStatusWindow) {
    void window.puppyDesktop?.closeStatusWindow();
  } else {
    void window.puppyDesktop?.setPopupVisible(false);
  }
  renderBubble(getInteractionBubbleLine("kennelEnter", attentionLineIndex, latestState?.popup.isDemo === true, getCompanionName()));
  void window.puppyDesktop?.setMode("kennel");
  kennel.classList.remove("hidden");
  houseFrame.classList.add("hidden");
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
    houseFrame.classList.add("hidden");
    kennel.classList.remove("entering");
    scheduleInteractiveRectReport();
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
  houseFrame.classList.add("hidden");
  kennel.classList.add("exiting");
  pet.classList.remove("hidden", "kennel-entering");
  setPetState("walking");
  pet.classList.add("kennel-exiting");
  renderBubble(getInteractionBubbleLine("kennelExit", attentionLineIndex, latestState?.popup.isDemo === true, getCompanionName()));
  kennelTimer = window.setTimeout(() => {
    isKennelMode = false;
    kennel.classList.add("hidden");
    kennel.classList.remove("exiting");
    houseFrame.classList.add("hidden");
    pet.classList.remove("kennel-exiting", "walking");
    scheduleInteractiveRectReport();
    if (latestState) {
      render(latestState);
    }
    renderBubble(getInteractionBubbleLine("kennelExit", attentionLineIndex, latestState?.popup.isDemo === true, getCompanionName()));
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
  activeTemplate = normalizeTemplate(template);
  if (viewMode === "companion") {
    console.log(`[pawtrol] applyTemplate raw=${template} normalized=${activeTemplate}`);
  }
  document.body.dataset.template = activeTemplate;
  houseFrame.src = getHouseImageSrc(activeTemplate);
  kennelHouseFrame.src = getHouseImageSrc(activeTemplate);
  document.body.dataset.house = getHouseTemplateId(activeTemplate);
  pet.setAttribute("aria-label", `Open ${getCompanionName()} status`);
  kennel.setAttribute("aria-label", `Bring ${getCompanionName()} out`);
  setPetState(latestPetState);
  scheduleInteractiveRectReport();
}

function getCompanionName(): CompanionName {
  if (activeTemplate === "nabi") {
    return "나비";
  }

  if (activeTemplate === "mochi") {
    return "모찌";
  }

  return "보리";
}

function normalizeTemplate(template: string): PetTemplateId {
  const normalized = template.toLowerCase();
  if (normalized === "nabi" || normalized === "mochi") {
    return normalized;
  }

  return "bori";
}

function buildAttentionSignature(state: OverlayState): string {
  return [
    state.status,
    state.popup.repeatedFailureKey ?? "",
    state.popup.repeatedFailureCount ?? "unknown",
    state.popup.contextPercent === null ? "unknown" : Math.floor(state.popup.contextPercent / 10),
    state.popup.tokenEtaMinutes ?? "",
  ].join("|");
}

function isUrgent(status: SessionStatus | undefined): boolean {
  return status === "risk" || status === "intervene";
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "unknown";
  }
  return `${Math.round(value * 10) / 10}%`;
}

function formatLoopCount(value: number | null): string {
  if (value === null) {
    return "unknown";
  }

  if (value === 0) {
    return "none";
  }

  return `${value}x`;
}

function renderMeter(element: HTMLElement, value: number | null): void {
  const percent = value === null ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  element.style.width = `${percent}%`;
  element.dataset.tone = percent >= 80 ? "risk" : percent >= 60 ? "watch" : "normal";
}

function readCpuSparklineGeometry(element: {
  dataset: Record<string, string | undefined>;
  querySelector: (selector: string) => { getAttribute: (name: string) => string | null } | null;
}): {
  width: number;
  height: number;
  topPadding: number;
  singleSampleWidth: number;
} {
  const svg = element.querySelector("svg");
  const viewBox = svg?.getAttribute("viewBox")?.split(/\s+/).map((part) => Number.parseFloat(part));

  return {
    width: parseSparklineNumber(element.dataset.chartWidth, viewBox?.[2], DEFAULT_CPU_SPARKLINE_GEOMETRY.width),
    height: parseSparklineNumber(element.dataset.chartHeight, viewBox?.[3], DEFAULT_CPU_SPARKLINE_GEOMETRY.height),
    topPadding: parseSparklineNumber(element.dataset.chartTopPadding, undefined, DEFAULT_CPU_SPARKLINE_GEOMETRY.topPadding),
    singleSampleWidth: parseSparklineNumber(
      element.dataset.singleSampleWidth,
      undefined,
      DEFAULT_CPU_SPARKLINE_GEOMETRY.singleSampleWidth,
    ),
  };
}

function parseSparklineNumber(value: string | undefined, fallback: number | undefined, defaultValue: number): number {
  if (value != null) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (fallback != null && Number.isFinite(fallback) && fallback > 0) {
    return fallback;
  }

  return defaultValue;
}

function renderCpuSparkline(samples: number[] | undefined): void {
  const { fillPath, linePath } = buildCpuSparklinePaths(samples ?? [], cpuSparklineGeometry);
  cpuSparklineFill.setAttribute("d", fillPath);
  cpuSparklineLine.setAttribute("d", linePath);
}

function buildCpuSparklinePaths(
  samples: number[],
  geometry: { width: number; height: number; topPadding: number; singleSampleWidth: number },
): { fillPath: string; linePath: string } {
  const values = samples
    .filter((sample) => Number.isFinite(sample))
    .map((sample) => Math.max(0, Math.min(100, sample)));

  if (values.length === 0) {
    return { fillPath: "", linePath: "" };
  }

  const usableHeight = geometry.height - geometry.topPadding - 1;

  if (values.length === 1) {
    const y = valueToSparklineY(values[0], usableHeight, geometry.height, geometry.topPadding);
    const halfWidth = geometry.singleSampleWidth / 2;
    const startX = roundSparkline(geometry.width / 2 - halfWidth);
    const endX = roundSparkline(geometry.width / 2 + halfWidth);

    return {
      fillPath: `M ${startX} ${geometry.height} L ${startX} ${roundSparkline(y)} L ${endX} ${roundSparkline(y)} L ${endX} ${geometry.height} Z`,
      linePath: "",
    };
  }

  const points = values.map((sample, index) => ({
    x: (index / (values.length - 1)) * geometry.width,
    y: valueToSparklineY(sample, usableHeight, geometry.height, geometry.topPadding),
  }));
  const linePath = `M ${points.map((point) => `${roundSparkline(point.x)} ${roundSparkline(point.y)}`).join(" L ")}`;
  const fillPath = `M ${roundSparkline(points[0]?.x ?? 0)} ${geometry.height} L ${points.map((point) => `${roundSparkline(point.x)} ${roundSparkline(point.y)}`).join(" L ")} L ${roundSparkline(points.at(-1)?.x ?? geometry.width)} ${geometry.height} Z`;

  return { fillPath, linePath };
}

function valueToSparklineY(value: number, usableHeight: number, height: number, topPadding: number): number {
  return height - topPadding - usableHeight * (value / 100);
}

function roundSparkline(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatEta(minutes: number | null): string {
  if (minutes === null) {
    return "unknown";
  }

  return minutes <= 1 ? "<1m" : `${Math.round(minutes)}m`;
}

function tokenEtaPressure(minutes: number | null): number | null {
  if (minutes === null) {
    return null;
  }

  return Math.max(0, 100 - minutes * 5);
}

function contextPressureHint(percent: number | null): string {
  if (percent === null) {
    return "artifact에서 컨텍스트 수치를 아직 못 찾았어요.";
  }

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

function formatStorageValue(state: OverlayState): string {
  const detail = state.popup.storageDetail;
  if (detail?.usedPercent == null) {
    return "unknown";
  }

  return `${Math.round(detail.usedPercent * 10) / 10}%`;
}

function formatBatteryValue(state: OverlayState): string {
  const detail = state.popup.batteryDetail;
  if (detail?.percent == null) {
    return "unknown";
  }

  return `${Math.round(detail.percent)}%`;
}

function cpuUsageHint(state: OverlayState): string {
  const detail = state.popup.cpuDetail;
  if (!detail) {
    return "CPU 세부 수치를 아직 못 읽었어요.";
  }

  const parts = [
    detail.userPercent === null ? null : `사용자 ${detail.userPercent}%`,
    detail.systemPercent === null ? null : `시스템 ${detail.systemPercent}%`,
    detail.idlePercent === null ? null : `유휴 ${detail.idlePercent}%`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "CPU 세부 수치를 아직 못 읽었어요.";
}

function memoryUsageHint(state: OverlayState): string {
  const detail = state.popup.memoryDetail;
  if (!detail) {
    return "메모리 세부 수치를 아직 못 읽었어요.";
  }

  const parts = [
    detail.appUsedGb === null ? null : `앱 ${detail.appUsedGb}GB`,
    detail.wiredGb === null ? null : `와이어드 ${detail.wiredGb}GB`,
    detail.compressedGb === null ? null : `압축 ${detail.compressedGb}GB`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "메모리 세부 수치를 아직 못 읽었어요.";
}

function storageUsageHint(state: OverlayState): string {
  const detail = state.popup.storageDetail;
  if (!detail || detail.usedGb == null || detail.totalGb == null) {
    return "저장공간 상태를 아직 못 읽었어요.";
  }

  return `${detail.usedGb}GB / ${detail.totalGb}GB 사용 중`;
}

function batteryUsageHint(state: OverlayState): string {
  const detail = state.popup.batteryDetail;
  if (!detail) {
    return "배터리 상태를 아직 못 읽었어요.";
  }

  const parts = [
    detail.powerSource ? `전원 ${detail.powerSource}` : null,
    detail.isCharging === null ? null : detail.isCharging ? "충전 중" : "배터리 사용 중",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "배터리 상태를 아직 못 읽었어요.";
}

function formatLoadingDetail(label: string, value: string | null, loading: boolean): string {
  if (value !== null) {
    return `${label}: ${value}`;
  }

  return loading ? `${label}: 로딩 중` : `${label}: 알 수 없음`;
}

function batteryCapacityUsageHint(maxCapacityPercent: number | null | undefined, loading: boolean): string {
  return formatLoadingDetail(
    "최대 성능",
    maxCapacityPercent == null ? null : `${Math.round(maxCapacityPercent)}%`,
    loading,
  );
}

function batteryCycleUsageHint(cycleCount: number | null | undefined, loading: boolean): string {
  return formatLoadingDetail("사이클 수", cycleCount == null ? null : `${cycleCount}`, loading);
}

function batteryTemperatureUsageHint(temperatureCelsius: number | null | undefined, loading: boolean): string {
  return formatLoadingDetail(
    "온도",
    temperatureCelsius == null ? null : `${Math.round(temperatureCelsius * 10) / 10}°C`,
    loading,
  );
}

function isLoadingState(state: OverlayState): boolean {
  if (state.popup.isStale) {
    return false;
  }

  return (
    state.popup.observationMode === "passive" &&
    (!state.popup.observationSourceLabel || state.popup.observationSourceLabel === "waiting-for-agent" || state.popup.observationSourceLabel === "passive-local")
  );
}

function requireElement<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing overlay element: ${id}`);
  }

  return element as unknown as T;
}
