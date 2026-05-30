const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("authBridge", {
  sendUser: (data) => ipcRenderer.send("auth:user", data),
  sendError: (msg) => ipcRenderer.send("auth:error", msg),
});
