import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("puppyDesktop", {
  setMode: (mode: "active" | "kennel") => ipcRenderer.invoke("puppy:set-mode", mode),
  moveWindowBy: (deltaX: number, deltaY: number) => ipcRenderer.invoke("puppy:move-window", deltaX, deltaY),
  saveGeminiKey: (apiKey: string) => ipcRenderer.invoke("puppy:save-gemini-key", apiKey),
  loginProvider: (provider: string, apiKey: string) => ipcRenderer.invoke("puppy:login-provider", provider, apiKey),
  onCommand: (handler: (command: "enter-kennel" | "exit-kennel" | "set-template", value?: string) => void) => {
    ipcRenderer.on("puppy:command", (_event, command, value) => handler(command, value));
  },
});
