const { app, BrowserWindow, ipcMain } = require("electron");

// Avoid GPU crashes on some Windows setups.
app.disableHardwareAcceleration();
const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");
const pty = require("node-pty");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const services = JSON.parse(
  fs.readFileSync(path.join(__dirname, "services.json"), "utf8")
);

/** @type {Map<string, import('node-pty').IPty>} */
const processes = new Map();

/** @type {Map<string, 'running' | 'stopped' | 'starting'>} */
const processState = new Map();

/** @type {Record<string, object>} */
let healthStatus = {};

let mainWindow = null;
let healthTimer = null;

const CORE_ORDER = ["mysql", "backend", "discovery", "crawler", "telegram", "admin"];
const IS_DEV = !app.isPackaged;

function log(...args) {
  console.log("[service-manager]", ...args);
}

function getShell() {
  return process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "bash";
}

function resolveCwd(relativeCwd) {
  return path.join(PROJECT_ROOT, relativeCwd === "." ? "" : relativeCwd);
}

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function checkTcp(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
    socket.connect(port, host);
  });
}

function checkHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function checkHealth(service) {
  const h = service.health;
  if (!h) return false;
  if (h.type === "tcp") return checkTcp(h.host, h.port);
  if (h.type === "http") return checkHttp(h.url);
  return false;
}

async function pollHealth() {
  const next = {};
  await Promise.all(
    services.map(async (svc) => {
      const state = processState.get(svc.id) || "stopped";
      const managed = state === "running" || state === "starting";
      const healthy = await checkHealth(svc);
      next[svc.id] = { healthy, managed, state };
    })
  );
  healthStatus = next;
  sendToRenderer("status-update", healthStatus);
}

function startHealthPolling() {
  if (healthTimer) clearInterval(healthTimer);
  pollHealth();
  healthTimer = setInterval(pollHealth, 4000);
}

function buildSpawnArgs(command) {
  if (process.platform === "win32") {
    return ["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", command];
  }
  return ["-c", command];
}

function spawnService(service) {
  if (processes.has(service.id)) {
    return { ok: false, error: "Already running" };
  }

  const cwd = resolveCwd(service.cwd);
  if (!fs.existsSync(cwd)) {
    return { ok: false, error: `Directory not found: ${cwd}` };
  }

  processState.set(service.id, "starting");
  pollHealth();

  const shell = getShell();
  const args = buildSpawnArgs(service.command);

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(shell, args, {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1", FORCE_COLOR: "1", PYTHONIOENCODING: "utf-8" },
    });
  } catch (err) {
    log("spawn failed", service.id, err.message);
    processState.set(service.id, "stopped");
    pollHealth();
    return { ok: false, error: err.message };
  }

  processes.set(service.id, ptyProcess);
  processState.set(service.id, "running");
  log("started", service.id, "cwd=", cwd);

  ptyProcess.onData((data) => {
    sendToRenderer("service-output", service.id, data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    log("exited", service.id, exitCode);
    processes.delete(service.id);
    processState.set(service.id, "stopped");
    sendToRenderer("service-exited", service.id, exitCode);
    pollHealth();
  });

  sendToRenderer("service-output", service.id, `\r\n\x1b[36m>>> Starting ${service.name}...\x1b[0m\r\n`);
  sendToRenderer("service-output", service.id, `\x1b[90m$ ${service.command}\x1b[0m\r\n`);
  sendToRenderer("service-output", service.id, `\x1b[90m  cwd: ${cwd}\x1b[0m\r\n\r\n`);

  setTimeout(pollHealth, 500);
  return { ok: true };
}

function stopService(id) {
  const proc = processes.get(id);
  if (!proc) {
    processState.set(id, "stopped");
    pollHealth();
    return { ok: true, message: "Not running" };
  }
  try {
    proc.kill();
  } catch (err) {
    log("kill failed", id, err.message);
  }
  processes.delete(id);
  processState.set(id, "stopped");
  pollHealth();
  return { ok: true };
}

async function startCoreStack() {
  const results = [];
  for (const id of CORE_ORDER) {
    const svc = services.find((s) => s.id === id);
    if (!svc) continue;
    if (processes.has(id)) {
      results.push({ id, ok: true, skipped: true });
      continue;
    }
    const res = spawnService(svc);
    results.push({ id, ...res });
    if (res.ok) {
      await new Promise((r) => setTimeout(r, id === "mysql" ? 8000 : 4000));
    }
  }
  return results;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: "News Bridge — Service Manager",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    log("did-fail-load", code, desc, url);
  });

  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    if (level >= 2) log("renderer:", message, `(${sourceId}:${line})`);
  });

  mainWindow.loadFile(path.join(__dirname, "..", "src", "index.html"));

  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Register IPC handlers immediately so they exist before the renderer loads.
ipcMain.handle("get-project-root", () => PROJECT_ROOT);
ipcMain.handle("get-services", () => services);
ipcMain.handle("get-statuses", () => healthStatus);

ipcMain.handle("start-service", (_e, id) => {
  const svc = services.find((s) => s.id === id);
  if (!svc) return { ok: false, error: "Unknown service" };
  return spawnService(svc);
});

ipcMain.handle("stop-service", (_e, id) => stopService(id));

ipcMain.handle("restart-service", async (_e, id) => {
  stopService(id);
  await new Promise((r) => setTimeout(r, 800));
  const svc = services.find((s) => s.id === id);
  if (!svc) return { ok: false, error: "Unknown service" };
  return spawnService(svc);
});

ipcMain.handle("start-core", () => startCoreStack());
ipcMain.handle("stop-all", () => {
  const ids = [...processes.keys()];
  ids.forEach((id) => stopService(id));
  return { ok: true, stopped: ids };
});

ipcMain.on("write-input", (_e, id, data) => {
  const proc = processes.get(id);
  if (proc) proc.write(data);
});

ipcMain.on("resize-terminal", (_e, id, cols, rows) => {
  const proc = processes.get(id);
  if (proc) proc.resize(cols, rows);
});

app.whenReady().then(() => {
  createWindow();
  startHealthPolling();
});

app.on("window-all-closed", () => {
  if (healthTimer) clearInterval(healthTimer);
  for (const id of [...processes.keys()]) stopService(id);
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
