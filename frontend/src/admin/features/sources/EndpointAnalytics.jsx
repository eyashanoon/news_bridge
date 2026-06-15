import { BarChart, DonutChart, ExpandableChartArea } from "../../analytics";
import { StatCard } from "../../design-system/StatCard";

function ChartCard({ title, description, children }) {
  return (
    <div className="admin-card sources-chart-card">
      <h4>{title}</h4>
      <ExpandableChartArea title={title} description={description}>
        {children}
      </ExpandableChartArea>
    </div>
  );
}

function toChartData(items) {
  return (items || []).map((d) => ({ label: d.label, value: d.count ?? d.value ?? 0 }));
}

export function EndpointAnalytics({ analytics, loading }) {
  if (loading) return <p className="admin-muted">Loading analytics…</p>;
  if (!analytics) return <p className="admin-muted">No analytics data.</p>;

  return (
    <div className="sources-endpoint-analytics">
      <div className="admin-kpi-row">
        <StatCard label="Total endpoints" value={analytics.totalEndpoints} />
        <StatCard label="Active" value={analytics.activeEndpoints} color="#22c55e" />
        <StatCard label="Disabled" value={analytics.disabledEndpoints} color="#f87171" />
      </div>

      <div className="sources-charts-grid">
        <ChartCard
          title="Endpoint distribution by depth"
          description="How many discovered endpoints exist at each crawl depth level from their root URL."
        >
          <BarChart data={toChartData(analytics.endpointsByDepth)} color="#0ea5e9" height={220} />
        </ChartCard>
        <ChartCard
          title="Endpoint distribution by root"
          description="Share of endpoints grouped by the root domain they were discovered from."
        >
          <DonutChart data={toChartData(analytics.endpointsByRoot)} size={200} />
        </ChartCard>
        <ChartCard
          title="Largest path groups"
          description="Path prefixes with the highest number of endpoints under the same route segment."
        >
          <BarChart data={toChartData(analytics.largestPathGroups)} color="#8b5cf6" height={220} />
        </ChartCard>
        <ChartCard
          title="Most active path groups (crawl volume)"
          description="Path groups with the most crawl activity, indicating frequently refreshed content areas."
        >
          <BarChart data={toChartData(analytics.mostActivePathGroups)} color="#22c55e" height={220} />
        </ChartCard>
      </div>
    </div>
  );
}
