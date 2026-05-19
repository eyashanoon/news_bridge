// Post.jsx
import { useEffect, useRef, useState } from "react";
import { categoryColors, categoryTheme } from "../utils/categoryColors";
import { getUserId } from "../utils/userId";
import PostModal from "./PostModal";
import PostCommentsModal from "./PostCommentsModal";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { savePost, unsavePost, isPostSaved } from "../utils/savedPosts";
import { useTheme } from "../context/ThemeContext";

export default function Post({ post, onAskAI }) {
  const colors = categoryColors[post.label] || {};
  const { darkMode } = useTheme();
  const postTheme = categoryTheme[post.label]?.[darkMode ? "dark" : "light"] || categoryTheme.General[darkMode ? "dark" : "light"];

  const formatPublishedAt = (value) => {
    if (!value) return "";
    const publishedAt = new Date(value);
    if (Number.isNaN(publishedAt.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - publishedAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 7) {
      return publishedAt.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (diffDays >= 1) return `${diffDays}d ago`;
    if (diffHours >= 1) return `${diffHours}h ago`;
    if (diffMinutes >= 1) return `${diffMinutes}m ago`;
    return "just now";
  };

  const [likesCount, setLikesCount] = useState(post.likes);
  const [dislikesCount, setDislikesCount] = useState(post.dislikes);
  const [reaction, setReaction] = useState(post.userReaction);
  const [media, setMedia] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(() => isPostSaved(post.id));

  const postRef = useRef(null);
  const visibleStart = useRef(null);
  const viewSent = useRef(false);

  const react = async (type) => {
    await ensureUserInitialized();
    const userId = getUserId();
    const res = await apiFetch(
      `/api/posts/${post.id}/react?userId=${userId}&type=${type}`,
      { method: "PUT" }
    );
    if (!res.ok) {
      console.error("React failed");
      return;
    }
    const data = await res.json();
    setLikesCount(data.likes);
    setDislikesCount(data.dislikes);
    if (data.status === "REMOVED") {
      setReaction(null);
    } else {
      setReaction(type);
    }
  };

  const sendView = async () => {
    if (viewSent.current) return;
    viewSent.current = true;
    await ensureUserInitialized();
    const userId = getUserId();
    await apiFetch(`/api/posts/${post.id}/view?userId=${userId}`, {
      method: "POST",
    });
  };

  const sendTimeSpent = async (seconds) => {
    await ensureUserInitialized();
    const userId = getUserId();
    await apiFetch(
      `/api/posts/${post.id}/time?userId=${userId}&seconds=${seconds}`,
      { method: "POST" }
    );
  };

  const sendClick = async () => {
    await ensureUserInitialized();
    const userId = getUserId();
    await apiFetch(`/api/posts/${post.id}/click?userId=${userId}`, {
      method: "POST",
    });
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const openOriginalArticle = () => {
    if (!post.articleUrl) return;
    window.open(post.articleUrl, "_blank", "noopener,noreferrer");
  };

  const handleToggleSave = async (e) => {
    e.stopPropagation();
    if (isSaved) {
      await unsavePost(post.id);
      setIsSaved(false);
    } else {
      await savePost(post);
      setIsSaved(true);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          visibleStart.current = Date.now();
          sendView();
        } else {
          if (visibleStart.current) {
            const seconds = (Date.now() - visibleStart.current) / 1000.0;
            visibleStart.current = null;
            if (seconds > 1) {
              sendTimeSpent(seconds);
            }
          }
        }
      },
      { threshold: 0.6 }
    );

    if (postRef.current) observer.observe(postRef.current);
    return () => observer.disconnect();
  }, []);

  const MAX_CHARS = 220;
  const isLongText = post.text && post.text.length > MAX_CHARS;
  const previewText = isLongText
    ? post.text.slice(0, MAX_CHARS) + "..."
    : post.text;

  const numImages = post.numImages || 0;

  useEffect(() => {
    const loadMedia = async () => {
      if (!post.articleId) return;
      try {
        const res = await apiFetch(`/api/posts/${post.id}/media`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setMedia(data);
      } catch (err) {
        console.error('Failed to load media', err);
      }
    };
    loadMedia();
  }, [post.articleId]);

  const buildPlaceholderImages = () => {
    const placeholders = [];
    const count = media && Array.isArray(media) ? media.length : numImages;
    for (let i = 1; i <= count; i++) {
      placeholders.push(
        "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE="
      );
    }
    return placeholders;
  };

  const placeholderImages = buildPlaceholderImages();
  const publishedLabel = formatPublishedAt(post.articleCreatedAt);

  const renderImages = () => {
    const items = media && Array.isArray(media) ? media : placeholderImages.map((u) => ({ type: 'image', url: u }));
    const count = items.length;
    if (count <= 0) return null;

    const renderMediaElement = (item, idx, extraCount) => {
      if (item.type === 'video') {
        return (
          <video
            key={idx}
            src={item.url}
            controls
            className="post-media-item video"
          />
        );
      }

      if (idx === 2 && extraCount > 0) {
        return (
          <div key={idx} className="post-media-overlay">
            <img src={item.url} alt="post" />
            <div className="overlay-count">+{extraCount}</div>
          </div>
        );
      }

      return (
        <img
          key={idx}
          src={item.url}
          alt="post"
          className="post-media-item"
        />
      );
    };

    if (count === 1) {
      return (
        <div className="post-media-grid grid-1">
          {items[0].type === 'video' ? (
            <video src={items[0].url} controls className="post-media-item" />
          ) : (
            <img src={items[0].url} alt="post" className="post-media-item" />
          )}
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="post-media-grid grid-2">
          {items.slice(0, 2).map((it, idx) => renderMediaElement(it, idx, 0))}
        </div>
      );
    }

    const extraCount = Math.max(0, count - 3);
    return (
      <div className="post-media-grid grid-3">
        {items.slice(0, 3).map((it, idx) => renderMediaElement(it, idx, extraCount))}
      </div>
    );
  };

  return (
    <>
      <div
        ref={postRef}
        onClick={openModal}
        className="post"
        style={{
          background: postTheme.surface,
          borderColor: postTheme.border,
        }}
      >
        {/* Category color line */}
        <div
          className="post-category-line"
          style={{ background: postTheme.accent }}
        />

        <div className="post-header">
          <span className="post-category" style={{ background: postTheme.pillBg, color: postTheme.pillText }}>
            {post.label}
          </span>
          {publishedLabel && <span className="post-time">{publishedLabel}</span>}
        </div>

        {post.title && <h3 className="post-title">{post.title}</h3>}

        <div className="post-text">{previewText}</div>

        {isLongText && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            className="post-show-more"
          >
            Show more...
          </button>
        )}

        {renderImages()}

        {post.lang && <span className="post-lang">{post.lang}</span>}

        {post.tags?.length > 0 && (
          <div className="post-tags">
            {post.tags.map((t, idx) => (
              <span key={idx} className="post-tag">#{t}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="post-actions" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => react("LIKE")}
            className={`post-action-btn ${reaction === "LIKE" ? "liked" : ""}`}
          >
            👍 {likesCount}
          </button>

          <button
            onClick={() => react("DISLIKE")}
            className={`post-action-btn ${reaction === "DISLIKE" ? "disliked" : ""}`}
          >
            👎 {dislikesCount}
          </button>

          <button
            onClick={() => setIsCommentsOpen(true)}
            className="post-action-btn"
          >
            💬 Comment
          </button>

          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!onAskAI) return;
              onAskAI(post);
              try {
                await fetch(`http://localhost:9000/ingest/post/${post.id}`, {
                  method: "POST",
                });
              } catch (err) {
                console.error("Failed to ingest post into AI", err);
              }
            }}
            className="post-action-btn ai-btn"
          >
            🤖 Ask AI
          </button>

          <button
            onClick={handleToggleSave}
            className={`post-action-btn ${isSaved ? "saved" : ""}`}
          >
            {isSaved ? "📂" : "💾"} {isSaved ? "Saved" : "Save"}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              sendClick();
              openOriginalArticle();
            }}
            className="post-action-btn"
            disabled={!post.articleUrl}
            style={{ opacity: post.articleUrl ? 1 : 0.4 }}
          >
            🔗 Visit
          </button>
        </div>
      </div>

      {isModalOpen && <PostModal post={post} onClose={closeModal} />}
      {isCommentsOpen && (
        <PostCommentsModal post={post} onClose={() => setIsCommentsOpen(false)} />
      )}
    </>
  );
}