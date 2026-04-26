import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen } from "electron";
import electronUpdater from "electron-updater";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemoCommand, buildDemoRuntime, extractOverlayUrl } from "./demo-runner.js";
import { checkForUpdatesWhenPackaged } from "./updater.js";
import { buildDesktopMenuState, buildTrayTitle } from "./menu.js";
import { calculateBottomRightBounds } from "./window-position.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const { autoUpdater } = electronUpdater;

let mainWindow: BrowserWindow | null = null;
let puppyProcess: ChildProcessWithoutNullStreams | null = null;
let tray: Tray | null = null;
let currentTemplate = "Bori";
let currentProvider = "gemini";

app.disableHardwareAcceleration();
setupIpc();

async function createWindow(): Promise<void> {
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

function setupDesktopControls(hasUpdateConfig: boolean): void {
  const menuState = buildDesktopMenuState(currentProvider);
  const templateSubmenu = menuState.templates.map((template) => ({
    label: template,
    type: "radio" as const,
    checked: template === currentTemplate,
    click: () => {
      currentTemplate = template;
      setupDesktopControls(hasUpdateConfig);
    },
  }));

  const appMenu = Menu.buildFromTemplate([
    {
      label: "Puppy",
      submenu: [
        { label: menuState.statusLabel, enabled: false },
        { label: `템플릿: ${currentTemplate}`, enabled: false },
        { type: "separator" },
        { label: "상태창 보기", click: showStatusWindow },
        { label: "강아지 보이기/숨기기", click: toggleWindowVisibility },
        { label: "강아지 템플릿", submenu: templateSubmenu },
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

  tray.setTitle(buildTrayTitle({ provider: currentProvider, template: currentTemplate }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Puppy", enabled: false },
      { label: menuState.statusLabel, enabled: false },
      { label: `템플릿: ${currentTemplate}`, enabled: false },
      { type: "separator" },
      { label: "상태창 보기", click: showStatusWindow },
      { label: "강아지 보이기/숨기기", click: toggleWindowVisibility },
      { label: "업데이트 확인", enabled: hasUpdateConfig, click: () => void autoUpdater.checkForUpdatesAndNotify() },
      { label: "종료", click: () => app.quit() },
    ]),
  );
}

function setupIpc(): void {
  ipcMain.handle("puppy:get-status", () => ({
    provider: currentProvider,
    template: currentTemplate,
    version: app.getVersion(),
    updateState: app.isPackaged ? "release" : "development",
    visible: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()),
  }));

  ipcMain.handle("puppy:action", async (_event, action: string, value?: string) => {
    if (action === "quit") {
      app.quit();
      return { ok: true };
    }

    if (action === "toggle-window") {
      toggleWindowVisibility();
      return { ok: true };
    }

    if (action === "check-updates") {
      if (app.isPackaged) {
        await autoUpdater.checkForUpdatesAndNotify();
        return { ok: true, message: "업데이트를 확인했어요." };
      }
      return { ok: false, message: "개발 모드에서는 업데이트 확인이 비활성화돼요." };
    }

    if (action === "set-template" && value) {
      currentTemplate = value;
      setupDesktopControls(existsSync(path.join(process.resourcesPath, "app-update.yml")));
      return { ok: true, template: currentTemplate };
    }

    return { ok: false };
  });
}

function showStatusWindow(): void {
  const statusText = [
    `LLM: ${currentProvider}`,
    `템플릿: ${currentTemplate}`,
    `앱 버전: ${app.getVersion()}`,
    `업데이트: ${app.isPackaged ? "릴리스 메타데이터 확인 가능" : "개발 모드에서는 비활성"}`,
    `창 상태: ${mainWindow?.isVisible() ? "보임" : "숨김"}`,
  ].join("\n");

  dialog.showMessageBox({
    type: "info",
    title: "Puppy 상태",
    message: "Puppy 상태",
    detail: statusText,
    buttons: ["확인"],
  }).catch(() => undefined);
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

function toggleWindowVisibility(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  mainWindow.show();
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
