const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("skybound", {
  fetchOFP:      (u)   => ipcRenderer.invoke("simbrief:fetch", u),
  openExternal:  (url) => ipcRenderer.invoke("open:external", url),
  openInApp:     (url) => ipcRenderer.invoke("open:inapp", url),
  getGamepads:   ()    => ipcRenderer.invoke("gamepad:list"),
  saveSettings:  (s)   => ipcRenderer.invoke("settings:save", s),
  loadSettings:  ()    => ipcRenderer.invoke("settings:load"),
  platform:      process.platform,
});
