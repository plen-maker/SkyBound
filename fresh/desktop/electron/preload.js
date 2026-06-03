const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("skybound", {
  fetchOFP:     (u)   => ipcRenderer.invoke("simbrief:fetch", u),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  openInApp:    (url) => ipcRenderer.invoke("open:inapp", url),
  saveSettings: (s)   => ipcRenderer.invoke("settings:save", s),
  loadSettings: ()    => ipcRenderer.invoke("settings:load"),
  platform: process.platform,
  // Auth: Google sign-in közvetlenül a rendererben fut Firebase SDK-val
  // (nem kell külön ablak — a signInWithPopup Electronban működik)
});
