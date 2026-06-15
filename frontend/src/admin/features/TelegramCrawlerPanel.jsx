import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, authConfig } from "../../api";
import ChannelOnboardingModal from "../../components/ChannelOnboardingModal";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { hasRole } from "../utils/roles";
import { resolveAvatar, displayNameFromEmail } from "../utils/avatars";
import {
  ADMIN_ROLES,
  REGISTERED_ROLE_OPTIONS,
  EDITOR_ROLE_OPTIONS,
  USER_STATUSES,
} from "../constants/roles";

export function TelegramCrawlerPanel({ session }) {
  const [status, setStatus]         = useState(null);
  const [health, setHealth]         = useState(null);
  const [logs, setLogs]             = useState([]);
  const [lastLogTs, setLastLogTs]   = useState(null);
  const [actionMsg, setActionMsg]   = useState("");
  const [error, setError]           = useState("");
  const [busy, setBusy]             = useState(false);
  const [cooldownInput, setCooldownInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [logEndEl, setLogEndEl]     = useState(null);

  const cfg        = authConfig(session.token);
  const canControl = hasRole(session, "CONTROL_TELEGRAM_CRAWLER");
  const isOffline  = health === null;
  const workers    = status?.workers || status?.channels || [];
  const anyActive  = workers.some(w => w.status === "crawling");
  const queued     = status?.queuedChannels || [];

  const fetchStatus = useCallback(async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        api.get("/api/admin/telegram-crawler/status", cfg),
        api.get("/api/admin/telegram-crawler/health", cfg),
      ]);
      setStatus(sRes.data);
      setHealth(hRes.data);
      setError("");
    } catch {
      setHealth(null);
      setError("Telegram crawler server unreachable — start it on port 8200");
    }
  }, [session.token]); // eslint-disable-line

  const fetchLogs = useCallback(async () => {
    try {
      const url = "/api/admin/telegram-crawler/logs" +
        (lastLogTs ? `?since=${encodeURIComponent(lastLogTs)}` : "?limit=200");
      const res = await api.get(url, cfg);
      const entries = res.data.logs || [];
      if (entries.length > 0) {
        setLogs(prev => [...prev, ...entries].slice(-500));
        setLastLogTs(entries[entries.length - 1].ts);
      }
    } catch { /* best-effort */ }
  }, [session.token, lastLogTs]); // eslint-disable-line

  useEffect(() => { fetchStatus(); fetchLogs(); }, []); // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => { fetchStatus(); fetchLogs(); }, anyActive ? 2000 : 5000);
    return () => clearInterval(id);
  }, [anyActive, fetchStatus, fetchLogs]);

  useEffect(() => {
    if (autoScroll && logEndEl) logEndEl.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll, logEndEl]);

  const control = async (path, label, method = "post") => {
    setError(""); setBusy(true);
    try {
      if (method === "delete") await api.delete(`/api/admin/telegram-crawler/${path}`, cfg);
      else await api.post(`/api/admin/telegram-crawler/${path}`, {}, cfg);
      setActionMsg(`${label} — ${new Date().toLocaleTimeString()}`);
      await fetchStatus();
      if (path !== "logs") await fetchLogs();
      if (path === "logs") setLogs([]);
    } catch (err) {
      setError(err.response?.data?.message || `${label} failed`);
    } finally { setBusy(false); }
  };

  const handleSetCooldown = async (e) => {
    e.preventDefault();
    const mins = parseInt(cooldownInput, 10);
    if (!mins || mins < 1 || mins > 1440) {
      setError("Cooldown must be 1–1440 minutes");
      return;
    }
    setError(""); setBusy(true);
    try {
      await api.post("/api/admin/telegram-crawler/interval", { minutes: mins }, cfg);
      setActionMsg(`Min cooldown set to ${mins} min — ${new Date().toLocaleTimeString()}`);
      setCooldownInput("");
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to set cooldown");
    } finally { setBusy(false); }
  };

  const levelClass = lvl => {
    if (!lvl) return "log-info";
    const l = lvl.toUpperCase();
    if (l === "ERROR") return "log-error";
    if (l === "WARN")  return "log-warn";
    return "log-info";
  };

  const fmtPriority = p => {
    if (p == null) return "—";
    if (p >= 9999) return <span className="due-now">NEW</span>;
    return p.toFixed(2);
  };

  const fmtMinutes = m => {
    if (m == null) return "never";
    if (m < 1) return "<1m";
    if (m < 60) return `${Math.round(m)}m`;
    return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  };

  const schedulerState = isOffline ? "OFFLINE" : status?.paused ? "PAUSED" : "ACTIVE";
  const cooldownMin = Math.round((status?.minCooldownSeconds ?? health?.minCooldownSeconds ?? 600) / 60);

  return (
    <div className="crawler-sub-panel">
      {error     && <div className="admin-error">{error}</div>}
      {actionMsg && <div className="crawler-action-toast">{actionMsg}</div>}

      <div className="crawler-status-grid">
        <div className={`crawler-status-card ${isOffline ? "card-offline" : health?.ok ? "card-ok" : "card-warn"}`}>
          <span className="card-label">Heartbeat</span>
          <span className="card-value">{isOffline ? "OFFLINE" : health?.ok ? "HEALTHY" : "WARN"}</span>
          <span className="card-sub">{health?.backendBaseUrl || "—"}</span>
        </div>
        <div className={`crawler-status-card ${health?.telegramApiReady ? "card-ok" : "card-warn"}`}>
          <span className="card-label">MTProto API</span>
          <span className="card-value">{health?.telegramApiReady ? "READY" : "FALLBACK"}</span>
          <span className="card-sub">{health?.telegramApiReady ? "Telethon connected" : "Using web scraper"}</span>
        </div>
        <div className={`crawler-status-card ${schedulerState === "ACTIVE" ? "card-ok" : schedulerState === "OFFLINE" ? "card-offline" : "card-warn"}`}>
          <span className="card-label">Scheduler</span>
          <span className="card-value">{schedulerState}</span>
          <span className="card-sub">{status?.queueSize != null ? `${status.queueSize} channel(s) queued` : "—"}</span>
        </div>
        <div className={`crawler-status-card ${anyActive ? "card-running" : "card-ok"}`}>
          <span className="card-label">Workers</span>
          <span className="card-value">
            {anyActive && <span className="pulse-dot" />}
            {workers.filter(w => w.status === "crawling").length}
            <small style={{fontSize:"0.8rem",fontWeight:500,color:"#94a3b8"}}>&nbsp;/ {workers.length}</small>
          </span>
          <span className="card-sub">{anyActive ? "crawling now" : "all idle"}</span>
        </div>
        <div className="crawler-status-card card-ok">
          <span className="card-label">Posts Created</span>
          <span className="card-value">{status?.totalPostsCreated ?? "—"}</span>
          <span className="card-sub">{status?.totalCrawls != null ? `${status.totalCrawls} crawls · cooldown ${cooldownMin}m` : "—"}</span>
        </div>
        <div className="crawler-status-card card-ok">
          <span className="card-label">Waitlist</span>
          <span className="card-value">{status?.waitlistSize ?? 0}</span>
          <span className="card-sub">Low-priority rotation pool</span>
        </div>
      </div>

      {!isOffline && workers.length > 0 && (
        <div className="crawler-section-block">
          <div className="crawler-section-title">Worker Status</div>
          <div className="crawler-channels-grid">
            {workers.map(w => (
              <div key={w.id}
                className={`crawler-ch-card ${w.status === "crawling" ? "ch-crawling" : w.status === "stopped" ? "ch-stopped" : "ch-idle"}`}>
                <div className="ch-header">
                  <span className="ch-id">W{w.id}</span>
                  <span className={`ch-badge ${w.status === "crawling" ? "badge-crawling" : w.status === "stopped" ? "badge-stopped" : "badge-idle"}`}>
                    {w.status === "crawling" && <span className="pulse-dot" />}
                    {(w.status || "idle").toUpperCase()}
                  </span>
                </div>
                <div className={`ch-ep-url${!w.channel ? " ch-no-ep" : ""}`} title={w.channel ? `@${w.channel}` : ""}>
                  {w.channel ? `@${w.channel}` : "— waiting —"}
                </div>
                {w.startedAt && (
                  <div className="ch-started">since {new Date(w.startedAt.endsWith("Z") ? w.startedAt : w.startedAt + "Z").toLocaleTimeString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isOffline && queued.length > 0 && (
        <div className="crawler-section-block">
          <div className="crawler-section-title">Channel Queue — Priority Order</div>
          <div className="crawler-queue-table-wrap">
            <table className="crawler-queue-table">
              <thead>
                <tr><th>ID</th><th>Channel</th><th>Priority</th><th>Last Crawled</th><th>Runs</th><th>Waitlist</th></tr>
              </thead>
              <tbody>
                {queued.map(ch => (
                  <tr key={ch.id} className={ch.priority >= 9999 ? "row-due" : ""}>
                    <td className="ep-id-cell">#{ch.id}</td>
                    <td className="ep-url-cell">@{ch.username}</td>
                    <td className="ep-due-cell">{fmtPriority(ch.priority)}</td>
                    <td className="ep-score-cell">{fmtMinutes(ch.minutesSinceCrawl)}</td>
                    <td className="ep-score-cell">{ch.crawlCount ?? 0}</td>
                    <td className="ep-score-cell">{ch.waitlist ? "yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canControl && (
        <div className="crawler-command-bar">
          <button className="admin-btn primary"
            onClick={() => control("start", "Scheduler resumed")}
            disabled={busy || isOffline || !status?.paused}>
            Resume
          </button>
          <button className="admin-btn danger"
            onClick={() => control("stop", "Scheduler paused")}
            disabled={busy || isOffline || status?.paused}>
            Pause
          </button>
          <button className="admin-btn" style={{background:"linear-gradient(135deg,#0f766e,#0d9488)",borderColor:"#134e4a"}}
            onClick={() => control("restart", "Scheduler restarted")}
            disabled={busy || isOffline}>
            Restart
          </button>
          <button className="admin-btn"
            onClick={() => control("reload", "Channels reloaded from backend")}
            disabled={busy || isOffline}>
            Reload Channels
          </button>
          <button className="admin-btn accent"
            onClick={() => control("run-now", "All channels re-queued")}
            disabled={busy || isOffline}>
            Run All Now
          </button>
          <button className="admin-btn"
            onClick={() => { fetchStatus(); fetchLogs(); }}
            disabled={busy}>
            Refresh
          </button>
          <button className="admin-btn muted"
            onClick={() => control("logs", "Logs cleared", "delete")}
            disabled={busy}>
            Clear Logs
          </button>
        </div>
      )}

      {canControl && (
        <form className="crawler-interval-form" onSubmit={handleSetCooldown}>
          <label>Min Cooldown Between Channel Crawls (minutes)</label>
          <input type="number" min="1" max="1440"
            placeholder={`Current: ${cooldownMin} min`}
            value={cooldownInput}
            onChange={e => setCooldownInput(e.target.value)} />
          <button className="admin-btn primary" type="submit" disabled={busy || !cooldownInput}>Apply</button>
        </form>
      )}

      <div className="crawler-log-panel">
        <div className="log-panel-header">
          <span>Live Log Stream</span>
          <label className="log-autoscroll-toggle">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} /> Auto-scroll
          </label>
        </div>
        <div className="log-entries">
          {logs.length === 0
            ? <span className="log-empty">No log entries yet. Workers will log when channels are crawled.</span>
            : logs.map((entry, i) => (
              <div key={i} className={`log-entry ${levelClass(entry.level)}`}>
                <span className="log-ts">{entry.ts ? new Date(entry.ts).toLocaleTimeString() : ""}</span>
                <span className="log-lvl">{entry.level || "INFO"}</span>
                <span className="log-msg">{entry.msg}</span>
              </div>
            ))
          }
          <div ref={el => setLogEndEl(el)} />
        </div>
      </div>
    </div>
  );
}
