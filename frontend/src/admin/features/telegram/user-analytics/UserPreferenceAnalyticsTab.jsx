import { useCallback, useEffect, useState } from "react";
import { BarChart, DonutChart } from "../../../analytics";
import { ChartCard } from "../components/ChartCard";
import { StatCard } from "../../../design-system/StatCard";
import { getTelegramUserAnalytics } from "../../../services/telegramService";

const REFRESH_MS = 15_000;

function chart(items) {
  return (items || []).map((d) => ({
    label: d.label,
    value: d.value ?? d.count ?? 0,
    count: d.count ?? d.value ?? 0,
  }));
}

function formatUpdatedAt(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return "";
  }
}

export function UserPreferenceAnalyticsTab({ session }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    (initial = false) => {
      if (initial) setLoading(true);
      else setRefreshing(true);

      return getTelegramUserAnalytics(session.token)
        .then(setData)
        .catch((err) => setError(err.response?.data?.message || "Failed to load user analytics"))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [session.token]
  );

  useEffect(() => {
    setError("");
    load(true);
    const timer = setInterval(() => load(false), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !data) {
    return <div className="admin-loading-state">Loading user preference analytics…</div>;
  }
  if (error && !data) return <div className="admin-error">{error}</div>;

  const hasSignals =
    (data?.usersWithPreferences ?? 0) > 0 ||
    (data?.totalEngagementEvents ?? 0) > 0 ||
    (data?.topTags?.length ?? 0) > 0;

  return (
    <div className="tg-tab-panel">
      <div className="tg-user-analytics-toolbar">
        <p className="tg-user-analytics-hint">
          Live stats from news-feed Telegram views and read time. Refreshes every 15 seconds.
          {data?.generatedAt ? ` Last updated ${formatUpdatedAt(data.generatedAt)}.` : ""}
          {refreshing ? " Updating…" : ""}
        </p>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => load(false)}>
          Refresh now
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-stats-grid tg-kpi-grid">
        <StatCard
          label="Users With Preferences"
          value={data?.usersWithPreferences ?? 0}
          color="#22c55e"
          hint="Learned from Telegram engagement"
        />
        <StatCard
          label="Active Users (30d)"
          value={data?.activeUsersLast30Days ?? 0}
          color="#0ea5e9"
          hint="Viewed or read Telegram posts"
        />
        <StatCard
          label="Engagement Events"
          value={data?.totalEngagementEvents ?? 0}
          color="#8b5cf6"
          hint="All-time views + read time"
        />
        <StatCard
          label="Views (30d)"
          value={data?.viewsLast30Days ?? 0}
          color="#f59e0b"
          small
        />
        <StatCard
          label="Read Time Events (30d)"
          value={data?.readTimeEventsLast30Days ?? 0}
          color="#14b8a6"
          small
        />
      </div>

      {!hasSignals && (
        <div className="admin-chart-empty tg-user-analytics-empty">
          No Telegram preference data yet. Browse posts in the news-feed Special News tab — views and
          read time are recorded automatically and will appear here within a few seconds.
        </div>
      )}

      <div className="tg-charts-grid">
        <ChartCard
          title="Most Preferred Categories"
          description="Content categories users engage with most, based on preference signals."
        >
          <DonutChart data={chart(data?.topCategories)} valueKey="value" />
        </ChartCard>
        <ChartCard
          title="Most Preferred Regions"
          description="Regions users show the strongest interest in across the platform."
        >
          <BarChart data={chart(data?.topRegions)} valueKey="value" color="#0ea5e9" />
        </ChartCard>
        <ChartCard
          title="Most Preferred Topics"
          description="Topics ranked by aggregate user preference and follow scores."
        >
          <BarChart data={chart(data?.topTopics)} valueKey="value" color="#8b5cf6" />
        </ChartCard>
        <ChartCard
          title="Most Preferred Tags"
          description="Interest tags with the highest user affinity across the audience."
        >
          <BarChart data={chart(data?.topTags)} valueKey="value" color="#22c55e" />
        </ChartCard>
        <ChartCard
          title="Fastest Growing Interests"
          description="Tags and topics gaining preference momentum fastest over recent activity."
        >
          <BarChart data={chart(data?.fastestGrowingInterests)} valueKey="value" color="#f59e0b" />
        </ChartCard>
        <ChartCard
          title="Declining Interests"
          description="Tags and topics losing user interest compared to prior periods."
        >
          <BarChart data={chart(data?.decliningInterests)} valueKey="value" color="#ef4444" />
        </ChartCard>
        <ChartCard
          title="Most Followed Content Types"
          description="Distribution of user preference across content format types."
        >
          <DonutChart data={chart(data?.topContentTypes)} valueKey="value" />
        </ChartCard>
      </div>
    </div>
  );
}
