const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("serviceManager", {
  getProjectRoot: () => ipcRenderer.invoke("get-project-root"),
  getServices: () => ipcRenderer.invoke("get-services"),
  getStatuses: () => ipcRenderer.invoke("get-statuses"),
  startService: (id) => ipcRenderer.invoke("start-service", id),
  stopService: (id) => ipcRenderer.invoke("stop-service", id),
  restartService: (id) => ipcRenderer.invoke("restart-service", id),
  startCore: () => ipcRenderer.invoke("start-core"),
  stopAll: () => ipcRenderer.invoke("stop-all"),
  writeInput: (id, data) => ipcRenderer.send("write-input", id, data),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send("resize-terminal", id, cols, rows),
  onOutput: (callback) => {
    const handler = (_event, id, data) => callback(id, data);
    ipcRenderer.on("service-output", handler);
    return () => ipcRenderer.removeListener("service-output", handler);
  },
  onExited: (callback) => {
    const handler = (_event, id, code) => callback(id, code);
    ipcRenderer.on("service-exited", handler);
    return () => ipcRenderer.removeListener("service-exited", handler);
  },
  onStatusUpdate: (callback) => {
    const handler = (_event, statuses) => callback(statuses);
    ipcRenderer.on("status-update", handler);
    return () => ipcRenderer.removeListener("status-update", handler);
  },
});
