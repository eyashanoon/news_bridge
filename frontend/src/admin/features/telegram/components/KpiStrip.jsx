import { StatCard } from "../../../design-system/StatCard";

export function KpiStrip({ kpis, loading }) {
  if (loading) {
    return <div className="admin-loading-state">Loading Telegram KPIs…</div>;
  }

  return (
    <div className="admin-stats-grid tg-kpi-grid">
      <StatCard label="Total Channels" value={kpis?.totalChannels ?? "-"} color="#0ea5e9" />
      <StatCard label="Active Channels" value={kpis?.activeChannels ?? "-"} color="#22c55e" />
      <StatCard label="Total Posts" value={kpis?.totalPosts ?? "-"} color="#8b5cf6" />
      <StatCard label="Posts Today" value={kpis?.postsToday ?? "-"} color="#f59e0b" />
      <StatCard label="Posts This Week" value={kpis?.postsThisWeek ?? "-"} color="#38bdf8" />
      <StatCard label="Active Users" value={kpis?.activeTelegramUsers ?? "-"} color="#a78bfa" />
      <StatCard label="Rec. Accuracy" value={kpis?.recommendationAccuracyScore ?? "-"} color="#14b8a6" small />
      <StatCard label="Avg Engagement" value={kpis?.averageEngagementScore ?? "-"} color="#f472b6" small />
    </div>
  );
}
