import { useEffect, useState } from "react";
import { AdminChartCard } from "../../design-system/AdminChartCard";
import { StatCard } from "../../design-system/StatCard";
import { BarChart, LineChart, DonutChart } from "../../analytics";
import {
  getUserGrowthAnalytics,
  getUserActivityAnalytics,
  getUserSummaryAnalytics,
} from "../../services/usersService";
import { UserMgmtSection } from "./UserMgmtSection";

export function UserAnalyticsTab({ session }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [growth, setGrowth] = useState(null);
  const [activity, setActivity] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      getUserGrowthAnalytics(session.token, periodDays),
      getUserActivityAnalytics(session.token, periodDays),
      getUserSummaryAnalytics(session.token),
    ])
      .then(([g, a, s]) => {
        setGrowth(g);
        setActivity(a);
        setSummary(s);
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load user analytics"))
      .finally(() => setLoading(false));
  }, [session.token, periodDays]);

  if (loading) {
    return <div className="admin-loading-state">Loading user analytics…</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  const totalFrontend = (summary?.totalRegisteredUsers ?? 0) + (summary?.totalEditors ?? 0);

  const statusDist = (summary?.statusDistribution || []).map((s) => ({
    label: s.role,
    value: s.adminCount,
  }));

  const roleDist = (summary?.roleDistribution || []).slice(0, 8).map((r) => ({
    label: r.role,
    value: r.adminCount,
  }));

  const heatmapData = (activity?.activityHeatmap || []).map((h) => ({
    label: h.date,
    value: h.count,
  }));

  return (
    <div className="admin-mgmt-panel user-mgmt-panel">
      <UserMgmtSection
        title="User Analytics"
        description="Growth and engagement metrics for registered users and editors. Activity stats use the selected time period."
      >
        <div className="user-mgmt-period-bar">
          <label>
            Period
            <select className="admin-select" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>

        <div className="admin-stats-grid user-mgmt-kpi-grid">
          <StatCard label="Frontend Users" value={totalFrontend} color="#0ea5e9" hint="All accounts" />
          <StatCard label="Registered" value={summary?.totalRegisteredUsers ?? 0} color="#38bdf8" small hint="Non-editor" />
          <StatCard label="Editors" value={summary?.totalEditors ?? 0} color="#8b5cf6" small hint="Editor accounts" />
          <StatCard
            label={`Active (${periodDays}d)`}
            value={activity?.activeUsers ?? 0}
            color="#22c55e"
            hint="Had activity in period"
          />
          <StatCard
            label={`Inactive (${periodDays}d)`}
            value={activity?.inactiveUsers ?? 0}
            color="#f59e0b"
            hint="No activity in period"
          />
          <StatCard label={`New (${periodDays}d)`} value={growth?.totalNewUsers ?? 0} color="#14b8a6" small hint="Joined in period" />
          <StatCard label="Avg Activity Score" value={Math.round(summary?.averageActivityScore ?? 0)} color="#38bdf8" small hint="Lifetime metric" />
          <StatCard label="Login Devices" value={activity?.totalSessions ?? 0} color="#a78bfa" small hint="Recorded sessions" />
          <StatCard label="Suspended" value={summary?.suspendedUsers ?? 0} color="#ef4444" small hint="Account status" />
          <StatCard label="Pending" value={summary?.pendingUsers ?? 0} color="#fbbf24" small hint="Awaiting activation" />
        </div>
      </UserMgmtSection>

      <UserMgmtSection title="Growth & Engagement">
        <div className="admin-analytics-grid">
          <AdminChartCard
            title="User Growth"
            description={`New registered users and editors per day over the last ${periodDays} days.`}
          >
            <LineChart data={growth?.registrationsPerDay || []} labelKey="date" valueKey="count" color="#0ea5e9" />
          </AdminChartCard>

          <AdminChartCard
            title="Cumulative Growth"
            description="Running total of frontend users (registered + editors) over time."
          >
            <LineChart data={growth?.cumulativeGrowth || []} labelKey="date" valueKey="count" color="#22c55e" />
          </AdminChartCard>

          <AdminChartCard
            title={`Active vs Inactive (${periodDays}d)`}
            description="Users with recorded activity during the period versus those without."
          >
            <DonutChart
              data={[
                { label: "Active", value: activity?.activeUsers ?? 0 },
                { label: "Inactive", value: activity?.inactiveUsers ?? 0 },
              ]}
              labelKey="label"
              valueKey="value"
            />
          </AdminChartCard>

          <AdminChartCard
            title="Account Status"
            description="Registered users and editors grouped by account status (ACTIVE, SUSPENDED, etc.)."
          >
            {statusDist.length > 0 ? (
              <DonutChart data={statusDist} labelKey="label" valueKey="value" />
            ) : (
              <p className="admin-empty-hint">No status data available.</p>
            )}
          </AdminChartCard>

          <AdminChartCard
            title="Interactions Per Day"
            description={`Total user interactions recorded each day over the last ${periodDays} days.`}
          >
            <LineChart data={activity?.interactionsPerDay || []} labelKey="date" valueKey="count" color="#8b5cf6" />
          </AdminChartCard>

          <AdminChartCard
            title="Active Users Per Day"
            description="Distinct users with activity on each day during the period."
          >
            <LineChart data={activity?.activeUsersPerDay || []} labelKey="date" valueKey="count" color="#38bdf8" />
          </AdminChartCard>

          <AdminChartCard
            title="Activity by Hour"
            description={`Interaction volume by hour of day over the last ${periodDays} days.`}
          >
            {heatmapData.length > 0 ? (
              <BarChart data={heatmapData} labelKey="label" valueKey="value" color="#f59e0b" height={220} />
            ) : (
              <p className="admin-empty-hint">No hourly activity recorded in this period.</p>
            )}
          </AdminChartCard>

          <AdminChartCard
            title="Top Roles"
            description="Most common role assignments across registered users and editors."
          >
            {roleDist.length > 0 ? (
              <BarChart data={roleDist} labelKey="label" valueKey="value" color="#0ea5e9" height={220} />
            ) : (
              <p className="admin-empty-hint">No role data available.</p>
            )}
          </AdminChartCard>
        </div>
      </UserMgmtSection>
    </div>
  );
}
