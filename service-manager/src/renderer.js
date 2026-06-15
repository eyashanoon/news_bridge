/* global Terminal, FitAddon */

function getFitAddonClass() {
  if (typeof FitAddon === "undefined") return null;
  // UMD bundle exposes { FitAddon: class } on window, not the class directly.
  if (typeof FitAddon.FitAddon === "function") return FitAddon.FitAddon;
  if (typeof FitAddon === "function") return FitAddon;
  return null;
}

function getApi() {
  if (!window.serviceManager) {
    throw new Error("Bridge API not available. Preload script failed to load.");
  }
  return window.serviceManager;
}

/** @type {Array<object>} */
let services = [];
/** @type {Record<string, object>} */
let statuses = {};
/** @type {Map<string, { terminal: Terminal, fitAddon: object, wrap: HTMLElement }>} */
const terminals = new Map();

let activeTabId = null;

const serviceListEl = document.getElementById("service-list");
const tabBarEl = document.getElementById("tab-bar");
const tabPlaceholderEl = document.getElementById("tab-placeholder");
const terminalContainerEl = document.getElementById("terminal-container");
const projectRootEl = document.getElementById("project-root");
const errorBannerEl = document.getElementById("error-banner");

function showError(msg) {
  errorBannerEl.textContent = msg;
  errorBannerEl.classList.remove("hidden");
  console.error(msg);
}

function clearError() {
  errorBannerEl.classList.add("hidden");
  errorBannerEl.textContent = "";
}

function statusLabel(id) {
  const s = statuses[id] || {};
  if (s.state === "starting") return "starting";
  if (s.managed) return s.healthy ? "healthy" : "running";
  if (s.healthy) return "healthy";
  return "stopped";
}

function statusText(id) {
  const s = statuses[id] || {};
  const label = statusLabel(id);
  if (label === "healthy") return s.managed ? "Healthy" : "Healthy (external)";
  if (label === "running") return "Running";
  if (label === "starting") return "Starting";
  return "Stopped";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderServiceList() {
  serviceListEl.innerHTML = "";

  for (const svc of services) {
    const li = document.createElement("li");
    li.className = `service-card${activeTabId === svc.id ? " active-tab" : ""}`;
    li.dataset.id = svc.id;

    const label = statusLabel(svc.id);
    const managed = statuses[svc.id]?.managed;

    const canStop = label !== "stopped";

    li.innerHTML = `
      <div class="service-card-header">
        <div>
          <div class="service-name">${escapeHtml(svc.name)}</div>
          <div class="service-desc">${escapeHtml(svc.description)}</div>
        </div>
        <span class="status-pill ${label}">
          <span class="status-dot"></span>
          ${statusText(svc.id)}
        </span>
      </div>
      ${svc.dependsOn?.length ? `<div class="service-deps">Needs: ${svc.dependsOn.join(", ")}</div>` : ""}
      <div class="service-actions">
        <button class="btn btn-primary btn-sm" data-action="start" ${managed ? "disabled" : ""}>Start</button>
        <button class="btn btn-danger btn-sm" data-action="stop" ${canStop ? "" : "disabled"}>Stop</button>
        <button class="btn btn-ghost btn-sm" data-action="restart">Restart</button>
        <button class="btn btn-ghost btn-sm" data-action="tab">Terminal</button>
      </div>
    `;

    serviceListEl.appendChild(li);
  }
}

function ensureTerminal(id, name) {
  if (terminals.has(id)) return terminals.get(id);

  if (typeof Terminal === "undefined") {
    throw new Error("xterm.js failed to load. Check vendor/xterm.js exists.");
  }

  const wrap = document.createElement("div");
  wrap.className = "term-wrap";
  wrap.dataset.id = id;
  terminalContainerEl.appendChild(wrap);

  const terminal = new Terminal({
    theme: {
      background: "#020617",
      foreground: "#e2e8f0",
      cursor: "#38bdf8",
      selectionBackground: "rgba(56, 189, 248, 0.4)",
      selectionForeground: "#ffffff",
    },
    fontFamily: "Cascadia Code, Consolas, monospace",
    fontSize: 13,
    cursorBlink: true,
    scrollback: 5000,
    convertEol: true,
    rightClickSelectsWord: true,
    allowProposedApi: true,
  });

  let fitAddon = null;
  const FitAddonClass = getFitAddonClass();
  if (FitAddonClass) {
    fitAddon = new FitAddonClass();
    terminal.loadAddon(fitAddon);
  }

  terminal.open(wrap);
  terminal.writeln(`\x1b[90m[${name}] Terminal ready. Click Start to run the service.\x1b[0m`);

  const api = getApi();
  terminal.onData((data) => api.writeInput(id, data));

  terminal.attachCustomKeyEventHandler((ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    if (!mod) return true;

    const key = ev.key.toLowerCase();
    if (key === "c" && terminal.hasSelection()) {
      const sel = terminal.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
        return false;
      }
    }
    if (key === "c" && ev.shiftKey) {
      const sel = terminal.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
        return false;
      }
    }
    if (key === "v" && ev.shiftKey) {
      navigator.clipboard.readText().then((text) => api.writeInput(id, text)).catch(() => {});
      return false;
    }
    return true;
  });

  wrap.addEventListener("contextmenu", (ev) => {
    if (!terminal.hasSelection()) return;
    ev.preventDefault();
    navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
  });

  const entry = { terminal, fitAddon, wrap };
  terminals.set(id, entry);
  addTabButton(id, name);
  return entry;
}

