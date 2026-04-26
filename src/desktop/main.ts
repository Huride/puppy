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
  saveGeminiApiKey,
} from "../auth/setup.js";
import { buildAuthSummaryText, buildProviderSummary, shouldShowFirstRunAuth, type DesktopAuthSummary } from "./auth-state.js";
import { buildDemoCommand, buildDemoRuntime, extractOverlayUrl } from "./demo-runner.js";
import { checkForUpdatesWhenPackaged } from "./updater.js";
import { buildDesktopMenuState, buildTrayTitle } from "./menu.js";
import { calculateBottomRightBounds } from "./window-position.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const projectName = path.basename(projectRoot);
const { autoUpdater } = electronUpdater;

let mainWindow: BrowserWindow | null = null;
let puppyProcess: ChildProcessWithoutNullStreams | null = null;
let tray: Tray | null = null;
let currentTemplate = "Bori";
let currentProvider = "gemini";
let companionMode: "active" | "kennel" = "active";
let authWindow: BrowserWindow | null = null;

app.disableHardwareAcceleration();
setupIpc();

async function createWindow(): Promise<void> {
  loadDesktopEnv();
  const windowWidth = 560;
  const windowHeight = 820;
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
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: "Puppy",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const loadingFile = path.join(projectRoot, "dist/src/overlay/index.html");
  await mainWindow.loadFile(loadingFile);
  startDemoSession();
  const hasUpdateConfig = existsSync(path.join(process.resourcesPath, "app-update.yml"));
  setupDesktopControls(hasUpdateConfig);
  void maybeShowFirstRunAuth();
  void checkForUpdatesWhenPackaged(app.isPackaged, async () => {
    await autoUpdater.checkForUpdatesAndNotify();
  }, console.warn, hasUpdateConfig);
}

function startDemoSession(): void {
  const [script, ...args] = buildDemoCommand();
  const runtime = buildDemoRuntime({
    isPackaged: app.isPackaged,
    projectRoot,
    resourcesPath: process.resourcesPath,
    execPath: process.execPath,
  });

  puppyProcess = spawn(runtime.command, [script, ...args], {
    cwd: runtime.cwd,
    env: {
      ...process.env,
      ...runtime.env,
    },
  });

  puppyProcess.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });

  puppyProcess.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    process.stderr.write(text);
    const overlayUrl = extractOverlayUrl(text);
    const providerMatch = text.match(/Puppy LLM:\s*([^\n]+)/);
    if (providerMatch?.[1]) {
      currentProvider = providerMatch[1].trim();
      setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
    }
    if (overlayUrl && mainWindow && !mainWindow.isDestroyed()) {
      void mainWindow.loadURL(overlayUrl);
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
  startDemoSession();
}

function loadDesktopEnv(): void {
  config({ path: getDesktopEnvPath(), override: true });
}

