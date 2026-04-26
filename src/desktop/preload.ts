import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("puppyDesktop", {
  getStatus: () => ipcRenderer.invoke("puppy:get-status"),
  action: (action: string, value?: string) => ipcRenderer.invoke("puppy:action", action, value),
});
