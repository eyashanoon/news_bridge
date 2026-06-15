import { useEffect, useState, useCallback } from "react";
import { api, authConfig } from "../../../../api";
import { hasRole } from "../../../utils/roles";
import { getCrawlerDashboard } from "../../../services/telegramService";
import { StatCard } from "../../../design-system/StatCard";
import { Button } from "../../../design-system/Button";
import { DonutChart } from "../../../analytics";
import { ChartCard } from "../components/ChartCard";

export function CrawlerMonitoringTab({ session }) {
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cfg = authConfig(session.token);
  const canControl = hasRole(session, "CONTROL_TELEGRAM_CRAWLER");

  const refresh = useCallback(async () => {
    try {
      const [dash, sRes, hRes] = await Promise.all([
        getCrawlerDashboard(session.token),
        api.get("/api/admin/telegram-crawler/status", cfg),
        api.get("/api/admin/telegram-crawler/health", cfg),
      ]);
      setDashboard(dash);
      setStatus(sRes.data);
      setHealth(hRes.data);
      setError("");
    } catch {
      setError("Telegram crawler server unreachable — start it on port 8200");
    }
  }, [session.token]); // eslint-disable-line

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get("/api/admin/telegram-crawler/logs?limit=200", cfg);
      setLogs(res.data.logs || []);
    } catch { /* ignore */ }
  }, [session.token]); // eslint-disable-line

  useEffect(() => {
    refresh();
    fetchLogs();
    const id = setInterval(() => { refresh(); fetchLogs(); }, 4000);
    return () => clearInterval(id);
  }, [refresh, fetchLogs]);

  const runAction = async (path, label) => {
    if (!canControl) return;
    setBusy(true);
    try {
      await api.post(path, {}, cfg);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || `${label} failed`);
    } finally {
      setBusy(false);
    }
  };

  const workers = status?.workers || status?.channels || [];
  const queued = status?.queuedChannels || [];

  return (
    <div className="tg-tab-panel">
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-stats-grid">
        <StatCard label="Scheduler" value={health?.schedulerRunning ? "Running" : "Stopped"} color="#22c55e" />
        <StatCard label="Workers" value={health?.numWorkers ?? status?.numWorkers ?? "-"} color="#0ea5e9" />
        <StatCard label="Queue" value={status?.queueSize ?? "-"} color="#8b5cf6" />
        <StatCard label="Processing" value={status?.activeChannels?.length ?? workers.filter((w) => w.status === "crawling").length} color="#f59e0b" />
        <StatCard label="Crawl Success" value={`${dashboard?.crawlSuccessRate ?? 0}%`} color="#14b8a6" />
        <StatCard label="Tagged Posts" value={dashboard?.taggedPosts ?? "-"} color="#a78bfa" />
        <StatCard label="Pending Tags" value={dashboard?.pendingPosts ?? "-"} color="#f472b6" small />
        <StatCard label="Tag Success" value={`${dashboard?.taggingSuccessRate ?? 0}%`} color="#38bdf8" small />
      </div>

      {canControl && (
        <div className="tg-crawler-actions">
          <Button size="small" disabled={busy} onClick={() => runAction("/api/admin/telegram-crawler/start", "Start")}>Resume</Button>
          <Button size="small" disabled={busy} onClick={() => runAction("/api/admin/telegram-crawler/stop", "Stop")}>Pause</Button>
          <Button size="small" disabled={busy} onClick={() => runAction("/api/admin/telegram-crawler/restart", "Restart")}>Restart</Button>
          <Button size="small" disabled={busy} onClick={() => runAction("/api/admin/telegram-crawler/reload", "Reload")}>Reload</Button>
          <Button size="small" disabled={busy} onClick={() => runAction("/api/admin/telegram-crawler/run-now", "Run now")}>Run now</Button>
          <Button size="small" onClick={refresh}>Refresh</Button>
        </div>
      )}

      <div className="tg-charts-grid">
        <ChartCard
          title="Crawl Status Breakdown"
          description="Current distribution of channel crawl states (success, pending, failed, etc.)."
        >
          <DonutChart
            data={(dashboard?.crawlStatusBreakdown || []).map((d) => ({
              label: d.label,
              value: d.count,
            }))}
          />
        </ChartCard>
        <ChartCard title="Channel Queue" subtitle="Next channels to crawl" expandable={false}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Channel</th><th>Priority</th></tr>
              </thead>
              <tbody>
                {queued.length === 0 ? (
                  <tr><td colSpan={2} className="empty-row">Queue empty</td></tr>
                ) : queued.map((q, i) => (
                  <tr key={i}>
                    <td>{q.channel || q.channelId}</td>
                    <td>{q.priority?.toFixed?.(1) ?? q.effectivePriority?.toFixed?.(1) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Live Logs" expandable={false}>
        <div className="log-entries tg-crawler-logs">
          {logs.slice(-80).map((e, i) => (
            <div key={i} className={`log-entry log-${(e.level || "info").toLowerCase()}`}>
              <span className="log-ts">{e.ts}</span> {e.message || e.msg}
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
