// NewsBrief.jsx — News Brief component showing top news highlights (like hourly TV news)
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { aiFetch } from "../utils/aiFetch";
import { useTheme } from "../context/ThemeContext";
import { getUserId } from "../utils/userId";

export default function NewsBrief({ onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const loadingRef = useRef(false);
  // Track language version to force re-fetch when language changes
  const [langVersion, setLangVersion] = useState(0);

  // Listen for language changes
  useEffect(() => {
    const handleLangChange = () => {
      setLangVersion((v) => v + 1);
    };
    window.addEventListener("languageChanged", handleLangChange);
    return () => window.removeEventListener("languageChanged", handleLangChange);
  }, []);

  // Fetch on mount and every time langVersion increments
  useEffect(() => {
    let cancelled = false;

    const fetchBrief = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      try {
        setLoading(true);
        setError(null);

        const userId = getUserId() || "android-app-anonymous";
        const lang = i18n.language || "en";

        const res = await aiFetch("/news-brief", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": userId,
            "X-Generate-Summary": "true",
            "X-Language": lang,
          },
        });

        if (cancelled) return;

        if (!res.ok) {
          throw new Error(`News brief request failed: ${res.status}`);
        }

        const data = await res.json();

        if (cancelled) return;

        if (data.status === "SUCCESS") {
          setBrief(data.brief || t("newsBriefNoSummary", "No summary generated."));
          setPosts(data.posts || []);
        } else {
          setBrief(
            data.message || t("newsBriefUnavailable", "No news brief available right now.")
          );
          setPosts([]);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("News brief fetch error:", err);
        setError(t("newsBriefError", "Unable to load news brief. The AI service may be unavailable."));
        setBrief(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
        loadingRef.current = false;
      }
    };

    fetchBrief();

    return () => {
      cancelled = true;
    };
  }, [langVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    setLangVersion((v) => v + 1);
  };

  // Render post score indicator
  const scoreBar = (score) => {
    const pct = Math.min(100, Math.max(0, score * 100));
    const color =
      pct > 70 ? "#22c55e" : pct > 40 ? "#eab308" : "#64748b";
    return (
      <div className="brief-score-bar">
        <div
          className="brief-score-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    );
  };

  const isArabic = i18n.language === "ar";

  // Format ISO timestamp to relative time (e.g., "2h ago", "منذ 2 س")
  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    try {
      const date = new Date(isoStr.replace("Z", "+00:00").replace(" ", "T"));
      const now = new Date();
      const diffMs = now - date;
      const diffMin = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMin < 1) return isArabic ? "الآن" : "just now";
      if (diffMin < 60) return isArabic ? `منذ ${diffMin} د` : `${diffMin}m ago`;
      if (diffHrs < 24) return isArabic ? `منذ ${diffHrs} س` : `${diffHrs}h ago`;
      if (diffDays < 7) return isArabic ? `منذ ${diffDays} ي` : `${diffDays}d ago`;
      
      return date.toLocaleDateString(isArabic ? "ar-SA" : undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      className="news-brief"
      style={{
        background: darkMode ? "var(--cat-surface, #1e293b)" : "var(--cat-surface, #ffffff)",
        borderColor: darkMode ? "var(--cat-border, #334155)" : "var(--cat-border, #e2e8f0)",
      }}
    >
      {/* Header */}
      <div className="brief-header" onClick={() => setExpanded(!expanded)}>
        <div className="brief-header-left">
          <span className="brief-icon">📺</span>
          <div>
            <h3 className="brief-title">{t("newsBrief", "Hourly News Brief")}</h3>
            <span className="brief-subtitle">
              {posts.length > 0
                ? isArabic
                  ? `${posts.length} قصص رئيسية`
                  : `${posts.length} top stories`
                : t("newsBriefLatest", "Latest updates")}
            </span>
          </div>
        </div>

        <div className="brief-header-right">
          {loading && <span className="brief-loading">{t("newsBriefUpdating", "Updating...")}</span>}
          <button
            className="brief-refresh-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            disabled={loading}
            title={t("refresh", "Refresh news brief")}
          >
            🔄
          </button>
          <span className="brief-expand-icon">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Collapsible Content */}
      {expanded && (
        <div className="brief-content">
          {loading && (
            <div className="brief-loading-state">
              <div className="brief-spinner" />
              <span>{t("newsBriefGenerating", "Generating your news brief...")}</span>
            </div>
          )}

          {error && (
            <div className="brief-error">
              <span>⚠️</span>
              <span>{error}</span>
              <button onClick={handleRefresh} className="brief-retry-btn">
                {t("retry", "Retry")}
              </button>
            </div>
          )}

          {/* LLM-generated brief summary */}
          {!loading && !error && brief && (
            <div className="brief-summary">
              <div className="brief-summary-text">
                {brief.split("\n").map((line, i) => {
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return (
                      <h4 key={i} className="brief-headline">
                        {line.replace(/\*\*/g, "")}
                      </h4>
                    );
                  }
                  if (line.trim() === "") {
                    return <br key={i} />;
                  }
                  return (
                    <p key={i} className="brief-line">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scored posts list */}
          {!loading && posts.length > 0 && (
            <div className="brief-posts">
              <h4 className="brief-posts-title">
                {isArabic ? "القصص في هذا الموجز" : "Stories in this brief"}
              </h4>
              {posts.map((post, idx) => (
                <div key={post.postId || idx} className="brief-post-item">
                  <div className="brief-post-rank">#{idx + 1}</div>
                  <div className="brief-post-info">
                    <div className="brief-post-title">
                      {post.title || (isArabic ? "قصة بدون عنوان" : "Untitled Story")}
                    </div>
                    <div className="brief-post-meta">
                      <span className="brief-post-label">{post.label}</span>
                      <span className="brief-post-time">
                        {formatTime(post.articleCreatedAt)}
                      </span>
                      <span className="brief-post-score">
                        {isArabic ? "النتيجة" : "Score"}: {post.score?.toFixed(2)}
                      </span>
                    </div>
                    <div className="brief-post-components">
                      <span>R:{post.components?.recency?.toFixed(2)}</span>
                      <span>I:{post.components?.importance?.toFixed(2)}</span>
                      <span>P:{post.components?.preference?.toFixed(2)}</span>
                    </div>
                    {scoreBar(post.score)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !brief && posts.length === 0 && (
            <div className="brief-empty">
              <p>{t("newsBriefEmpty", "No news stories available for the brief right now.")}</p>
              <button onClick={handleRefresh} className="brief-retry-btn">
                {isArabic ? "تحقق مرة أخرى" : "Check again"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}