import "../config/env.js";
import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen } from "electron";
import electronUpdater from "electron-updater";
import { GoogleGenAI } from "@google/genai";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import {
  getAntigravityAuthStatus,
  getCodexAuthStatus,
  readGeminiKeyFromEnv,
  saveActiveProvider,
  saveClaudeApiKey,
  saveGeminiApiKey,
  saveOpenAIApiKey,
} from "../auth/setup.js";
import { buildAuthSummaryText, buildProviderSummary, shouldShowFirstRunAuth, type DesktopAuthSummary } from "./auth-state.js";
import { buildDemoCommand, buildDemoRuntime, extractOverlayUrl, shouldRunDemoSession } from "./demo-runner.js";
import { resolveDesktopEnvPath } from "./env-path.js";
import { checkForUpdatesWhenPackaged } from "./updater.js";
import { buildDesktopMenuState, buildTrayTitle } from "./menu.js";
import { buildOverlayCommandScript, getOverlayCommandDelays, type OverlayCommand } from "./overlay-command.js";
import { calculateBottomRightBounds } from "./window-position.js";
import { calculateMovedBounds } from "./window-drag.js";
import { buildWindowShape } from "./window-shape.js";
import { shouldRefreshInteractiveRect } from "./interactive-rect.js";
import { shouldUseInteractiveWindowShape } from "./window-shape-mode.js";
import { classifyPetPointerGesture, getPetPointerZone, type PetPointerZone } from "../overlay/pet-presenter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const projectName = "Pawtrol";
const { autoUpdater } = electronUpdater;
const useInteractiveWindowShape = shouldUseInteractiveWindowShape(app.isPackaged);

let mainWindow: BrowserWindow | null = null;
let puppyProcess: ChildProcessWithoutNullStreams | null = null;
let tray: Tray | null = null;
let currentTemplate = "Bori";
let currentProvider = "gemini";
let companionMode: "active" | "kennel" = "active";
let authWindow: BrowserWindow | null = null;
let statusWindow: BrowserWindow | null = null;
let interactionWindow: BrowserWindow | null = null;
let interactiveRect:
  | {
      left: number;
      top: number;
      right: number;
      bottom: number;
      popupOpen: boolean;
      pet?: { left: number; top: number; right: number; bottom: number } | null;
    }
  | null = null;
let popupVisible = false;
let currentOverlayUrl: string | null = null;
let overlayMetricsTimer: NodeJS.Timeout | null = null;
let mainPointerStart: { x: number; y: number } | null = null;
let mainPointerStartZone: PetPointerZone = "move";
let mainPointerDownAt = 0;
let mainPointerTravel = 0;
let mainPointerLastGlobal: { x: number; y: number } | null = null;
let mainPointerMoving = false;
type LoginProvider = "gemini" | "openai" | "claude" | "codex" | "antigravity";

app.disableHardwareAcceleration();
setupIpc();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  }

  if (statusWindow && !statusWindow.isDestroyed()) {
    statusWindow.show();
    statusWindow.focus();
    statusWindow.moveTop();
  }
});

async function createWindow(): Promise<void> {
  loadDesktopEnv();
  currentOverlayUrl = null;
  const windowWidth = 360;
  const windowHeight = 260;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const bounds = calculateBottomRightBounds({
    width,
    height,
    windowWidth,
    windowHeight,
    margin: 18,
  });

  mainWindow = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: "Pawtrol",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(false);
  if (useInteractiveWindowShape) {
    mainWindow.setShape(buildWindowShape(null, { width: bounds.width, height: bounds.height }));
  }
  installMainMouseBridge();

  await loadOverlayIntoWindow(mainWindow, "companion");
  startOverlayMetricsPolling();
  if (isDesktopCompanionMode()) {
    startCompanionSession();
  } else if (shouldRunDemoSession(app.isPackaged, process.env)) {
    startDemoSession();
  }
  const hasUpdateConfig = existsSync(path.join(process.resourcesPath, "app-update.yml"));
  setupAutoUpdater();
  setupDesktopControls(hasUpdateConfig);
  void maybeShowFirstRunAuth();
  void checkForUpdatesWhenPackaged(app.isPackaged, async () => {
    await autoUpdater.checkForUpdatesAndNotify();
  }, console.warn, hasUpdateConfig);
}

function startDemoSession(): void {
  startOverlaySession("demo");
}

function startCompanionSession(): void {
  startOverlaySession("companion");
}

function startOverlaySession(mode: "demo" | "companion"): void {
  const [script, ...args] = buildDemoCommand(mode);
  const runtime = buildDemoRuntime(
    {
      isPackaged: app.isPackaged,
      projectRoot,
      resourcesPath: process.resourcesPath,
      execPath: process.execPath,
    },
    mode,
  );

  puppyProcess = spawn(runtime.command, [script, ...args], {
    cwd: runtime.cwd,
    env: {
      ...process.env,
      ...runtime.env,
      PAWTROL_ENV_PATH: getDesktopEnvPath(),
    },
  });

  puppyProcess.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });

  puppyProcess.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    process.stderr.write(text);
    const overlayUrl = extractOverlayUrl(text);
    const providerMatch = text.match(/(?:Pawtrol|Puppy) LLM:\s*([^\n]+)/);
    if (providerMatch?.[1]) {
      currentProvider = providerMatch[1].trim();
      setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
    }
    if (overlayUrl && mainWindow && !mainWindow.isDestroyed()) {
      currentOverlayUrl = overlayUrl;
      void loadOverlayIntoWindow(mainWindow, "companion");
      if (statusWindow && !statusWindow.isDestroyed()) {
        void loadOverlayIntoWindow(statusWindow, "status");
      }
    }
  });

  puppyProcess.on("exit", () => {
    puppyProcess = null;
  });
}