function addTabButton(id, name) {
  if (tabBarEl.querySelector(`[data-tab="${id}"]`)) return;

  tabPlaceholderEl.style.display = "none";

  const btn = document.createElement("button");
  btn.className = "tab-btn";
  btn.dataset.tab = id;
  btn.innerHTML = `${escapeHtml(name)} <span class="tab-close" title="Close tab">×</span>`;
  tabBarEl.appendChild(btn);
}

function closeTab(id) {
  const btn = tabBarEl.querySelector(`[data-tab="${id}"]`);
  if (btn) btn.remove();

  const entry = terminals.get(id);
  if (entry) {
    entry.terminal.dispose();
    entry.wrap.remove();
    terminals.delete(id);
  }

  if (activeTabId === id) {
    const remaining = [...terminals.keys()];
    activeTabId = remaining.length ? remaining[remaining.length - 1] : null;
    if (activeTabId) showTab(activeTabId);
    else {
      tabPlaceholderEl.style.display = "block";
      document.querySelectorAll(".term-wrap").forEach((el) => el.classList.remove("active"));
    }
  }
  renderServiceList();
}

function showTab(id) {
  const svc = services.find((s) => s.id === id);
  if (!svc) return;

  ensureTerminal(id, svc.name);
  activeTabId = id;

  terminals.forEach((entry, tid) => {
    entry.wrap.classList.toggle("active", tid === id);
    if (tid === id && entry.fitAddon) {
      requestAnimationFrame(() => {
        try {
          entry.fitAddon.fit();
          getApi().resizeTerminal(id, entry.terminal.cols, entry.terminal.rows);
        } catch (e) {
          console.warn("fit failed", e);
        }
      });
    }
  });

  tabBarEl.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === id);
  });

  renderServiceList();
}

async function startService(id) {
  clearError();
  try {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;

    ensureTerminal(id, svc.name);
    showTab(id);

    const entry = terminals.get(id);
    entry.terminal.writeln(`\x1b[36m>>> Starting ${svc.name}...\x1b[0m`);

    const res = await getApi().startService(id);
    if (!res.ok) {
      entry.terminal.writeln(`\x1b[31mFailed to start: ${res.error}\x1b[0m`);
      showError(`${svc.name}: ${res.error}`);
    }
    renderServiceList();
  } catch (err) {
    showError(`Start failed: ${err.message}`);
  }
}

