// TopicCard.jsx
import { useTranslation } from "react-i18next";

function formatTimeAgo(isoString, t) {
  if (!isoString) return null;
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) return t("minutesAgo", { count: diffMin });
  if (diffHrs < 24) return t("hoursAgo", { count: diffHrs });
  return t("daysAgo", { count: diffDays });
}

export default function TopicCard({ topic, onViewTopic }) {
  const { t } = useTranslation();
  const lastActivity = formatTimeAgo(topic.lastActivityAt, t);

  const translateField = (name) => {
    return t(`field_${name}`, { defaultValue: name });
  };

  return (
    <div className="topic-card">
      {/* Title + Trending Indicator */}
      <div className="topic-card-header">
        <h2
          className="topic-card-title"
          onClick={() => onViewTopic(topic.id)}
        >
          {topic.title}
        </h2>

        <div className="topic-growth">
          🔥 {topic.growth}%
        </div>
      </div>

      {/* Fields */}
      {topic.fieldNames && topic.fieldNames.length > 0 && (
        <div className="topic-fields-row">
          <span className="topic-fields-label">📌</span>
          {topic.fieldNames.map((fn, idx) => (
            <span key={idx} className="topic-field-badge">{translateField(fn)}</span>
          ))}
        </div>
      )}

      {/* Summary */}
      <p className="topic-summary">{topic.description}</p>

      {/* Stats */}
      <div className="topic-stats">
        <span>📝 {topic.posts} {t("posts")}</span>
        <span>👥 {topic.contributors} {t("contributors")}</span>
      </div>

      {/* Trending Statistics */}
      <div className="topic-trending-stats">
        {topic.totalLikes > 0 && (
          <span className="topic-trending-stat">👍 {topic.totalLikes} {t("likes")}</span>
        )}
        {topic.totalDislikes > 0 && (
          <span className="topic-trending-stat">👎 {topic.totalDislikes} {t("dislikes")}</span>
        )}
        {topic.activityScore > 0 && (
          <span className="topic-trending-stat">⚡ {t("activityScore")}: {topic.activityScore}</span>
        )}
        {lastActivity && (
          <span className="topic-trending-stat">🕐 {lastActivity}</span>
        )}
      </div>

      {/* Tags */}
      <div className="topic-tags">
        {topic.tags.map((tag, idx) => (
          <span key={idx} className="topic-tag">#{tag}</span>
        ))}
      </div>

      {/* Buttons */}
      <div className="topic-card-footer">
        <button
          className="text-blue-600 hover:underline font-medium text-sm"
          onClick={() => onViewTopic(topic.id)}
        >
          {t("viewTopic")}
        </button>

        <button className="bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 transition text-sm font-semibold">
          {t("follow")}
        </button>
      </div>
    </div>
  );
}