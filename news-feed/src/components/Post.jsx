// Post.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { categoryColors, categoryTheme } from "../utils/categoryColors";
import { getUserId } from "../utils/userId";
import PostModal from "./PostModal";
import PostCommentsModal from "./PostCommentsModal";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { savePost, unsavePost, isPostSaved } from "../utils/savedPosts";
import { useTheme } from "../context/ThemeContext";
import { useSession } from "../context/SessionContext";
import GuestSignupPrompt from "./GuestSignupPrompt";
import { useTranslation } from "react-i18next";
import {
  detectItemLanguage,
  needsTranslation as itemNeedsTranslation,
  getTranslationTargetLang,
  getTranslateButtonLabel,
  getLanguageDisplayLabel,
} from "../utils/languageUtils";
import { translateText } from "../utils/translateUtils";

function formatPublishedAt(value, lang) {
  if (!value) return "";
  const publishedAt = new Date(value);
  if (Number.isNaN(publishedAt.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - publishedAt.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 7) {
    if (lang === "ar") {
      const arabicMonths = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      return `${publishedAt.getDate()} ${arabicMonths[publishedAt.getMonth()]} ${publishedAt.getFullYear()}`;
    }
    return publishedAt.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  }
  if (lang === "ar") {
    if (diffDays >= 1) return `منذ ${diffDays} أيام`;
    if (diffHours >= 1) return `منذ ${diffHours} ساعات`;
    if (diffMinutes >= 1) return `منذ ${diffMinutes} دقائق`;
    return "الآن";
  }
  if (diffDays >= 1) return `${diffDays}d ago`;
  if (diffHours >= 1) return `${diffHours}h ago`;
  if (diffMinutes >= 1) return `${diffMinutes}m ago`;
  return "just now";
}

export default function Post({ post, onAskAI }) {
  const colors = categoryColors[post.label] || {};
  const { darkMode } = useTheme();
  const { session } = useSession();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language;
  const postTheme = categoryTheme[post.label]?.[darkMode ? "dark" : "light"] || categoryTheme.General[darkMode ? "dark" : "light"];

  const postLang = detectItemLanguage(post);
  const needsTranslation = itemNeedsTranslation(post, lang);

  const [likesCount, setLikesCount] = useState(post.likes);
  const [dislikesCount, setDislikesCount] = useState(post.dislikes);
  const [reaction, setReaction] = useState(post.userReaction ?? null);

  useEffect(() => {
    setLikesCount(post.likes);
    setDislikesCount(post.dislikes);
    setReaction(post.userReaction ?? null);
  }, [post.id, post.likes, post.dislikes, post.userReaction]);
  const [media, setMedia] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(() => isPostSaved(post.id));
  const [guestPrompt, setGuestPrompt] = useState(null); // null | "like" | "save"

  const isGuest = !session?.type || session?.type === "PRIMITIVE";

  // Translation state — store full-text translations (not truncated)
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedFullText, setTranslatedFullText] = useState(null); // full body
  const [showTranslated, setShowTranslated] = useState(false);

  const postRef = useRef(null);
  const visibleStart = useRef(null);
  const viewSent = useRef(false);

  const react = async (type) => {
    if (isGuest) { setGuestPrompt("like"); return; }
    await ensureUserInitialized();
    const userId = getUserId();
    const reactUrl = post.isTopicPost
      ? `/api/topics/${post.topicId}/posts/${post.id}/react?userId=${userId}&type=${type}`
      : `/api/posts/${post.id}/react?userId=${userId}&type=${type}`;
    const res = await apiFetch(reactUrl, { method: "PUT" });
    if (!res.ok) {
      console.error("React failed");
      return;
    }
    const data = await res.json();
    setLikesCount(data.likes);
    setDislikesCount(data.dislikes);
    setReaction(data.userReaction ?? (data.status === "REMOVED" ? null : type));
  };

  const sendView = async () => {
    if (post.isTopicPost) return;
    if (viewSent.current) return;
    viewSent.current = true;
    await ensureUserInitialized();
    const userId = getUserId();
    await apiFetch(`/api/posts/${post.id}/view?userId=${userId}`, {
      method: "POST",
    });
  };

  const sendTimeSpent = async (seconds) => {
    if (post.isTopicPost) return;
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
    if (isGuest) { setGuestPrompt("save"); return; }
    if (post.isTopicPost) {
      // Topic posts are saved/unsaved locally only (no backend endpoint)
      const { getLocalSavedPosts } = await import("../utils/savedPosts");
      if (isSaved) {
        const saved = getLocalSavedPosts().filter((p) => p.id !== post.id);
        localStorage.setItem("newsbridge_saved_posts", JSON.stringify(saved));
        setIsSaved(false);
      } else {
        const saved = getLocalSavedPosts();
        const exists = saved.some((p) => p.id === post.id);
        if (!exists) {
          saved.unshift({ ...post, savedAt: Date.now(), collections: [], note: "" });
          localStorage.setItem("newsbridge_saved_posts", JSON.stringify(saved));
        }
        setIsSaved(true);
      }
      return;
    }
    if (isSaved) {
      try { await unsavePost(post.id); } catch (err) { console.warn("Unsave failed:", err); }
      setIsSaved(false);
    } else {
      try { await savePost(post); } catch (err) { console.warn("Save failed:", err); }
      setIsSaved(true);
    }
  };

  // Translate full title + full body text (not the truncated preview)
  const handleTranslate = async () => {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (!needsTranslation) return;
    setIsTranslating(true);
    try {
      const targetLang = getTranslationTargetLang(lang);

      if (post.title) {
        const t = await translateText(post.title, postLang, targetLang);
        setTranslatedTitle(t || post.title);
      }
      const fullText = post.text || "";
      if (fullText) {
        const t = await translateText(fullText, postLang, targetLang);
        setTranslatedFullText(t || fullText);
      }
      setShowTranslated(true);
    } catch (err) {
      console.error("Translation error:", err.message);
    } finally {
      setIsTranslating(false);
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

  // Determine which text to display for the card (truncated or full)
  const displayText = showTranslated && translatedFullText ? translatedFullText : (post.text || "");
  const MAX_CHARS = 220;
  const isLongText = displayText.length > MAX_CHARS;
  const previewText = isLongText ? displayText.slice(0, MAX_CHARS) + "..." : displayText;

  const numImages = post.numImages || 0;

  useEffect(() => {
    // If this is a topic post with mediaItems array, use that directly
    if (post.isTopicPost && post.mediaItems && Array.isArray(post.mediaItems) && post.mediaItems.length > 0) {
      setMedia(post.mediaItems);
      return;
    }
    // If this is a topic post with direct mediaUrl, use that directly
    if (!post.articleId && post.mediaUrl) {
      setMedia([{ type: post.mediaType || 'image', url: post.mediaUrl }]);
      return;
    }
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
  }, [post.articleId, post.mediaUrl, post.mediaType, post.isTopicPost, post.mediaItems]);

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
  const publishedLabel = formatPublishedAt(post.articleCreatedAt, lang);

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

  // Build props to pass to PostModal so it uses the same translated text
  const modalPost = {
    ...post,
    _translatedTitle: showTranslated ? translatedTitle : null,
    _translatedText: showTranslated ? translatedFullText : null,
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
            {t(`category_${post.label}`, post.label)}
          </span>
          {publishedLabel && <span className="post-time">{publishedLabel}</span>}
        </div>

        {/* Author info for topic posts — bigger avatar, clickable to profile */}
        {post.isTopicPost && (
          <div
            className="flex items-center gap-3 mt-2 mb-1 cursor-pointer hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation();
              if (post.authorId) {
                window.location.href = `/profile/${post.authorId}`;
              }
            }}
          >
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.authorName || "Editor"}
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-200"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 border-2 border-blue-200">
                {(post.authorName || "E")[0].toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-sm font-semibold text-gray-800">{post.authorName || "Editor"}</span>
              <span className="text-xs text-blue-500 block">View Profile →</span>
            </div>
          </div>
        )}

        {post.title && (
          <h3 className="post-title">
            {showTranslated && translatedTitle ? translatedTitle : post.title}
          </h3>
        )}

        <div className="post-text">
          {previewText}
        </div>

        {isLongText && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            className="post-show-more"
          >
            {t("showMore")}
          </button>
        )}

        {/* Translate link — translates full text, truncation applies on top */}
        {needsTranslation && (
          <button
            onClick={(e) => { e.stopPropagation(); handleTranslate(); }}
            disabled={isTranslating}
            style={{
              display: "inline-block", marginTop: "8px", fontSize: "0.85rem",
              fontWeight: 600, color: "var(--text-muted)", background: "none",
              border: "none", cursor: "pointer", fontFamily: "var(--font-sans)",
              transition: "color var(--transition-fast)", padding: 0,
            }}
          >
            {isTranslating ? t("translating") : showTranslated ? t("viewOriginal") : getTranslateButtonLabel(lang, t)}
          </button>
        )}

        {renderImages()}

        {postLang && (
          <span className="post-lang" title={t("postLanguage")}>
            {getLanguageDisplayLabel(postLang, t)}
          </span>
        )}

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
            💬 {t("comment")}
          </button>

          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!onAskAI) return;
              onAskAI(post);
              // Only try to ingest into AI backend for regular posts (not topic posts)
              if (!post.isTopicPost) {
                try {
                  await fetch(`${AI_BASE_URL}/ingest/post/${post.id}`, {
                    method: "POST",
                  });
                } catch (err) {
                  console.error("Failed to ingest post into AI", err);
                }
              }
            }}
            className="post-action-btn ai-btn"
          >
            🤖 {t("askAI")}
          </button>

          <button
            onClick={handleToggleSave}
            className={`post-action-btn ${isSaved ? "saved" : ""}`}
          >
            {isSaved ? "📂" : "💾"} {isSaved ? t("saved") : t("save")}
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
            🔗 {t("visit")}
          </button>
        </div>
      </div>

      {isModalOpen && (
        <PostModal
          post={modalPost}
          onClose={closeModal}
        />
      )}
      {isCommentsOpen && (
        <PostCommentsModal post={post} onClose={() => setIsCommentsOpen(false)} />
      )}
      {guestPrompt && (
        <GuestSignupPrompt
          action={guestPrompt === "like" ? "like or dislike posts" : "save articles"}
          onClose={() => setGuestPrompt(null)}
        />
      )}
    </>
  );
}
