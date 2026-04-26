import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("puppyDesktop", {
  setMode: (mode: "active" | "kennel") => ipcRenderer.invoke("puppy:set-mode", mode),
  onCommand: (handler: (command: "enter-kennel" | "exit-kennel" | "set-template", value?: string) => void) => {
    ipcRenderer.on("puppy:command", (_event, command, value) => handler(command, value));
  },
});
