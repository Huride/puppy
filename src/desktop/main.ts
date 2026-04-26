import { app, BrowserWindow, screen } from "electron";
import electronUpdater from "electron-updater";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemoCommand, buildDemoRuntime, extractOverlayUrl } from "./demo-runner.js";
import { checkForUpdatesWhenPackaged } from "./updater.js";
import { calculateBottomRightBounds } from "./window-position.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const { autoUpdater } = electronUpdater;

let mainWindow: BrowserWindow | null = null;
let puppyProcess: ChildProcessWithoutNullStreams | null = null;

app.disableHardwareAcceleration();

async function createWindow(): Promise<void> {
  const windowWidth = 360;
  const windowHeight = 300;
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
    },
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const loadingFile = path.join(projectRoot, "dist/src/overlay/index.html");
  await mainWindow.loadFile(loadingFile);
  startDemoSession();
  const hasUpdateConfig = existsSync(path.join(process.resourcesPath, "app-update.yml"));
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
    if (overlayUrl && mainWindow && !mainWindow.isDestroyed()) {
      void mainWindow.loadURL(overlayUrl);
    }
  });

  puppyProcess.on("exit", () => {
    puppyProcess = null;
  });
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
