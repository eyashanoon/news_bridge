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

export function ArticleCrawlerPanel({ session }) {
  const [status, setStatus]         = useState(null);
  const [health, setHealth]         = useState(null);
  const [logs, setLogs]             = useState([]);
  const [lastLogTs, setLastLogTs]   = useState(null);
  const [actionMsg, setActionMsg]   = useState("");
  const [error, setError]           = useState("");
  const [busy, setBusy]             = useState(false);
  const [intervalInput, setIntervalInput]   = useState("");
  const [manualEpId, setManualEpId]         = useState("");
  const [manualPause, setManualPause]       = useState(false);
  const [manualMsg, setManualMsg]           = useState("");
  const [autoScroll, setAutoScroll]         = useState(true);
  const [logEndEl, setLogEndEl]             = useState(null);

  const cfg        = authConfig(session.token);
  const canControl = hasRole(session, "CONTROL_CRAWLER");
  const isOffline  = health === null;
  const channels   = status?.channels || [];
  const anyActive  = channels.some(c => c.status === "crawling");

  const fetchStatus = useCallback(async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        api.get("/api/admin/crawler/status", cfg),
        api.get("/api/admin/crawler/health", cfg),
      ]);
      setStatus(sRes.data);
      setHealth(hRes.data);
      setError("");
    } catch {
      setHealth(null);
      setError("Crawler server unreachable");
    }
  }, [session.token]); // eslint-disable-line

  const fetchLogs = useCallback(async () => {
    try {
      const url = "/api/admin/crawler/logs" +
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
      if (method === "delete") await api.delete(`/api/admin/crawler/${path}`, cfg);
      else await api.post(`/api/admin/crawler/${path}`, {}, cfg);
      setActionMsg(`${label} — ${new Date().toLocaleTimeString()}`);
      await fetchStatus();
      if (path !== "logs") await fetchLogs();
      if (path === "logs") setLogs([]);
    } catch (err) {
      setError(err.response?.data?.message || `${label} failed`);
    } finally { setBusy(false); }
  };

  const handleSetInterval = async (e) => {
    e.preventDefault();
    const val = parseInt(intervalInput, 10);
    if (!val || val < 1 || val > 100) { setError("Staleness weight must be 1–100"); return; }
    setError(""); setBusy(true);
    try {
      await api.post("/api/admin/crawler/interval", { minutes: val }, cfg);
      setActionMsg(`Staleness weight set to ${val / 10} — ${new Date().toLocaleTimeString()}`);
      setIntervalInput(""); await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to set staleness weight");
    } finally { setBusy(false); }
  };

  const handleManualRun = async (e) => {
    e.preventDefault();
    const epId = parseInt(manualEpId, 10);
    if (!epId || epId < 1) { setManualMsg("Enter a valid endpoint ID."); return; }
    setManualMsg(""); setError(""); setBusy(true);
    try {
      if (manualPause && !status?.paused) {
        await api.post("/api/admin/crawler/stop", {}, cfg);
      }
      const res = await api.post("/api/admin/crawler/run-endpoint", { endpointId: epId }, cfg);
      setManualMsg(`Crawl started: ${res.data?.message || "OK"}`);
      setManualEpId("");
      await fetchStatus();
    } catch (err) {
      setManualMsg(`Failed: ${err.response?.data?.message || err.response?.data?.detail || "Run failed"}`);
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
  const queued = status?.queuedEndpoints || [];

  return (
    <div className="crawler-sub-panel">
      {error     && <div className="admin-error">{error}</div>}
      {actionMsg && <div className="crawler-action-toast">{actionMsg}</div>}

      {/* Overview Cards */}
      <div className="crawler-status-grid">
        <div className={`crawler-status-card ${isOffline ? "card-offline" : health?.ok ? "card-ok" : "card-warn"}`}>
          <span className="card-label">Heartbeat</span>
          <span className="card-value">{isOffline ? "OFFLINE" : health?.ok ? "HEALTHY" : "WARN"}</span>
          <span className="card-sub">{health?.backendBaseUrl || "—"}</span>
        </div>
        <div className={`crawler-status-card ${schedulerState === "ACTIVE" ? "card-ok" : schedulerState === "OFFLINE" ? "card-offline" : "card-warn"}`}>
          <span className="card-label">Scheduler</span>
          <span className="card-value">{schedulerState}</span>
          <span className="card-sub">{status?.queueSize != null ? `${status.queueSize} endpoints queued` : "—"}</span>
        </div>
        <div className={`crawler-status-card ${anyActive ? "card-running" : "card-ok"}`}>
          <span className="card-label">Channels</span>
          <span className="card-value">
            {anyActive && <span className="pulse-dot" />}
            {channels.filter(c => c.status === "crawling").length}
            <small style={{fontSize:"0.8rem",fontWeight:500,color:"#94a3b8"}}>&nbsp;/ {channels.length} active</small>
          </span>
          <span className="card-sub">{anyActive ? "crawling now" : "all idle"}</span>
        </div>
        <div className="crawler-status-card card-ok">
          <span className="card-label">Articles Found</span>
          <span className="card-value">{status?.totalArticlesFound ?? "—"}</span>
          <span className="card-sub">{status?.totalCrawls != null ? `${status.totalCrawls} runs total` : "—"}</span>
        </div>
      </div>

      {/* Channel Status */}
      {!isOffline && channels.length > 0 && (
        <div className="crawler-section-block">
          <div className="crawler-section-title">Channel Status</div>
          <div className="crawler-channels-grid">
            {channels.map(ch => (
              <div key={ch.id}
                className={`crawler-ch-card ${ch.status === "crawling" ? "ch-crawling" : ch.status === "stopped" ? "ch-stopped" : "ch-idle"}`}>
                <div className="ch-header">
                  <span className="ch-id">CH {ch.id}</span>
                  <span className={`ch-badge ${ch.status === "crawling" ? "badge-crawling" : ch.status === "stopped" ? "badge-stopped" : "badge-idle"}`}>
                    {ch.status === "crawling" && <span className="pulse-dot" />}
                    {ch.status.toUpperCase()}
                  </span>
                </div>
                {ch.endpointId != null && (
                  <div className="ch-ep-id">EP #{ch.endpointId}</div>
                )}
                <div className={`ch-ep-url${!ch.endpoint ? " ch-no-ep" : ""}`} title={ch.endpoint || ""}>
                  {ch.endpoint ? (ch.endpoint.length > 55 ? ch.endpoint.slice(0, 52) + "…" : ch.endpoint) : "—"}
                </div>
                {ch.startedAt && (
                  <div className="ch-started">since {new Date(ch.startedAt + "Z").toLocaleTimeString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Queue — sorted by priority */}
      {!isOffline && queued.length > 0 && (
        <div className="crawler-section-block">
          <div className="crawler-section-title">Pending Endpoints — Priority Order</div>
          <div className="crawler-queue-table-wrap">
            <table className="crawler-queue-table">
              <thead>
                <tr><th>EP ID</th><th>URL</th><th>Priority</th><th>Prod Score</th><th>Last Crawled</th><th>Runs</th></tr>
              </thead>
              <tbody>
                {queued.map(ep => (
                  <tr key={ep.id} className={ep.priority >= 9999 ? "row-due" : ""}>
                    <td className="ep-id-cell">#{ep.id}</td>
                    <td className="ep-url-cell" title={ep.url}>
                      {ep.url.length > 60 ? ep.url.slice(0, 57) + "…" : ep.url}
                    </td>
                    <td className="ep-due-cell">{fmtPriority(ep.priority)}</td>
                    <td className="ep-score-cell">{ep.score}</td>
                    <td className="ep-score-cell">{fmtMinutes(ep.minutesSinceCrawl)}</td>
                    <td className="ep-score-cell">{ep.crawlCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Control Bar */}
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
          <button className="admin-btn accent"
            onClick={() => control("run-now", "All endpoints re-queued for immediate run")}
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

      {/* Manual Endpoint Run */}
      {canControl && (
        <div className="crawler-section-block">
          <div className="crawler-section-title">Manual Endpoint Run</div>
          <p className="crawler-section-desc">
            Run a specific listing endpoint immediately. Optionally pause the scheduler first
            so only this endpoint crawls.
          </p>
          <form className="crawler-manual-run-form" onSubmit={handleManualRun}>
            <input
              type="number" min="1"
              placeholder="Endpoint ID"
              value={manualEpId}
              onChange={e => setManualEpId(e.target.value)}
              className="manual-ep-input"
            />
            <label className="manual-pause-toggle">
              <input type="checkbox" checked={manualPause}
                onChange={e => setManualPause(e.target.checked)} />
              Pause scheduler first
            </label>
            <button className="admin-btn accent" type="submit" disabled={busy || isOffline || !manualEpId}>
              {busy ? <><span className="spinner-sm" /> Running…</> : "Run Endpoint Now"}
            </button>
            {status?.paused && (
              <button className="admin-btn primary" type="button"
                onClick={() => control("start", "Scheduler resumed")}
                disabled={busy || isOffline}>
                Resume Scheduler
              </button>
            )}
          </form>
          {manualMsg && (
            <div className={`crawler-action-toast${manualMsg.startsWith("Failed") ? " toast-error" : ""}`}>
              {manualMsg}
            </div>
          )}
        </div>
      )}

      {/* Staleness Weight */}
      {canControl && (
        <form className="crawler-interval-form" onSubmit={handleSetInterval}>
          <label>Staleness Weight</label>
          <input type="number" min="1" max="100"
            placeholder="1–100 (÷10)"
            value={intervalInput}
            onChange={e => setIntervalInput(e.target.value)}
          />
          <button className="admin-btn primary" type="submit" disabled={busy || !intervalInput}>Apply</button>
        </form>
      )}

      {/* Live Log */}
      <div className="crawler-log-panel">
        <div className="log-panel-header">
          <span>Live Log Stream</span>
          <label className="log-autoscroll-toggle">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
        </div>
        <div className="log-entries">
          {logs.length === 0
            ? <span className="log-empty">No log entries yet.</span>
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