function restartDemoSession(): void {
  if (puppyProcess && !puppyProcess.killed) {
    puppyProcess.kill();
  }
  puppyProcess = null;
  if (isDesktopCompanionMode()) {
    startCompanionSession();
    return;
  }
  if (!shouldRunDemoSession(app.isPackaged, process.env)) {
    return;
  }
  startDemoSession();
}

function loadDesktopEnv(): void {
  config({ path: getDesktopEnvPath(), override: true });
}

function getDesktopEnvPath(): string {
  return resolveDesktopEnvPath(app.getPath("userData"), process.env);
}

function getDesktopEnvDirectory(): string {
  return path.dirname(getDesktopEnvPath());
}

function isDesktopCompanionMode(): boolean {
  return process.env.PAWTROL_DESKTOP_COMPANION === "1";
}

function forceSetupRequested(): boolean {
  return process.env.PAWTROL_FORCE_SETUP === "1";
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Pawtrol 업데이트",
        message: "새 Pawtrol 업데이트가 준비됐어요.",
        detail: "지금 재시작하면 업데이트를 설치합니다.",
        buttons: ["재시작 후 설치", "나중에"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      })
      .catch(() => undefined);
  });
}

async function collectAuthSummary(): Promise<DesktopAuthSummary> {
  const codex = await getCodexAuthStatus();
  const antigravity = await getAntigravityAuthStatus();
  const provider = buildProviderSummary(process.env);
  return {
    geminiConfigured: Boolean(readGeminiKeyFromEnv()),
    codex,
    antigravity,
    provider: provider.provider,
    recommendedModel: provider.recommendedModel,
    envPath: getDesktopEnvPath(),
  };
}

