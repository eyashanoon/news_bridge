import { useCallback, useEffect, useState } from "react";
import { PageShell } from "../../design-system/PageShell";
import { Tabs } from "../../design-system/Tabs";
import { KpiStrip } from "./components/KpiStrip";
import { ChannelsTab } from "./channels/ChannelsTab";
import { ChannelAnalyticsTab } from "./analytics/ChannelAnalyticsTab";
import { PostsTab } from "./posts/PostsTab";
import { UserPreferenceAnalyticsTab } from "./user-analytics/UserPreferenceAnalyticsTab";
import { RecommendationInsightsTab } from "./recommendations/RecommendationInsightsTab";
import { CrawlerMonitoringTab } from "./crawler/CrawlerMonitoringTab";
import { getTelegramKpis } from "../../services/telegramService";
import "../../styles/telegram-admin.css";

const TABS = [
  { id: "channels", label: "Channels" },
  { id: "analytics", label: "Channel Analytics" },
  { id: "posts", label: "Posts" },
  { id: "user-analytics", label: "User Preferences" },
  { id: "recommendations", label: "Recommendation Insights" },
  { id: "crawler", label: "Crawler Monitoring" },
];

export function TelegramControlCenter({ session }) {
  const [activeTab, setActiveTab] = useState("channels");
  const [kpis, setKpis] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  const loadKpis = useCallback(() => {
    setKpiLoading(true);
    getTelegramKpis(session.token)
      .then(setKpis)
      .catch(console.error)
      .finally(() => setKpiLoading(false));
  }, [session.token]);

  useEffect(() => { loadKpis(); }, [loadKpis]);

  return (
    <PageShell
      title="Telegram Control Center"
      subtitle="Manage channels, posts, analytics, recommendations, and crawler operations"
      tabs={<Tabs items={TABS} activeId={activeTab} onChange={setActiveTab} />}
    >
      <KpiStrip kpis={kpis} loading={kpiLoading} />

      {activeTab === "channels" && (
        <ChannelsTab session={session} onRefreshKpis={loadKpis} />
      )}
      {activeTab === "analytics" && <ChannelAnalyticsTab session={session} />}
      {activeTab === "posts" && <PostsTab session={session} />}
      {activeTab === "user-analytics" && <UserPreferenceAnalyticsTab session={session} />}
      {activeTab === "recommendations" && <RecommendationInsightsTab session={session} />}
      {activeTab === "crawler" && <CrawlerMonitoringTab session={session} />}
    </PageShell>
  );
}
