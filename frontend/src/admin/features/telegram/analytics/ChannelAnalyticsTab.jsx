import { useEffect, useState } from "react";
import { LineChart, BarChart, DonutChart } from "../../../analytics";
import { ChartCard } from "../components/ChartCard";
import { getTelegramAnalytics, downloadReport } from "../../../services/telegramService";
import { Button } from "../../../design-system/Button";

function toChartData(items, valueKey = "count") {
  return (items || []).map((d) => ({
    label: d.label || d.date,
    date: d.date,
    value: d[valueKey] ?? d.count ?? 0,
    count: d.count ?? d.value ?? 0,
  }));
}

export function ChannelAnalyticsTab({ session }) {
  const [data, setData] = useState(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getTelegramAnalytics(session.token, periodDays)
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [session.token, periodDays]);

  const exportPlatform = async () => {
    const res = await downloadReport(session.token, "/api/admin/telegram/reports/platform?format=csv");
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "telegram-platform-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="admin-loading-state">Loading channel analytics…</div>;
  if (error) return <div className="admin-error">{error}</div>;

  return (
    <div className="tg-tab-panel">
      <div className="tg-tab-toolbar">
        <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <Button size="small" onClick={exportPlatform}>Export platform report (CSV)</Button>
      </div>

      <div className="tg-charts-grid">
        <ChartCard title="Channel Growth" subtitle="New channels over time">
          <LineChart data={toChartData(data?.channelGrowth)} labelKey="date" valueKey="count" color="#0ea5e9" />
        </ChartCard>
        <ChartCard title="Posts per Day" subtitle="Publishing activity">
          <LineChart data={toChartData(data?.postsPerDay)} labelKey="date" valueKey="count" color="#8b5cf6" />
        </ChartCard>
        <ChartCard title="Most Active Channels" subtitle="By post volume">
          <BarChart data={toChartData(data?.mostActiveChannels)} valueKey="count" color="#22c55e" />
        </ChartCard>
        <ChartCard title="Most Viewed Channels" subtitle="User views">
          <BarChart data={toChartData(data?.mostViewedChannels)} valueKey="count" color="#f59e0b" />
        </ChartCard>
        <ChartCard title="Highest Engagement" subtitle="Engagement score">
          <BarChart data={toChartData(data?.highestEngagementChannels)} valueKey="count" color="#ec4899" />
        </ChartCard>
        <ChartCard
          title="Regional Distribution"
          description="Telegram channels grouped by geographic or regional classification."
        >
          <DonutChart data={toChartData(data?.regionalDistribution)} valueKey="count" />
        </ChartCard>
        <ChartCard
          title="Category Distribution"
          description="Telegram channels grouped by content category."
        >
          <DonutChart data={toChartData(data?.categoryDistribution)} valueKey="count" />
        </ChartCard>
      </div>
    </div>
  );
}