async function stopService(id) {
  clearError();
  try {
    const svc = services.find((s) => s.id === id);
    const entry = terminals.get(id);
    if (entry) entry.terminal.writeln(`\x1b[33m>>> Stopping ${svc?.name || id}...\x1b[0m`);

    const res = await getApi().stopService(id);
    if (!res.ok) {
      if (entry) entry.terminal.writeln(`\x1b[31mFailed to stop: ${res.error}\x1b[0m`);
      showError(`${svc?.name || id}: ${res.error}`);
    } else if (entry) {
      entry.terminal.writeln("\x1b[33m>>> Stopped — port released\x1b[0m");
    }
    renderServiceList();
  } catch (err) {
    showError(`Stop failed: ${err.message}`);
  }
}

async function restartService(id) {
  clearError();
  try {
    const svc = services.find((s) => s.id === id);
    ensureTerminal(id, svc?.name || id);
    showTab(id);
    await getApi().restartService(id);
    renderServiceList();
  } catch (err) {
    showError(`Restart failed: ${err.message}`);
  }
}

function handleOutput(id, data) {
  try {
    const svc = services.find((s) => s.id === id);
    const entry = terminals.get(id) || ensureTerminal(id, svc?.name || id);
    entry.terminal.write(data);
  } catch (err) {
    console.error("output error", err);
  }
}

function handleExited(id, code) {
  const entry = terminals.get(id);
  if (entry) {
    entry.terminal.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`);
  }
  renderServiceList();
}

function onResize() {
  if (!activeTabId) return;
  const entry = terminals.get(activeTabId);
  if (entry?.fitAddon) {
    try {
      entry.fitAddon.fit();
      getApi().resizeTerminal(activeTabId, entry.terminal.cols, entry.terminal.rows);
    } catch {
      // ignore
    }
  }
}

function bindEvents() {
  serviceListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.disabled) return;

    const card = e.target.closest(".service-card");
    if (!card) return;
    const id = card.dataset.id;
    const action = btn.dataset.action;

    if (action === "start") startService(id);
    else if (action === "stop") stopService(id);
    else if (action === "restart") restartService(id);
    else if (action === "tab") showTab(id);
  });

  tabBarEl.addEventListener("click", (e) => {
    const close = e.target.closest(".tab-close");
    const tabBtn = e.target.closest(".tab-btn");
    if (!tabBtn) return;
    const id = tabBtn.dataset.tab;
    if (close) closeTab(id);
    else showTab(id);
  });

  document.getElementById("btn-start-core").addEventListener("click", async () => {
    clearError();
    try {
      for (const id of ["mysql", "backend", "discovery", "crawler", "telegram", "admin"]) {
        const svc = services.find((s) => s.id === id);
        if (svc) ensureTerminal(id, svc.name);
      }
      showTab("mysql");
      await getApi().startCore();
      renderServiceList();
    } catch (err) {
      showError(`Start core failed: ${err.message}`);
    }
  });

  document.getElementById("btn-stop-all").addEventListener("click", async () => {
    try {
      await getApi().stopAll();
      renderServiceList();
    } catch (err) {
      showError(`Stop all failed: ${err.message}`);
    }
  });

  document.getElementById("btn-refresh").addEventListener("click", async () => {
    try {
      statuses = await getApi().getStatuses();
      renderServiceList();
    } catch (err) {
      showError(`Refresh failed: ${err.message}`);
    }
  });

  window.addEventListener("resize", onResize);
  new ResizeObserver(onResize).observe(terminalContainerEl);
}

async function init() {
  try {
    const api = getApi();
    const root = await api.getProjectRoot();
    projectRootEl.textContent = root;
    projectRootEl.title = root;

    services = await api.getServices();
    statuses = await api.getStatuses();

    api.onOutput(handleOutput);
    api.onExited(handleExited);
    api.onStatusUpdate((s) => {
      statuses = s;
      renderServiceList();
    });

    bindEvents();
    renderServiceList();
    clearError();
  } catch (err) {
    showError(`Failed to initialize: ${err.message}`);
    projectRootEl.textContent = "Initialization failed";
  }
}

init();
