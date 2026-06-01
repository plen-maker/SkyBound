const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("sb", {
  openExternal: url => ipcRenderer.invoke("open:external", url),
  openInApp:    url => ipcRenderer.invoke("open:inapp", url),
  saveSettings: s   => ipcRenderer.invoke("settings:save", s),
  loadSettings: ()  => ipcRenderer.invoke("settings:load"),
  fetchOFP:     u   => ipcRenderer.invoke("simbrief:fetch", u),
  checkUpdate:  ()  => ipcRenderer.invoke("updater:check"),
  openRelease:  url => ipcRenderer.invoke("updater:open", url),
  platform: process.platform,
});
