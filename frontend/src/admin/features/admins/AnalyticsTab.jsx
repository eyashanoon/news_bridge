import { useEffect, useState } from "react";
import { AdminChartCard } from "../../design-system/AdminChartCard";
import { StatCard } from "../../design-system/StatCard";
import { BarChart, LineChart, DonutChart } from "../../analytics";
import { getAdminAnalytics } from "../../services/adminsService";
import { displayNameFromEmail } from "../../utils/avatars";
import { formatActivityAction } from "../../constants/permissionGroups";

function formatRate(value) {
  if (value == null || Number.isNaN(Number(value))) return "0%";
  return `${Number(value).toFixed(1)}%`;
}

function formatAverage(value) {
  if (value == null || Number.isNaN(Number(value))) return "0";
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function AnalyticsTab({ session }) {
  const [analytics, setAnalytics] = useState(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getAdminAnalytics(session.token, periodDays)
      .then(setAnalytics)
      .catch((err) => setError(err.response?.data?.message || "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [session.token, periodDays]);

  if (loading) {
    return <div className="admin-loading-state">Loading analytics…</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  if (!analytics) {
    return (
      <div className="admin-empty-state">
        <h3>No analytics data yet</h3>
        <p>Analytics populate when admins perform data-changing operations in the console.</p>
      </div>
    );
  }

  const hasActivity = (analytics.totalActions ?? 0) > 0;

  const mostActiveData = (analytics.mostActiveAdmins || []).slice(0, 8).map((a) => ({
    label: displayNameFromEmail(a.adminEmail).slice(0, 14),
    value: a.actionCount,
  }));

  const actionsByTypeData = (analytics.actionsByType || []).map((a) => ({
    label: formatActivityAction(a.action),
    value: a.count,
  }));

  const roleDistData = (analytics.roleDistribution || []).slice(0, 8).map((r) => ({
    label: r.role,
    value: r.adminCount,
  }));

  const statusData = (analytics.actionsByStatus || []).map((s) => ({
    label: s.status === "SUCCESS" ? "Success" : s.status === "FAILURE" ? "Failed" : s.status,
    value: s.count,
  }));

  return (
    <div className="admin-mgmt-panel">
      <div className="admin-analytics-toolbar">
        <label>
          Period:
          <select className="admin-select" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
        {!hasActivity && (
          <span className="admin-cell-muted">No data-changing admin actions in this period yet (creates, edits, deletes, approvals, suspensions, etc.).</span>
        )}
      </div>

      <div className="admin-stats-grid admin-stats-grid-compact">
        <StatCard label="Total Actions" value={analytics.totalActions ?? 0} color="#0ea5e9" />
        <StatCard label="Active Admins" value={analytics.activeAdmins ?? 0} color="#8b5cf6" />
        <StatCard label="Success Rate" value={formatRate(analytics.successRate)} color="#22c55e" small />
        <StatCard label="Failed Actions" value={analytics.failureCount ?? 0} color="#ef4444" />
        <StatCard label="Avg / Day" value={formatAverage(analytics.avgActionsPerDay)} color="#f59e0b" small />
        <StatCard label="Action Types" value={analytics.actionsByType?.length ?? 0} color="#38bdf8" small />
      </div>

      <div className="admin-analytics-grid">
        <AdminChartCard
          title="Most Active Admins"
          description="Admins ranked by recorded actions during the selected period."
        >
          {mostActiveData.length > 0 ? (
            <BarChart data={mostActiveData} labelKey="label" valueKey="value" color="#0ea5e9" />
          ) : (
            <div className="admin-chart-empty">No admin activity recorded yet</div>
          )}
        </AdminChartCard>

        <AdminChartCard
          title="Actions Per Day"
          description="Daily volume of admin actions across the platform."
        >
          {(analytics.actionsPerDay || []).some((d) => d.count > 0) ? (
            <LineChart data={analytics.actionsPerDay || []} labelKey="date" valueKey="count" color="#38bdf8" />
          ) : (
            <div className="admin-chart-empty">No daily activity in this period</div>
          )}
        </AdminChartCard>

        <AdminChartCard
          title="Actions By Type"
          description="Breakdown of admin work by category (users, content, crawler, login, etc.)."
        >
          {actionsByTypeData.length > 0 ? (
            <BarChart data={actionsByTypeData} labelKey="label" valueKey="value" color="#8b5cf6" height={220} />
          ) : (
            <div className="admin-chart-empty">No categorized actions yet</div>
          )}
        </AdminChartCard>

        <AdminChartCard
          title="Outcome Distribution"
          description="Share of successful vs failed admin operations."
        >
          {statusData.length > 0 ? (
            <DonutChart data={statusData} labelKey="label" valueKey="value" />
          ) : (
            <div className="admin-chart-empty">No outcomes to chart yet</div>
          )}
        </AdminChartCard>

        <AdminChartCard
          title="Role Distribution"
          description="How administrators are distributed across assigned roles (all admins, not period-scoped)."
        >
          {roleDistData.length > 0 ? (
            <DonutChart data={roleDistData} labelKey="label" valueKey="value" />
          ) : (
            <div className="admin-chart-empty">No role assignments found</div>
          )}
        </AdminChartCard>
      </div>
    </div>
  );
}
