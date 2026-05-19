// NewsBrief.jsx — News Brief component showing top news highlights (like hourly TV news)
import { useState, useEffect, useCallback, useRef } from "react";
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
  const fetchedRef = useRef(false);

  const fetchBrief = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      const userId = getUserId() || "android-app-anonymous";

      const res = await aiFetch("/news-brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          "X-Generate-Summary": "true",
        },
      });

      if (!res.ok) {
        throw new Error(`News brief request failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.status === "SUCCESS") {
        setBrief(data.brief || "No summary generated.");
        setPosts(data.posts || []);
      } else {
        setBrief(data.message || "No news brief available right now.");
        setPosts([]);
      }
    } catch (err) {
      console.error("News brief fetch error:", err);
      setError("Unable to load news brief. The AI service may be unavailable.");
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Fetch on mount
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchBrief();
    }
  }, [fetchBrief]);

  const handleRefresh = () => {
    fetchedRef.current = true;
    if (onRefresh) onRefresh();
    fetchBrief();
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
            <h3 className="brief-title">Hourly News Brief</h3>
            <span className="brief-subtitle">
              {posts.length > 0
                ? `${posts.length} top stories`
                : "Latest updates"}
            </span>
          </div>
        </div>

        <div className="brief-header-right">
          {loading && <span className="brief-loading">Updating...</span>}
          <button
            className="brief-refresh-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            disabled={loading}
            title="Refresh news brief"
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
              <span>Generating your news brief...</span>
            </div>
          )}

          {error && (
            <div className="brief-error">
              <span>⚠️</span>
              <span>{error}</span>
              <button onClick={handleRefresh} className="brief-retry-btn">
                Retry
              </button>
            </div>
          )}

          {/* LLM-generated brief summary */}
          {!loading && !error && brief && (
            <div className="brief-summary">
              <div className="brief-summary-text">
                {brief.split("\n").map((line, i) => {
                  // Bold headlines detection
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
              <h4 className="brief-posts-title">Stories in this brief</h4>
              {posts.map((post, idx) => (
                <div key={post.postId || idx} className="brief-post-item">
                  <div className="brief-post-rank">#{idx + 1}</div>
                  <div className="brief-post-info">
                    <div className="brief-post-title">
                      {post.title || "Untitled Story"}
                    </div>
                    <div className="brief-post-meta">
                      <span className="brief-post-label">{post.label}</span>
                      <span className="brief-post-score">
                        Score: {post.score?.toFixed(2)}
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
              <p>No news stories available for the brief right now.</p>
              <button onClick={handleRefresh} className="brief-retry-btn">
                Check again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}