function getDesktopEnvPath(): string {
  return path.join(app.getPath("userData"), ".env.local");
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
  if (!shouldShowFirstRunAuth(summary)) {
    return;
  }

  const result = await dialog.showMessageBox({
    type: "info",
    title: "Puppy 연동 설정",
    message: "Puppy 연동 설정이 필요해요.",
    detail: buildAuthSummaryText(summary),
    buttons: ["Gemini 키 연결", "Codex 로그인", "나중에"],
    defaultId: 0,
    cancelId: 2,
  });

  if (result.response === 0) {
    showGeminiKeyWindow();
  } else if (result.response === 1) {
    await runCodexLogin();
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
      label: "Puppy",
      submenu: [
        { label: menuState.statusLabel, enabled: false },
        { label: `템플릿: ${currentTemplate}`, enabled: false },
        { label: `모드: ${companionMode === "kennel" ? "집 모드" : "활동 모드"}`, enabled: false },
        { type: "separator" },
        { label: "상태창 보기", click: showStatusWindow },
        { label: "집 모드로 보내기", enabled: companionMode !== "kennel", click: () => setCompanionMode("kennel", hasUpdateConfig) },
        { label: "활동 모드로 부르기", enabled: companionMode !== "active", click: () => setCompanionMode("active", hasUpdateConfig) },
        { label: "강아지 템플릿", submenu: templateSubmenu },
        { label: "연동 설정", submenu: buildAuthSubmenu() },
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
    tray.setToolTip("Puppy");
  }

  tray.setTitle(buildTrayTitle({ projectName, provider: currentProvider, template: currentTemplate }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Puppy", enabled: false },
      { label: menuState.statusLabel, enabled: false },
      { label: `템플릿: ${currentTemplate}`, enabled: false },
      { label: `모드: ${companionMode === "kennel" ? "집 모드" : "활동 모드"}`, enabled: false },
      { type: "separator" },
      { label: "상태창 보기", click: showStatusWindow },
      { label: "집 모드로 보내기", enabled: companionMode !== "kennel", click: () => setCompanionMode("kennel", hasUpdateConfig) },
      { label: "활동 모드로 부르기", enabled: companionMode !== "active", click: () => setCompanionMode("active", hasUpdateConfig) },
      { label: "강아지 템플릿", submenu: templateSubmenu },
      { label: "연동 설정", submenu: buildAuthSubmenu() },
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

  ipcMain.handle("puppy:save-gemini-key", async (_event, apiKey: string) => {
    try {
      saveGeminiApiKey(apiKey, app.getPath("userData"));
      restartDemoSession();
      setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
      return { ok: true, message: `Gemini API 키를 저장했어요.\n${getDesktopEnvPath()}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });
}

function buildAuthSubmenu(): Electron.MenuItemConstructorOptions[] {
  return [
    { label: "연동 상태 확인", click: () => void showAuthStatusWindow() },
    { label: "Gemini API 키 등록/교체", click: () => showGeminiKeyWindow() },
    { type: "separator" },
    { label: "Codex 로그인", click: () => void runCodexLogin() },
    { label: "Codex 로그인 상태 확인", click: () => void showCodexStatus() },
    { label: "Antigravity/Gemini 연결 확인", click: () => void showAntigravityStatus() },
    { label: "Gemini Live 테스트", click: () => void runGeminiLiveCheck() },
  ];
}

async function showStatusWindow(): Promise<void> {
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
    title: "Puppy 상태",
    message: "Puppy 상태",
    detail: statusText,
    buttons: ["확인"],
  }).catch(() => undefined);
}

async function showAuthStatusWindow(): Promise<void> {
  const auth = await collectAuthSummary();
  await dialog.showMessageBox({
    type: "info",
    title: "Puppy 연동 상태",
    message: "Puppy 연동 상태",
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
      contents: "Reply with exactly: puppy-auth-ok",
    });
    const text = response.text?.trim() ?? "";
    await dialog.showMessageBox({
      type: text.toLowerCase().includes("puppy-auth-ok") ? "info" : "warning",
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
      : "새 Terminal 창에서 `codex login`을 실행합니다. 인증 후 Puppy 메뉴에서 상태를 다시 확인하세요.",
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
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    return;
  }

  authWindow = new BrowserWindow({
    width: 460,
    height: 360,
    title: "Puppy 연동 설정",
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

  void authWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildGeminiKeyHtml())}`);
}

function buildGeminiKeyHtml(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Puppy 연동 설정</title>
  <style>
    :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202124; }
    body { margin: 0; padding: 24px; background: #f7f8fb; }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 18px; color: #56606d; font-size: 13px; line-height: 1.5; }
    label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #344054; }
    input { width: 100%; height: 40px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; box-sizing: border-box; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    button { height: 34px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 700; cursor: pointer; }
    button.primary { border-color: #2f6fed; background: #2f6fed; color: white; }
    #result { min-height: 36px; margin-top: 14px; color: #344054; font-size: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Gemini API 키 연결</h1>
  <p>키는 이 Mac의 Puppy 설정 파일에만 저장됩니다. 저장 후 현재 Puppy 세션이 새 키로 다시 시작됩니다.</p>
  <form id="form">
    <label for="key">Gemini API Key</label>
    <input id="key" name="key" type="password" autocomplete="off" autofocus placeholder="AIza..." />
    <div class="actions">
      <button type="button" id="close">닫기</button>
      <button type="submit" class="primary">저장</button>
    </div>
  </form>
  <div id="result"></div>
  <script>
    const form = document.getElementById("form");
    const key = document.getElementById("key");
    const close = document.getElementById("close");
    const result = document.getElementById("result");
    close.addEventListener("click", () => window.close());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      result.textContent = "저장 중...";
      const response = await window.puppyDesktop.saveGeminiKey(key.value);
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
    title: "Puppy 정보",
    message: "Puppy",
    detail: "AI coding session companion\n터미널 세션, 컨텍스트, 토큰 ETA, 반복 실패, 리소스 상태를 지켜봅니다.",
    buttons: ["확인"],
  }).catch(() => undefined);
}

function setTemplate(template: string, hasUpdateConfig: boolean): void {
  currentTemplate = template;
  sendOverlayCommand("set-template", template);
  setupDesktopControls(hasUpdateConfig);
}

function setCompanionMode(mode: "active" | "kennel", hasUpdateConfig: boolean): void {
  companionMode = mode;
  sendOverlayCommand(mode === "kennel" ? "enter-kennel" : "exit-kennel");
  setupDesktopControls(hasUpdateConfig);
}

function sendOverlayCommand(command: "enter-kennel" | "exit-kennel" | "set-template", value?: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("puppy:command", command, value);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (puppyProcess && !puppyProcess.killed) {
    puppyProcess.kill();
  }
});
