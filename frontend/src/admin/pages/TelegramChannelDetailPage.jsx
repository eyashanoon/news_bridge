import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { hasRole } from "../utils/roles";
import { PageShell } from "../design-system/PageShell";
import { StatCard } from "../design-system/StatCard";
import { Card } from "../design-system/Card";
import { Button } from "../design-system/Button";
import {
  getChannelDetail,
  getChannelStatistics,
  getChannelPerformance,
  getChannelUserInterest,
  refreshChannelProfile,
  downloadReport,
} from "../services/telegramService";
import "../styles/telegram-admin.css";

export default function TelegramChannelDetailPage() {
  const { channelId } = useParams();
  const { session } = useSession();
  const [detail, setDetail] = useState(null);
  const [stats, setStats] = useState(null);
  const [perf, setPerf] = useState(null);
  const [interest, setInterest] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  if (!hasRole(session, "MANAGE_TELEGRAM_CHANNELS", "VIEW_TELEGRAM_POSTS", "MANAGE_USERS")) {
    return <AccessDenied />;
  }

  const load = () => {
    setLoading(true);
    Promise.all([
      getChannelDetail(session.token, channelId),
      getChannelStatistics(session.token, channelId),
      getChannelPerformance(session.token, channelId),
      getChannelUserInterest(session.token, channelId),
    ])
      .then(([d, s, p, i]) => { setDetail(d); setStats(s); setPerf(p); setInterest(i); })
      .catch((err) => setError(err.response?.data?.message || "Failed to load channel"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [session.token, channelId]); // eslint-disable-line

  const exportReport = async () => {
    const res = await downloadReport(session.token, `/api/admin/telegram/reports/channel/${channelId}?format=csv`);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `channel-${channelId}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="admin-loading-state">Loading channel details…</div>;
  if (error) return <div className="admin-error">{error}</div>;
  if (!detail) return null;

  const ch = detail.channel;

  return (
    <PageShell
      breadcrumbs={
        <Link to="/admin/telegram">Telegram Center</Link>
      }
      title={
        <span className="tg-detail-header">
          <span className="tg-channel-avatar lg">
            {ch.avatarUrl ? <img src={ch.avatarUrl} alt="" /> : (ch.displayName?.[0] || ch.channelUsername?.[0] || "T")}
          </span>
          <span>{ch.displayName || ch.channelUsername}</span>
        </span>
      }
      subtitle={`@${ch.channelUsername}`}
      actions={
        <div className="tg-detail-actions">
          <Button size="small" onClick={() => refreshChannelProfile(session.token, channelId).then(load)}>
            Refresh profile
          </Button>
          <Button size="small" onClick={exportReport}>Export report</Button>
        </div>
      }
    >
      <div className="admin-stats-grid">
        <StatCard label="Posts" value={stats?.totalPosts ?? 0} color="#0ea5e9" />
        <StatCard label="Daily" value={stats?.dailyPosts ?? 0} color="#22c55e" />
        <StatCard label="Weekly" value={stats?.weeklyPosts ?? 0} color="#8b5cf6" />
        <StatCard label="Monthly" value={stats?.monthlyPosts ?? 0} color="#f59e0b" />
        <StatCard label="Engagement" value={ch.engagementScore} color="#ec4899" />
        <StatCard label="Health" value={ch.healthScore} color="#14b8a6" />
      </div>

      <div className="tg-detail-grid">
        <Card>
          <h4>Overview</h4>
          <p>{ch.description || detail.adminDescription || "No description"}</p>
          <dl className="tg-dl">
            <dt>Status</dt><dd>{ch.status}</dd>
            <dt>Purpose</dt><dd>{ch.purpose || "—"}</dd>
            <dt>Region</dt><dd>{ch.region || "—"}</dd>
            <dt>Language</dt><dd>{ch.language || "—"}</dd>
            <dt>Subscribers</dt><dd>{ch.subscriberCount?.toLocaleString() ?? "—"}</dd>
          </dl>
          <div className="tg-tag-chips">
            {(detail.tags || []).map((t) => (
              <span key={t.tag} className="tg-tag-chip">{t.tag}</span>
            ))}
          </div>
        </Card>

        <Card>
          <h4>Performance</h4>
          <dl className="tg-dl">
            <dt>Crawl frequency / day</dt><dd>{perf?.crawlFrequencyPerDay ?? "—"}</dd>
            <dt>Success rate</dt><dd>{((perf?.crawlSuccessRate ?? 0) * 100).toFixed(1)}%</dd>
            <dt>Failed crawls</dt><dd>{perf?.failedCrawlCount ?? 0}</dd>
            <dt>Avg posts / crawl</dt><dd>{perf?.averagePostsRetrieved?.toFixed?.(1) ?? "—"}</dd>
          </dl>
        </Card>

        <Card>
          <h4>User Interest</h4>
          <dl className="tg-dl">
            <dt>Interested users</dt><dd>{interest?.interestedUserCount ?? 0}</dd>
            <dt>Engagement score</dt><dd>{interest?.userEngagementScore ?? 0}</dd>
            <dt>Preference score</dt><dd>{interest?.preferenceScore ?? 0}</dd>
          </dl>
        </Card>

        {detail.profileQuality && (
          <Card>
            <h4>Profile Quality</h4>
            <p>Completion: {detail.profileQuality.completionPercent}%</p>
            <p>Confidence: {detail.profileQuality.confidenceScore}</p>
            {(detail.profileQuality.missingFields || []).length > 0 && (
              <p className="tg-muted">Missing: {detail.profileQuality.missingFields.join(", ")}</p>
            )}
          </Card>
        )}
      </div>
    </PageShell>
  );
}
