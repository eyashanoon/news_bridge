import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { hasRole } from "../utils/roles";
import { PageShell } from "../design-system/PageShell";
import { Card } from "../design-system/Card";
import { StatCard } from "../design-system/StatCard";
import { Button } from "../design-system/Button";
import { getPostDetail, retagPost } from "../services/telegramService";
import "../styles/telegram-admin.css";

export default function TelegramPostDetailPage() {
  const { postId } = useParams();
  const { session } = useSession();
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  if (!hasRole(session, "VIEW_TELEGRAM_POSTS", "MANAGE_TELEGRAM_CHANNELS", "MANAGE_USERS")) {
    return <AccessDenied />;
  }

  const load = () => {
    setLoading(true);
    getPostDetail(session.token, postId)
      .then(setPost)
      .catch((err) => setError(err.response?.data?.message || "Failed to load post"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [session.token, postId]); // eslint-disable-line

  if (loading) return <div className="admin-loading-state">Loading post…</div>;
  if (error) return <div className="admin-error">{error}</div>;
  if (!post) return null;

  const impact = post.recommendationImpact || {};

  return (
    <PageShell
      breadcrumbs={<Link to="/admin/telegram">Telegram Center</Link>}
      title="Post Details"
      subtitle={`@${post.channelUsername}`}
      actions={
        <Button size="small" onClick={() => retagPost(session.token, postId).then(load)}>Re-extract tags</Button>
      }
    >
      <Card>
        <p className="tg-post-full-content">{post.content || <em>No content</em>}</p>
        {post.mediaUrl && (
          <div className="tg-post-media">
            {post.mediaType === "photo" ? (
              <img src={post.mediaUrl} alt="Telegram media" />
            ) : post.mediaType === "video" ? (
              <video src={post.mediaUrl} controls />
            ) : null}
          </div>
        )}
        <p className="tg-muted">
          Published {post.messageDate ? new Date(post.messageDate).toLocaleString() : "—"} · {post.viewCount} views
        </p>
        <div className="tg-tag-chips">
          {(post.tags || []).map((t) => (
            <span key={t} className="tg-tag-chip">{t}</span>
          ))}
        </div>
      </Card>

      <h3 className="tg-section-title">Recommendation Impact</h3>
      <div className="admin-stats-grid">
        <StatCard label="Interactions" value={impact.interactionCount ?? 0} color="#0ea5e9" />
        <StatCard label="Likes" value={impact.likes ?? 0} color="#22c55e" />
        <StatCard label="Dislikes" value={impact.dislikes ?? 0} color="#ef4444" />
        <StatCard label="Reports" value={impact.reports ?? 0} color="#f59e0b" />
        <StatCard label="Avg read time (s)" value={impact.averageReadTimeSeconds ?? 0} color="#8b5cf6" small />
      </div>
      <p className="tg-muted">
        Likes, dislikes, and reports are not tracked for raw Telegram posts yet; interaction counts come from view events.
      </p>
    </PageShell>
  );
}
