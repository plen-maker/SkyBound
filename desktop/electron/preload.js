const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("skybound", {
  // Auth
  openAuth:       ()    => ipcRenderer.invoke("auth:open"),
  logout:         ()    => ipcRenderer.invoke("auth:logout"),
  onAuthSuccess:  (cb)  => ipcRenderer.on("auth:success", (_e, u) => cb(u)),
  onAuthError:    (cb)  => ipcRenderer.on("auth:error",   (_e, m) => cb(m)),
  // Updater
  checkUpdate:    ()    => ipcRenderer.invoke("updater:check"),
  downloadUpdate: ()    => ipcRenderer.invoke("updater:download"),
  installUpdate:  ()    => ipcRenderer.invoke("updater:install"),
  openRelease:    (url) => ipcRenderer.invoke("updater:openrel", url),
  onUpdater:      (cb)  => {
    ["checking","latest","available","progress","ready"].forEach(e =>
      ipcRenderer.on(`updater:${e}`, (_ev, data) => cb(e, data))
    );
  },
  // Navigation
  openExternal:   (url) => ipcRenderer.invoke("open:external", url),
  openInApp:      (url) => ipcRenderer.invoke("open:inapp", url),
  // Data
  fetchOFP:       (u)   => ipcRenderer.invoke("simbrief:fetch", u),
  saveSettings:   (s)   => ipcRenderer.invoke("settings:save", s),
  loadSettings:   ()    => ipcRenderer.invoke("settings:load"),
  platform: process.platform,
});
