import { contextBridge, ipcRenderer } from "electron";

type InteractiveRectPayload = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  popupOpen: boolean;
  pet?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null;
} | null;

contextBridge.exposeInMainWorld("puppyDesktop", {
  setMode: (mode: "active" | "kennel") => ipcRenderer.invoke("puppy:set-mode", mode),
  openStatusWindow: () => ipcRenderer.invoke("puppy:open-status-window"),
  closeStatusWindow: () => ipcRenderer.invoke("puppy:close-status-window"),
  setPopupVisible: (visible: boolean) => ipcRenderer.invoke("puppy:set-popup-visible", visible),
  closePopupWindow: () => ipcRenderer.invoke("puppy:set-popup-visible", false),
  moveWindowBy: (deltaX: number, deltaY: number) => ipcRenderer.invoke("puppy:move-window", deltaX, deltaY),
  setMousePassthrough: (enabled: boolean) => ipcRenderer.invoke("puppy:set-mouse-passthrough", enabled),
  setInteractiveRect: (rect: InteractiveRectPayload) =>
    ipcRenderer.invoke("puppy:set-interactive-rect", rect),
  sendInteraction: (action: string, payload?: Record<string, number | string | boolean | null>) =>
    ipcRenderer.invoke("puppy:interaction", action, payload ?? null),
  openSystemAction: (action: string) => ipcRenderer.invoke("puppy:open-system-action", action),
  saveGeminiKey: (apiKey: string) => ipcRenderer.invoke("puppy:save-gemini-key", apiKey),
  loginProvider: (provider: string, apiKey: string) => ipcRenderer.invoke("puppy:login-provider", provider, apiKey),
  onPopupVisibilityChanged: (handler: (visible: boolean) => void) => {
    ipcRenderer.on("puppy:popup-visibility", (_event, visible) => handler(Boolean(visible)));
  },
  onCommand: (handler: (command: "enter-kennel" | "exit-kennel" | "set-template", value?: string) => void) => {
    ipcRenderer.on("puppy:command", (_event, command, value) => handler(command, value));
  },
});
