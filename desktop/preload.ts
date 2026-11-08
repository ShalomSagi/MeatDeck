import { contextBridge, ipcRenderer } from "electron";

// The only surface the web UI gets from the desktop shell.
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  setBadge: (count: number) => ipcRenderer.invoke("badge:set", count),
  getLoginItem: () => ipcRenderer.invoke("login-item:get") as Promise<boolean>,
  setLoginItem: (on: boolean) => ipcRenderer.invoke("login-item:set", on) as Promise<boolean>,
  showWindow: () => ipcRenderer.invoke("window:show"),
  onFullscreen: (cb: (on: boolean) => void) => {
    const handler = (_e: unknown, on: boolean) => cb(on);
    ipcRenderer.on("fullscreen", handler);
    return () => ipcRenderer.off("fullscreen", handler);
  },
});
