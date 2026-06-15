const { app, BrowserWindow, ipcMain } = require("electron");

// Avoid GPU crashes on some Windows setups.
app.disableHardwareAcceleration();
const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");
const { execSync } = require("child_process");
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

function getServicePort(service) {
  const h = service?.health;
  if (!h) return null;
  if (h.type === "tcp") return h.port;
  if (h.type === "http") {
    try {
      const url = new URL(h.url);
      if (url.port) return Number(url.port);
      return url.protocol === "https:" ? 443 : 80;
    } catch {
      return null;
    }
  }
  return null;
}

function findListeningPids(port) {
  if (!port) return [];
  try {
    if (process.platform === "win32") {
      const out = execSync("netstat -ano -p tcp", { encoding: "utf8", windowsHide: true });
      const pids = new Set();
      const suffix = `:${port}`;
      for (const line of out.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const localAddr = parts[1] || "";
        if (!localAddr.endsWith(suffix)) continue;
        const pid = parseInt(parts[parts.length - 1], 10);
        if (pid > 0) pids.add(pid);
      }
      return [...pids];
    }
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((p) => parseInt(p, 10))
      .filter((p) => p > 0);
  } catch {
    return [];
  }
}

function killPidTree(pid) {
  if (!pid || pid <= 0) return false;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore", windowsHide: true });
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        process.kill(pid, "SIGTERM");
      }
      setTimeout(() => {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // already exited
        }
      }, 300);
    }
    return true;
  } catch (err) {
    log("killPidTree failed", pid, err.message);
    return false;
  }
}

async function forceFreePort(port) {
  if (!port) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    const pids = findListeningPids(port);
    if (!pids.length) return true;
    for (const pid of pids) killPidTree(pid);
    await new Promise((r) => setTimeout(r, 600));
  }
  return findListeningPids(port).length === 0;
}

function runStopCommand(service) {
  if (!service?.stopCommand) return;
  const cwd = resolveCwd(service.cwd);
  try {
    if (process.platform === "win32") {
      execSync(service.stopCommand, {
        cwd,
        shell: "powershell.exe",
        stdio: "ignore",
        windowsHide: true,
        timeout: 30000,
      });
    } else {
      execSync(service.stopCommand, {
        cwd,
        shell: true,
        stdio: "ignore",
        timeout: 30000,
      });
    }
    log("stopCommand ok", service.id);
  } catch (err) {
    log("stopCommand failed", service.id, err.message);
  }
}

async function spawnService(service) {
  if (processes.has(service.id)) {
    return { ok: false, error: "Already running" };
  }

  const cwd = resolveCwd(service.cwd);
  if (!fs.existsSync(cwd)) {
    return { ok: false, error: `Directory not found: ${cwd}` };
  }

  const port = getServicePort(service);
  const alreadyHealthy = await checkHealth(service);
  if (alreadyHealthy) {
    if (processes.has(service.id)) {
      return { ok: false, error: "Already running" };
    }
    if (port && !service.skipPortKill) {
      sendToRenderer(
        "service-output",
        service.id,
        `\r\n\x1b[33m>>> Port ${port} is in use by a leftover process. Stopping it...\x1b[0m\r\n`
      );
      const freed = await forceFreePort(port);
      if (!freed) {
        pollHealth();
        return {
          ok: false,
          error: `Port ${port} is still in use. Run free-ports.ps1 or close the other process.`,
        };
      }
      await new Promise((r) => setTimeout(r, 400));
    } else {
      log("skip start — already healthy (external)", service.id);
      sendToRenderer(
        "service-output",
        service.id,
        `\r\n\x1b[33m>>> ${service.name} is already running (detected on port). Skipping start.\x1b[0m\r\n`
      );
      pollHealth();
      return { ok: true, skipped: true, external: true };
    }
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

async function stopService(id) {
  const svc = services.find((s) => s.id === id);
  const proc = processes.get(id);
  const port = svc ? getServicePort(svc) : null;

  if (proc) {
    try {
      if (process.platform === "win32") {
        killPidTree(proc.pid);
      } else {
        proc.kill();
      }
    } catch (err) {
      log("kill failed", id, err.message);
    }
    processes.delete(id);
  }

  if (svc) runStopCommand(svc);

  processState.set(id, "stopped");

  if (port && !svc?.skipPortKill) {
    await new Promise((r) => setTimeout(r, svc?.stopCommand ? 800 : 400));
    const freed = await forceFreePort(port);
    if (!freed) {
      log("port still in use after stop", id, port);
      return { ok: false, error: `Port ${port} is still in use` };
    }
  } else if (port && svc?.skipPortKill) {
    await new Promise((r) => setTimeout(r, 1200));
    if (findListeningPids(port).length > 0) {
      log("port still in use (docker/external)", id, port);
    }
  }

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
    const res = await spawnService(svc);
    results.push({ id, ...res });
    if (res.ok && !res.skipped) {
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

ipcMain.handle("start-service", async (_e, id) => {
  const svc = services.find((s) => s.id === id);
  if (!svc) return { ok: false, error: "Unknown service" };
  return spawnService(svc);
});

ipcMain.handle("stop-service", (_e, id) => stopService(id));

ipcMain.handle("restart-service", async (_e, id) => {
  await stopService(id);
  await new Promise((r) => setTimeout(r, 800));
  const svc = services.find((s) => s.id === id);
  if (!svc) return { ok: false, error: "Unknown service" };
  return spawnService(svc);
});

ipcMain.handle("start-core", () => startCoreStack());
ipcMain.handle("stop-all", async () => {
  const managedIds = [...processes.keys()];
  const runningIds = services
    .filter((svc) => {
      const st = healthStatus[svc.id];
      return st?.healthy || st?.managed || st?.state === "starting";
    })
    .map((svc) => svc.id);
  const ids = [...new Set([...managedIds, ...runningIds])];
  for (const id of ids) {
    await stopService(id);
  }
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

app.on("window-all-closed", async () => {
  if (healthTimer) clearInterval(healthTimer);
  for (const id of [...processes.keys()]) await stopService(id);
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