async function maybeShowFirstRunAuth(): Promise<void> {
  const summary = await collectAuthSummary();
  if (forceSetupRequested()) {
    showLoginWindow();
    return;
  }

  if (!shouldShowFirstRunAuth(summary)) {
    return;
  }

  const result = await dialog.showMessageBox({
    type: "info",
    title: "Pawtrol 연동 설정",
    message: "Pawtrol 연동 설정이 필요해요.",
    detail: buildAuthSummaryText(summary),
    buttons: ["로그인/연동하기", "나중에"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    showLoginWindow();
  }
}

function setupDesktopControls(hasUpdateConfig: boolean): void {
  const menuState = buildDesktopMenuState(currentProvider);
  const templateSubmenu = menuState.templates.map((template) => ({
    label: template,
    type: "radio" as const,
    checked: template === currentTemplate,
    click: () => {
      setTemplate(template, hasUpdateConfig);
    },
  }));

  const appMenu = Menu.buildFromTemplate([
    {
      label: "Pawtrol",
      submenu: [
        { label: menuState.statusLabel, enabled: false },
        { label: `템플릿: ${currentTemplate}`, enabled: false },
        { label: `모드: ${companionMode === "kennel" ? "집 모드" : "활동 모드"}`, enabled: false },
        { type: "separator" },
        { label: "상태창 보기", click: showStatusWindowPanel },
        { label: "집 모드로 보내기", enabled: companionMode !== "kennel", click: () => setCompanionMode("kennel", hasUpdateConfig) },
        { label: "활동 모드로 부르기", enabled: companionMode !== "active", click: () => setCompanionMode("active", hasUpdateConfig) },
        { label: "강아지 템플릿", submenu: templateSubmenu },
        { label: "로그인/연동", click: () => showLoginWindow() },
        { type: "separator" },
        {
          label: "업데이트 확인",
          enabled: hasUpdateConfig,
          click: () => {
            void autoUpdater.checkForUpdatesAndNotify();
          },
        },
        { label: "앱 정보", click: showAbout },
        { type: "separator" },
        { label: "종료", click: () => app.quit() },
      ],
    },
  ]);

  Menu.setApplicationMenu(appMenu);

  if (!tray) {
    const trayIcon = nativeImage.createEmpty();
    tray = new Tray(trayIcon);
    tray.setToolTip("Pawtrol");
  }

  tray.setTitle(buildTrayTitle({ projectName, provider: currentProvider, template: currentTemplate }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Pawtrol", enabled: false },
      { label: menuState.statusLabel, enabled: false },
      { label: `템플릿: ${currentTemplate}`, enabled: false },
      { label: `모드: ${companionMode === "kennel" ? "집 모드" : "활동 모드"}`, enabled: false },
      { type: "separator" },
      { label: "상태창 보기", click: showStatusWindowPanel },
      { label: "집 모드로 보내기", enabled: companionMode !== "kennel", click: () => setCompanionMode("kennel", hasUpdateConfig) },
      { label: "활동 모드로 부르기", enabled: companionMode !== "active", click: () => setCompanionMode("active", hasUpdateConfig) },
      { label: "강아지 템플릿", submenu: templateSubmenu },
      { label: "로그인/연동", click: () => showLoginWindow() },
      { label: "업데이트 확인", enabled: hasUpdateConfig, click: () => void autoUpdater.checkForUpdatesAndNotify() },
      { label: "종료", click: () => app.quit() },
    ]),
  );
}

function setupIpc(): void {
  ipcMain.handle("puppy:set-mode", (_event, mode: "active" | "kennel") => {
    companionMode = mode;
    setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
    return { ok: true };
  });

  ipcMain.handle("puppy:open-status-window", () => {
    console.log("[pawtrol] ipc open-status-window");
    toggleStatusWindowPanel();
    return { ok: true };
  });

  ipcMain.handle("puppy:close-status-window", () => {
    console.log("[pawtrol] ipc close-status-window");
    closeStatusWindowPanel();
    return { ok: true };
  });

  ipcMain.handle("puppy:move-window", (_event, deltaX: number, deltaY: number) => {
    if (!mainWindow || mainWindow.isDestroyed() || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      return { ok: false };
    }

    const current = mainWindow.getBounds();
    const display = screen.getDisplayMatching(current);
    const next = calculateMovedBounds({
      current,
      delta: { x: deltaX, y: deltaY },
      workArea: display.workArea,
    });
    mainWindow.setBounds(next, false);
    updateInteractionWindow();
    return { ok: true };
  });

  ipcMain.handle("puppy:set-mouse-passthrough", (_event, enabled: boolean) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(false);
    }
    return { ok: true };
  });

  ipcMain.handle("puppy:set-popup-visible", (_event, visible: boolean) => {
    console.log(`[pawtrol] popup visible -> ${visible}`);
    popupVisible = visible;
    if (visible) {
      showStatusWindowPanel();
    } else {
      closeStatusWindowPanel();
    }
    return { ok: true };
  });

  ipcMain.handle("puppy:set-interactive-rect", (_event, rect: typeof interactiveRect) => {
    interactiveRect = isValidInteractiveRect(rect) ? rect : null;
    if (interactiveRect) {
      console.log(
        `[pawtrol] interactive rect popup=${interactiveRect.popupOpen} rect=${interactiveRect.left},${interactiveRect.top},${interactiveRect.right},${interactiveRect.bottom} pet=${
          interactiveRect.pet
            ? `${interactiveRect.pet.left},${interactiveRect.pet.top},${interactiveRect.pet.right},${interactiveRect.pet.bottom}`
            : "none"
        }`,
      );
    } else {
      console.log("[pawtrol] interactive rect cleared");
    }
    resizeWindowToInteractiveRect();
    updateInteractionWindow();
    return { ok: true };
  });

  ipcMain.handle("puppy:interaction", (_event, action: string, payload?: Record<string, unknown> | null) => {
    if (action === "open-status") {
      console.log("[pawtrol] interaction open-status");
      toggleStatusWindowPanel();
      return { ok: true };
    }

    if (action === "move-window") {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { ok: false };
      }

      const deltaX = Number(payload?.deltaX ?? 0);
      const deltaY = Number(payload?.deltaY ?? 0);
      if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
        return { ok: false };
      }

      const current = mainWindow.getBounds();
      const display = screen.getDisplayMatching(current);
      const next = calculateMovedBounds({
        current,
        delta: { x: deltaX, y: deltaY },
        workArea: display.workArea,
      });
      mainWindow.setBounds(next, false);
      updateInteractionWindow();
      return { ok: true };
    }

    if (action === "enter-kennel") {
      companionMode = "kennel";
      sendOverlayCommand("enter-kennel");
      updateInteractionWindow();
      setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
      return { ok: true };
    }

    if (action === "petting") {
      sendOverlayCommand("petting");
      return { ok: true };
    }

    return { ok: false };
  });

  ipcMain.handle("puppy:save-gemini-key", async (_event, apiKey: string) => {
    try {
      saveGeminiApiKey(apiKey, getDesktopEnvDirectory());
      restartDemoSession();
      setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
      return { ok: true, message: `Gemini API 키를 저장했어요.\n${getDesktopEnvPath()}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("puppy:login-provider", async (_event, provider: LoginProvider, apiKey: string) => {
    try {
      const message = await saveProviderLogin(provider, apiKey);
      restartDemoSession();
      setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
      return { ok: true, message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });
}

async function showStatusDialog(): Promise<void> {
  const auth = await collectAuthSummary();
  const statusText = [
    `LLM: ${currentProvider}`,
    `템플릿: ${currentTemplate}`,
    `앱 버전: ${app.getVersion()}`,
    `업데이트: ${app.isPackaged ? "릴리스 메타데이터 확인 가능" : "개발 모드에서는 비활성"}`,
    `모드: ${companionMode === "kennel" ? "집 모드" : "활동 모드"}`,
    "",
    buildAuthSummaryText(auth),
  ].join("\n");

  dialog.showMessageBox({
    type: "info",
    title: "Pawtrol 상태",
    message: "Pawtrol 상태",
    detail: statusText,
    buttons: ["확인"],
  }).catch(() => undefined);
}

async function showAuthStatusWindow(): Promise<void> {
  const auth = await collectAuthSummary();
  await dialog.showMessageBox({
    type: "info",
    title: "Pawtrol 연동 상태",
    message: "Pawtrol 연동 상태",
    detail: buildAuthSummaryText(auth),
    buttons: ["확인"],
  });
}

async function showCodexStatus(): Promise<void> {
  const status = await getCodexAuthStatus();
  await dialog.showMessageBox({
    type: status.authenticated ? "info" : "warning",
    title: "Codex 로그인 상태",
    message: `Codex auth: ${status.authenticated ? "authenticated" : "missing"}`,
    detail: [`CLI: ${status.installed ? "installed" : "missing"}`, status.detail].join("\n"),
    buttons: ["확인"],
  });
}

async function showAntigravityStatus(): Promise<void> {
  const status = await getAntigravityAuthStatus();
  await dialog.showMessageBox({
    type: status.authenticated ? "info" : "warning",
    title: "Antigravity/Gemini 연결 상태",
    message: `Antigravity/Gemini auth: ${status.authenticated ? "ready" : "missing"}`,
    detail: [
      `Command: ${status.installedCommand ?? "missing"}`,
      `Gemini API key: ${status.apiKeyConfigured ? "configured" : "missing"}`,
      status.detail,
    ].join("\n"),
    buttons: ["확인"],
  });
}

async function runGeminiLiveCheck(): Promise<void> {
  const apiKey = readGeminiKeyFromEnv();
  if (!apiKey) {
    showGeminiKeyWindow();
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Reply with exactly: pawtrol-auth-ok",
    });
    const text = response.text?.trim() ?? "";
    await dialog.showMessageBox({
      type: text.toLowerCase().includes("pawtrol-auth-ok") ? "info" : "warning",
      title: "Gemini Live 테스트",
      message: "Gemini Live 테스트 결과",
      detail: text || "응답 텍스트가 비어 있어요.",
      buttons: ["확인"],
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "Gemini Live 테스트 실패",
      message: "Gemini API 요청이 실패했어요.",
      detail: error instanceof Error ? error.message : String(error),
      buttons: ["확인"],
    });
  }
}

async function runCodexLogin(): Promise<void> {
  const status = await getCodexAuthStatus();
  if (!status.installed) {
    await showCodexStatus();
    return;
  }

  const result = await dialog.showMessageBox({
    type: "info",
    title: "Codex 로그인",
    message: status.authenticated ? "Codex가 이미 로그인되어 있어요." : "터미널에서 Codex 로그인을 시작할까요?",
    detail: status.authenticated
      ? status.detail
      : "새 Terminal 창에서 `codex login`을 실행합니다. 인증 후 Pawtrol 메뉴에서 상태를 다시 확인하세요.",
    buttons: status.authenticated ? ["확인"] : ["Terminal에서 로그인", "취소"],
    defaultId: 0,
    cancelId: status.authenticated ? 0 : 1,
  });

  if (!status.authenticated && result.response === 0) {
    spawn("osascript", ["-e", 'tell application "Terminal" to do script "codex login"'], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }
}

function showGeminiKeyWindow(): void {
  showLoginWindow();
}

function showLoginWindow(): void {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    return;
  }

  authWindow = new BrowserWindow({
    width: 460,
    height: 360,
    title: "Pawtrol 연동 설정",
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow ?? undefined,
    modal: Boolean(mainWindow),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  authWindow.on("closed", () => {
    authWindow = null;
  });

  void authWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildLoginHtml())}`);
}

async function saveProviderLogin(provider: LoginProvider, apiKey: string): Promise<string> {
  if (provider === "gemini") {
    const envPath = saveGeminiApiKey(apiKey, getDesktopEnvDirectory());
    currentProvider = "gemini";
    return `Gemini로 로그인했어요.\nLLM: gemini\nModel: gemini-3-flash-preview\n${envPath}`;
  }

  if (provider === "openai") {
    const envPath = saveOpenAIApiKey(apiKey, getDesktopEnvDirectory());
    currentProvider = "openai";
    return `OpenAI로 로그인했어요.\nLLM: openai\nModel: gpt-5.4-mini\n${envPath}`;
  }

  if (provider === "claude") {
    const envPath = saveClaudeApiKey(apiKey, getDesktopEnvDirectory());
    currentProvider = "claude";
    return `Claude로 로그인했어요.\nLLM: claude\nModel: claude-sonnet-4-6\n${envPath}`;
  }

  if (provider === "antigravity") {
    const envPath = saveGeminiApiKey(apiKey, getDesktopEnvDirectory());
    currentProvider = "gemini";
    return `Antigravity/Gemini 방식으로 로그인했어요.\nLLM: gemini\nModel: gemini-3-flash-preview\n${envPath}`;
  }

  await runCodexLogin();
  const activeProvider = "codex";
  const envPath = saveActiveProvider(activeProvider, getDesktopEnvDirectory());
  currentProvider = activeProvider;
  return `Codex 로그인 흐름을 열었어요.\nLLM: codex\nModel: codex-auth\n${envPath}`;
}

function buildLoginHtml(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pawtrol 로그인</title>
  <style>
    :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202124; }
    body { margin: 0; padding: 24px; background: #f7f8fb; }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 18px; color: #56606d; font-size: 13px; line-height: 1.5; }
    label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #344054; }
    input, select { width: 100%; height: 40px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; box-sizing: border-box; background: #fff; }
    .field { margin-top: 14px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    button { height: 34px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 700; cursor: pointer; }
    button.primary { border-color: #2f6fed; background: #2f6fed; color: white; }
    #result { min-height: 36px; margin-top: 14px; color: #344054; font-size: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Pawtrol 로그인</h1>
  <p>하나의 방식만 고르면 Pawtrol이 해당 로그인에 맞는 LLM을 자동으로 사용합니다. API 키는 이 Mac의 Pawtrol 설정 파일에만 저장됩니다.</p>
  <form id="form">
    <label for="provider">로그인 방식</label>
    <select id="provider" name="provider" autofocus>
      <option value="gemini">Gemini API</option>
      <option value="openai">OpenAI API</option>
      <option value="claude">Claude API</option>
      <option value="codex">Codex CLI 로그인</option>
      <option value="antigravity">Antigravity (Gemini auth)</option>
    </select>
    <div class="field" id="keyField">
      <label for="key" id="keyLabel">API Key</label>
      <input id="key" name="key" type="password" autocomplete="off" placeholder="AIza..." />
    </div>
    <div class="actions">
      <button type="button" id="close">닫기</button>
      <button type="submit" class="primary">로그인</button>
    </div>
  </form>
  <div id="result"></div>
  <script>
    const form = document.getElementById("form");
    const provider = document.getElementById("provider");
    const key = document.getElementById("key");
    const keyField = document.getElementById("keyField");
    const keyLabel = document.getElementById("keyLabel");
    const close = document.getElementById("close");
    const result = document.getElementById("result");
    const placeholders = {
      gemini: "AIza...",
      openai: "sk-...",
      claude: "sk-ant-...",
      antigravity: "AIza..."
    };
    function syncProvider() {
      const needsKey = provider.value !== "codex";
      keyField.style.display = needsKey ? "block" : "none";
      key.required = needsKey;
      key.placeholder = placeholders[provider.value] || "";
      keyLabel.textContent = provider.value === "claude" ? "Anthropic API Key" : provider.value === "openai" ? "OpenAI API Key" : "Gemini API Key";
      result.textContent = "";
    }
    provider.addEventListener("change", syncProvider);
    syncProvider();
    close.addEventListener("click", () => window.close());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      result.textContent = "로그인 처리 중...";
      const response = await window.puppyDesktop.loginProvider(provider.value, key.value);
      result.textContent = response.message;
      if (response.ok) {
        key.value = "";
      }
    });
  </script>
</body>
</html>`;
}

function showAbout(): void {
  dialog.showMessageBox({
    type: "info",
    title: "Pawtrol 정보",
    message: "Pawtrol",
    detail: "Paw + Patrol. 당신의 AI 코딩 세션을 지켜보는 보리(Bori)입니다.\n터미널 세션, 컨텍스트, 토큰 ETA, 반복 실패, 리소스 상태를 순찰합니다.",
    buttons: ["확인"],
  }).catch(() => undefined);
}

function setTemplate(template: string, hasUpdateConfig: boolean): void {
  currentTemplate = template;
  sendOverlayCommand("set-template", template);
  void loadOverlayIntoWindow(mainWindow, "companion");
  void loadOverlayIntoWindow(statusWindow, "status");
  setupDesktopControls(hasUpdateConfig);
}

function setCompanionMode(mode: "active" | "kennel", hasUpdateConfig: boolean): void {
  companionMode = mode;
  sendOverlayCommand(mode === "kennel" ? "enter-kennel" : "exit-kennel");
  updateInteractionWindow();
  setupDesktopControls(hasUpdateConfig);
}

function sendOverlayCommand(command: OverlayCommand, value?: string): void {
  if ((!mainWindow || mainWindow.isDestroyed()) && (!statusWindow || statusWindow.isDestroyed())) {
    return;
  }

  for (const delay of getOverlayCommandDelays()) {
    setTimeout(() => {
      const targets = [mainWindow, statusWindow].filter((window): window is BrowserWindow => Boolean(window && !window.isDestroyed()));
      if (targets.length === 0) {
        return;
      }

      for (const window of targets) {
        window.webContents.send("puppy:command", command, value);
        void window.webContents.executeJavaScript(buildOverlayCommandScript(command, value), true).catch(() => undefined);
      }
    }, delay);
  }
}

function resizeWindowToInteractiveRect(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (!interactiveRect) {
    applyWindowShape();
    return;
  }

  const current = mainWindow.getBounds();
  const display = screen.getDisplayMatching(current);
  const right = current.x + current.width;
  const bottom = current.y + current.height;
  const contentWidth = Math.ceil(interactiveRect.right - interactiveRect.left);
  const contentHeight = Math.ceil(interactiveRect.bottom - interactiveRect.top);
  const popupMaxHeight = Math.max(320, display.workArea.height - 8);
  const targetWidth = clamp(interactiveRect.popupOpen ? 620 : contentWidth + 36, 260, 680);
  const targetHeight = clamp(interactiveRect.popupOpen ? popupMaxHeight : contentHeight + 28, 200, popupMaxHeight);
  const targetRight = interactiveRect.popupOpen ? display.workArea.x + display.workArea.width - 18 : right;
  const targetBottom = interactiveRect.popupOpen ? display.workArea.y + display.workArea.height - 18 : bottom;
  const next = {
    x: clamp(targetRight - targetWidth, display.workArea.x, display.workArea.x + display.workArea.width - targetWidth),
    y: clamp(targetBottom - targetHeight, display.workArea.y, display.workArea.y + display.workArea.height - targetHeight),
    width: targetWidth,
    height: targetHeight,
  };

  if (
    Math.abs(current.x - next.x) > 1 ||
    Math.abs(current.y - next.y) > 1 ||
    Math.abs(current.width - next.width) > 1 ||
    Math.abs(current.height - next.height) > 1
  ) {
    applyWindowBounds(next);
  }

  applyWindowShape();
}

function applyWindowBounds(bounds: { x: number; y: number; width: number; height: number }): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.setResizable(true);
  mainWindow.setSize(bounds.width, bounds.height, false);
  mainWindow.setPosition(bounds.x, bounds.y, false);
  mainWindow.setBounds(bounds, false);
  updateInteractionWindow();
}

function applyWindowShape(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !useInteractiveWindowShape) {
    return;
  }

  const bounds = mainWindow.getBounds();
  mainWindow.setShape(buildWindowShape(interactiveRect, { width: bounds.width, height: bounds.height }));
}

function startOverlayMetricsPolling(): void {
  stopOverlayMetricsPolling();
  overlayMetricsTimer = setInterval(() => {
    void refreshInteractiveRectFromDom();
  }, 350);
}

function stopOverlayMetricsPolling(): void {
  if (overlayMetricsTimer) {
    clearInterval(overlayMetricsTimer);
    overlayMetricsTimer = null;
  }
}

async function refreshInteractiveRectFromDom(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    const next = await mainWindow.webContents.executeJavaScript(
      `(() => {
        const hidden = (element) => !element || element.classList.contains("hidden");
        const rectOf = (element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        };
        const pet = document.getElementById("pet");
        const popup = document.getElementById("popup");
        const bubble = document.getElementById("bubble");
        const kennel = document.getElementById("kennel");
        const petRect = pet && !hidden(pet) ? rectOf(pet) : null;
        const visible = [pet, popup, kennel].filter((element) => element && !hidden(element)).map(rectOf);
        if (bubble && !hidden(bubble) && (!popup || hidden(popup))) {
          visible.push(rectOf(bubble));
        }
        if (visible.length === 0) {
          return null;
        }
        const padding = 10;
        return {
          left: Math.min(...visible.map((rect) => rect.left)) - padding,
          top: Math.min(...visible.map((rect) => rect.top)) - padding,
          right: Math.max(...visible.map((rect) => rect.right)) + padding,
          bottom: Math.max(...visible.map((rect) => rect.bottom)) + padding,
          popupOpen: !!(popup && !hidden(popup)),
          pet: petRect,
        };
      })()`,
      true,
    );

    const nextRect = isValidInteractiveRect(next) ? next : null;
    if (shouldRefreshInteractiveRect(interactiveRect, nextRect)) {
      interactiveRect = nextRect;
      if (interactiveRect) {
        console.log(
          `[pawtrol] dom rect popup=${interactiveRect.popupOpen} rect=${interactiveRect.left},${interactiveRect.top},${interactiveRect.right},${interactiveRect.bottom} pet=${
            interactiveRect.pet
              ? `${interactiveRect.pet.left},${interactiveRect.pet.top},${interactiveRect.pet.right},${interactiveRect.pet.bottom}`
              : "none"
          }`,
        );
      } else {
        console.log("[pawtrol] dom rect cleared");
      }
      resizeWindowToInteractiveRect();
      updateInteractionWindow();
    }
  } catch {
    // Ignore while the overlay is reloading.
  }
}

function updateInteractionWindow(): void {
  closeInteractionWindow();
}

function closeInteractionWindow(): void {
  if (interactionWindow && !interactionWindow.isDestroyed()) {
    interactionWindow.close();
  }
  interactionWindow = null;
}

function installMainMouseBridge(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.on("before-mouse-event", (event, mouse) => {
    const petRect = interactiveRect?.pet;
    if (!petRect || companionMode !== "active") {
      if (mouse.type === "mouseUp" || mouse.type === "mouseLeave") {
        resetMainPointerGesture();
      }
      return;
    }

    const point = { x: mouse.x, y: mouse.y };
    const insidePet =
      point.x >= petRect.left &&
      point.x <= petRect.right &&
      point.y >= petRect.top &&
      point.y <= petRect.bottom;

    if (mouse.type === "mouseDown" && mouse.button === "left" && insidePet) {
      mainPointerStart = point;
      mainPointerStartZone = getPetPointerZone(point, {
        left: petRect.left,
        top: petRect.top,
        width: petRect.right - petRect.left,
        height: petRect.bottom - petRect.top,
      });
      mainPointerDownAt = Date.now();
      mainPointerTravel = 0;
      mainPointerLastGlobal =
        Number.isFinite(mouse.globalX) && Number.isFinite(mouse.globalY) ? { x: mouse.globalX ?? 0, y: mouse.globalY ?? 0 } : null;
      mainPointerMoving = false;
      event.preventDefault();
      return;
    }

    if (!mainPointerStart) {
      return;
    }

    mainPointerTravel = Math.max(mainPointerTravel, Math.hypot(point.x - mainPointerStart.x, point.y - mainPointerStart.y));
    const gesture = classifyPetPointerGesture(mainPointerStart, point, mainPointerStartZone);

    if (mouse.type === "mouseMove") {
      if (popupVisible) {
        event.preventDefault();
        return;
      }

      if (!mainPointerMoving && gesture !== "move") {
        event.preventDefault();
        return;
      }

      mainPointerMoving = true;
      const previous = mainPointerLastGlobal;
      const currentGlobal =
        Number.isFinite(mouse.globalX) && Number.isFinite(mouse.globalY) ? { x: mouse.globalX ?? 0, y: mouse.globalY ?? 0 } : previous;
      if (previous && currentGlobal) {
        const deltaX = currentGlobal.x - previous.x;
        const deltaY = currentGlobal.y - previous.y;
        if ((deltaX !== 0 || deltaY !== 0) && mainWindow && !mainWindow.isDestroyed()) {
          const current = mainWindow.getBounds();
          const display = screen.getDisplayMatching(current);
          const next = calculateMovedBounds({
            current,
            delta: { x: deltaX, y: deltaY },
            workArea: display.workArea,
          });
          mainWindow.setBounds(next, false);
        }
      }
      mainPointerLastGlobal = currentGlobal;
      event.preventDefault();
      return;
    }

    if (mouse.type === "mouseUp" && mouse.button === "left") {
      const quickTap =
        Date.now() - mainPointerDownAt < 320 &&
        mainPointerTravel < 12 &&
        insidePet;

      if (quickTap) {
        console.log("[pawtrol] main mouse tap -> status");
        toggleStatusWindowPanel();
      } else if (!popupVisible && gesture === "kennel") {
        console.log("[pawtrol] main mouse gesture -> kennel");
        companionMode = "kennel";
        sendOverlayCommand("enter-kennel");
        setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
      } else if (!popupVisible && gesture === "petting") {
        console.log("[pawtrol] main mouse gesture -> petting");
        sendOverlayCommand("petting");
      }

      resetMainPointerGesture();
      event.preventDefault();
    }
  });
}

function resetMainPointerGesture(): void {
  mainPointerStart = null;
  mainPointerStartZone = "move";
  mainPointerDownAt = 0;
  mainPointerTravel = 0;
  mainPointerLastGlobal = null;
  mainPointerMoving = false;
}

function normalizeDesktopTemplate(template: string): "bori" | "nabi" | "mochi" {
  const normalized = template.toLowerCase();
  if (normalized === "nabi" || normalized === "mochi") {
    return normalized;
  }

  return "bori";
}

function buildOverlayViewUrl(baseUrl: string, view: "companion" | "status"): string {
  const next = new URL(baseUrl);
  next.searchParams.set("view", view);
  next.searchParams.set("template", normalizeDesktopTemplate(currentTemplate));
  return next.toString();
}

async function loadOverlayIntoWindow(window: BrowserWindow | null, view: "companion" | "status"): Promise<void> {
  if (!window || window.isDestroyed()) {
    return;
  }

  const socketUrl = currentOverlayUrl ? new URL(currentOverlayUrl).toString() : "";
  console.log(
    `[pawtrol] loadOverlayIntoWindow view=${view} page=file://dist/src/overlay/index.html socket=${socketUrl || "none"}`,
  );

  await window.loadFile(path.join(projectRoot, "dist/src/overlay/index.html"), {
    query: {
      view,
      template: normalizeDesktopTemplate(currentTemplate),
      socket: socketUrl,
    },
  });
}

function showStatusWindowPanel(): void {
  if (statusWindow && !statusWindow.isDestroyed()) {
    console.log("[pawtrol] focusing existing status window");
    popupVisible = true;
    notifyPopupVisibilityChanged(true);
    updateInteractionWindow();
    statusWindow.show();
    statusWindow.focus();
    statusWindow.moveTop();
    return;
  }

  const display = screen.getDisplayMatching(mainWindow?.getBounds() ?? screen.getPrimaryDisplay().bounds);
  const width = Math.min(560, Math.max(460, display.workArea.width - 48));
  const height = Math.min(720, Math.max(540, display.workArea.height - 260));
  statusWindow = new BrowserWindow({
    x: display.workArea.x + display.workArea.width - width - 18,
    y: display.workArea.y + 28,
    width,
    height,
    frame: true,
    transparent: false,
    backgroundColor: "#272e3a",
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    focusable: true,
    title: "Pawtrol Status",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  console.log("[pawtrol] created status window");
  statusWindow.setAlwaysOnTop(true, "floating");
  statusWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  statusWindow.setMenuBarVisibility(false);
  statusWindow.setMinimumSize(460, 540);
  statusWindow.show();
  statusWindow.focus();
  statusWindow.moveTop();
  statusWindow.once("ready-to-show", () => {
    if (!statusWindow || statusWindow.isDestroyed()) {
      return;
    }

    console.log("[pawtrol] status window ready-to-show");
    statusWindow.show();
    statusWindow.focus();
    statusWindow.moveTop();
  });
  statusWindow.webContents.on("did-finish-load", () => {
    if (!statusWindow || statusWindow.isDestroyed()) {
      return;
    }

    console.log("[pawtrol] status window did-finish-load");
    statusWindow.show();
    statusWindow.focus();
    statusWindow.moveTop();
  });
  statusWindow.on("closed", () => {
    console.log("[pawtrol] status window closed");
    statusWindow = null;
    popupVisible = false;
    notifyPopupVisibilityChanged(false);
    updateInteractionWindow();
  });

  popupVisible = true;
  void loadOverlayIntoWindow(statusWindow, "status");
  notifyPopupVisibilityChanged(true);
  updateInteractionWindow();
}

function toggleStatusWindowPanel(): void {
  if (statusWindow && !statusWindow.isDestroyed() && statusWindow.isVisible()) {
    closeStatusWindowPanel();
    return;
  }

  showStatusWindowPanel();
}

function closeStatusWindowPanel(): void {
  if (statusWindow && !statusWindow.isDestroyed()) {
    statusWindow.hide();
  }
  popupVisible = false;
  notifyPopupVisibilityChanged(false);
  updateInteractionWindow();
}

function notifyPopupVisibilityChanged(visible: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("puppy:popup-visibility", visible);
}

function isValidInteractiveRect(rect: typeof interactiveRect): rect is NonNullable<typeof interactiveRect> {
  return (
    rect !== null &&
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.bottom) &&
    rect.right >= rect.left &&
    rect.bottom >= rect.top &&
    (rect.pet == null ||
      (Number.isFinite(rect.pet.left) &&
        Number.isFinite(rect.pet.top) &&
        Number.isFinite(rect.pet.right) &&
        Number.isFinite(rect.pet.bottom) &&
        rect.pet.right >= rect.pet.left &&
        rect.pet.bottom >= rect.pet.top)) &&
    typeof rect.popupOpen === "boolean"
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

if (hasSingleInstanceLock) {
  app.whenReady().then(createWindow);
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  stopOverlayMetricsPolling();
  if (puppyProcess && !puppyProcess.killed) {
    puppyProcess.kill();
  }
  closeInteractionWindow();
});

function buildInteractionHtml(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.001);
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    body.dragging {
      cursor: grabbing;
    }
  </style>
</head>
<body>
  <script>
    let start = null;
    let startZone = "move";
    let lastScreen = null;
    let downAt = 0;
    let travel = 0;
    let moving = false;

    function getZone(point, rect) {
      const localX = point.x / rect.width;
      const localY = point.y / rect.height;
      const centeredBodyX = localX >= 0.32 && localX <= 0.76;
      const centeredBodyY = localY >= 0.46 && localY <= 0.82;
      return centeredBodyX && centeredBodyY ? "body" : "move";
    }

    function classify(startPoint, endPoint, zone) {
      if (!startPoint) return "none";
      const deltaX = endPoint.x - startPoint.x;
      const deltaY = endPoint.y - startPoint.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const kennelVerticalSlack = Math.max(22, Math.min(42, Math.round(absX * 0.55)));
      const mostlyHorizontal = absY <= kennelVerticalSlack;
      const distance = Math.hypot(deltaX, deltaY);
      if (mostlyHorizontal && deltaX >= 58) return "kennel";
      if (zone === "move") return distance >= 16 ? "move" : "none";
      const pettingVerticalSlack = Math.max(14, Math.min(32, Math.round(absX * 0.55)));
      if (absX >= 12 && absX < 54 && absY <= pettingVerticalSlack) return "petting";
      if (distance >= 16) return "move";
      return "none";
    }

    window.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY };
      startZone = getZone(start, { width: window.innerWidth, height: window.innerHeight });
      lastScreen = { x: event.screenX, y: event.screenY };
      downAt = Date.now();
      travel = 0;
      moving = false;
      document.body.classList.remove("dragging");
    });

    window.addEventListener("pointermove", (event) => {
      if (!start) return;
      travel = Math.max(travel, Math.hypot(event.clientX - start.x, event.clientY - start.y));
      const gesture = classify(start, { x: event.clientX, y: event.clientY }, startZone);
      if (!moving && gesture !== "move") return;
      moving = true;
      document.body.classList.add("dragging");
      const previous = lastScreen || { x: event.screenX, y: event.screenY };
      const deltaX = event.screenX - previous.x;
      const deltaY = event.screenY - previous.y;
      lastScreen = { x: event.screenX, y: event.screenY };
      if (deltaX !== 0 || deltaY !== 0) {
        window.puppyDesktop?.sendInteraction("move-window", { deltaX, deltaY });
      }
    });

    window.addEventListener("pointerup", (event) => {
      if (event.button !== 0) return;
      const tap = downAt > 0 && Date.now() - downAt < 320 && travel < 12;
      const gesture = classify(start, { x: event.clientX, y: event.clientY }, startZone);
      if (tap) {
        window.puppyDesktop?.sendInteraction("open-status");
      } else if (gesture === "kennel") {
        window.puppyDesktop?.sendInteraction("enter-kennel");
      } else if (gesture === "petting") {
        window.puppyDesktop?.sendInteraction("petting");
      }
      start = null;
      startZone = "move";
      lastScreen = null;
      downAt = 0;
      travel = 0;
      moving = false;
      document.body.classList.remove("dragging");
    });

    window.addEventListener("pointercancel", () => {
      start = null;
      startZone = "move";
      lastScreen = null;
      downAt = 0;
      travel = 0;
      moving = false;
      document.body.classList.remove("dragging");
    });
  </script>
</body>
</html>`;
}
