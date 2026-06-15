import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { formatRelativeTime } from "../utils/formatRelativeTime";

const CONTENT_COLLAPSE_LEN = 420;

function formatTelegramText(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("__") && part.endsWith("__")) {
      return <em key={i}>{part.slice(2, -2)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return part.split("\n").map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

function MediaBlock({ mediaUrl, mediaType }) {
  if (!mediaUrl) return null;
  const type = (mediaType || "").toLowerCase();
  if (type.includes("video") || mediaUrl.match(/\.(mp4|webm|mov)(\?|$)/i)) {
    return (
      <video className="tg-post-media tg-post-video" controls preload="metadata">
        <source src={mediaUrl} />
      </video>
    );
  }
  return (
    <img
      className="tg-post-media tg-post-image"
      src={mediaUrl}
      alt=""
      loading="lazy"
      onError={(e) => { e.target.style.display = "none"; }}
    />
  );
}

function channelInitials(name) {
  if (!name) return "TG";
  const parts = name.replace(/^@/, "").split(/[\s_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function TelegramPostCard({
  post,
  showChannelProfile = false,
  showMatchBadge = false,
  onTagClick,
}) {
  const { t, i18n } = useTranslation();
  const cardRef = useRef(null);
  const viewSent = useRef(false);
  const visibleStart = useRef(null);
  const [expanded, setExpanded] = useState(false);

  const channelName = post.channelDisplayName || post.channelUsername || t("telegramFeed.channel", "Channel");
  const handle = post.channelUsername?.replace(/^@/, "");
  const telegramUrl = handle ? `https://t.me/${handle}` : null;
  const relativeDate = formatRelativeTime(post.messageDate, i18n.language);
  const isLong = (post.content?.length || 0) > CONTENT_COLLAPSE_LEN;
  const displayContent =
    !isLong || expanded ? post.content : `${post.content.slice(0, CONTENT_COLLAPSE_LEN).trim()}…`;

  const sendView = async () => {
    if (viewSent.current || !post.channelId) return;
    viewSent.current = true;
    try {
      await ensureUserInitialized();
      const userId = getUserId() || "android-app-anonymous";
      const scoreParam = post.score != null ? `&feedScore=${post.score}` : "";
      await apiFetch(
        `/api/telegram/interactions/view?userId=${encodeURIComponent(userId)}&channelId=${post.channelId}&postId=${post.id}${scoreParam}`,
        { method: "POST" }
      );
    } catch {
      // non-blocking
    }
  };

  const sendTimeSpent = async (seconds) => {
    if (!post.channelId || seconds < 1) return;
    try {
      await ensureUserInitialized();
      const userId = getUserId() || "android-app-anonymous";
      await apiFetch(
        `/api/telegram/interactions/time?userId=${encodeURIComponent(userId)}&channelId=${post.channelId}&postId=${post.id}&seconds=${seconds}`,
        { method: "POST" }
      );
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const scrollRoot = el.closest(".home-feed");

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          visibleStart.current = Date.now();
          sendView();
        } else if (visibleStart.current) {
          const seconds = (Date.now() - visibleStart.current) / 1000.0;
          visibleStart.current = null;
          if (seconds > 1) sendTimeSpent(seconds);
        }
      },
      {
        root: scrollRoot,
        threshold: 0.55,
        rootMargin: "0px",
      }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (visibleStart.current) {
        const seconds = (Date.now() - visibleStart.current) / 1000.0;
        visibleStart.current = null;
        if (seconds > 1) sendTimeSpent(seconds);
      }
    };
  }, [post.id, post.channelId]);

  return (
    <article className="tg-post-card" ref={cardRef}>
      <header className="tg-post-header">
        <div className="tg-post-channel-row">
          <div className="tg-post-avatar" aria-hidden>
            {channelInitials(channelName)}
          </div>
          <div className="tg-post-channel">
            <span className="tg-post-channel-name">{channelName}</span>
            {handle && <span className="tg-post-channel-handle">@{handle}</span>}
          </div>
        </div>
        <div className="tg-post-meta">
          {showMatchBadge && post.score != null && post.score > 0 && (
            <span className="tg-post-match-badge" title={t("telegramFeed.matchScore", "Content match")}>
              {t("telegramFeed.similar", "Similar")}
            </span>
          )}
          <time className="tg-post-date" dateTime={post.messageDate}>
            {relativeDate}
          </time>
        </div>
      </header>

      {post.content && (
        <div className="tg-post-content-wrap">
          <div className="tg-post-content">{formatTelegramText(displayContent)}</div>
          {isLong && (
            <button
              type="button"
              className="tg-post-read-more"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? t("showLess", "Show less")
                : t("readMore", "Read more")}
            </button>
          )}
        </div>
      )}

      <MediaBlock mediaUrl={post.mediaUrl} mediaType={post.mediaType} />

      {post.tags?.length > 0 && (
        <div className="tg-post-tags">
          {post.tags.map((tag) =>
            onTagClick ? (
              <button
                key={tag}
                type="button"
                className="tg-post-tag tg-post-tag--clickable"
                onClick={() => onTagClick(tag)}
              >
                #{tag}
              </button>
            ) : (
              <span key={tag} className="tg-post-tag">#{tag}</span>
            )
          )}
        </div>
      )}

      {showChannelProfile && post.channelDescription && (
        <details className="tg-post-channel-details">
          <summary>{t("telegramFeed.aboutChannel", "About this channel")}</summary>
          <p>{post.channelDescription}</p>
        </details>
      )}

      <footer className="tg-post-footer">
        {post.viewCount != null && post.viewCount > 0 && (
          <span className="tg-post-views">
            <span className="tg-post-stat-icon" aria-hidden>👁</span>
            {post.viewCount.toLocaleString()}
          </span>
        )}
        {post.edited && (
          <span className="tg-post-edited">{t("edited", "edited")}</span>
        )}
        {telegramUrl && (
          <a
            className="tg-post-open-tg"
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("telegramFeed.openInTelegram", "Open channel")}
          </a>
        )}
      </footer>
    </article>
  );
}
