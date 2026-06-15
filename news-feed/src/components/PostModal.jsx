import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import {
  detectItemLanguage,
  contentSampleFromBlocks,
  normalizeLang,
  getTranslationTargetLang,
  getTranslateButtonLabel,
  getLanguageDisplayLabel,
} from "../utils/languageUtils";
import { translateText } from "../utils/translateUtils";
import { searchPosts } from "../api/searchApi";
import { categoryTheme } from "../utils/categoryColors";

const POST_PLACEHOLDER_IMG =
  "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";

function renderMedia(item, className = "") {
  if (item.mediaType === "video") {
    return (
      <video
        src={item.url}
        controls
        className={`w-full rounded-lg bg-black ${className}`.trim()}
      />
    );
  }
  return (
    <img
      src={item.url}
      alt="article-media"
      className={`w-full rounded-lg object-contain ${className}`.trim()}
    />
  );
}

function fallbackContentFromText(text) {
  if (!text) return [];
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((paragraph, index) => ({
    type: "paragraph",
    text: paragraph,
    sortOrder: index + 1,
  }));
}

function formatRelativeTime(value, lang) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 7) {
    return date.toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
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

export default function PostModal({ post, onClose }) {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const lang = i18n.language;
  const isArabic = lang === "ar";

  const [currentPost, setCurrentPost] = useState(post);
  const [content, setContent] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Translation state — re-detect from loaded paragraph blocks when available
  const postLang = detectItemLanguage(currentPost, contentSampleFromBlocks(content));
  const needsTranslation = Boolean(postLang && postLang !== normalizeLang(lang));
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(currentPost._translatedTitle || null);
  const [translatedText, setTranslatedText] = useState(currentPost._translatedText || null);
  const [showTranslated, setShowTranslated] = useState(!!(currentPost._translatedTitle || currentPost._translatedText));

  // Sync with pre-translated props
  useEffect(() => {
    if (currentPost._translatedTitle !== undefined) setTranslatedTitle(currentPost._translatedTitle);
    if (currentPost._translatedText !== undefined) setTranslatedText(currentPost._translatedText);
    if (currentPost._translatedTitle || currentPost._translatedText) setShowTranslated(true);
  }, [currentPost._translatedTitle, currentPost._translatedText]);

  // Reset translation state when post changes
  useEffect(() => {
    setShowTranslated(false);
    setTranslatedTitle(null);
    setTranslatedText(null);
    setIsTranslating(false);
  }, [currentPost?.id]);

  const translatedParagraphs = useMemo(() => {
    if (!showTranslated || !translatedText) return null;
    return translatedText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [showTranslated, translatedText]);

  const textPaneRef = useRef(null);
  const mediaRefs = useRef(new Map());

  // Load post content
  useEffect(() => {
    if (!currentPost?.id) return;

    // If post has embedded _content blocks (from topic posts), use those directly
    if (currentPost._content && Array.isArray(currentPost._content) && currentPost._content.length > 0) {
      setContent(currentPost._content);
      setIsLoading(false);
      return;
    }

    const loadContent = async () => {
      setIsLoading(true);
      setContent([]);
      setActiveMediaIndex(0);
      setSelectedMedia(null);
      try {
        const res = await apiFetch(`/api/posts/${currentPost.id}/content`);
        if (!res.ok) throw new Error("Failed to load post content");
        const data = await res.json();
        const orderedContent = Array.isArray(data?.content) ? data.content : [];
        if (orderedContent.length > 0) {
          setContent(orderedContent);
        } else {
          setContent(fallbackContentFromText(currentPost.text));
        }
      } catch (error) {
        console.error("Failed to load ordered post content", error);
        setContent(fallbackContentFromText(currentPost.text));
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [currentPost?.id, currentPost?.text, currentPost?._content]);

  // Fetch related posts (same category, excluding current post)
  useEffect(() => {
    if (!currentPost?.id) return;

    const loadRelated = async () => {
      setRelatedLoading(true);
      try {
        const tagQuery = currentPost.tags?.length > 0
          ? currentPost.tags.slice(0, 2).join(" ")
          : "";

        // Fetch posts in the same category
        const sameCategory = await searchPosts({
          query: tagQuery || "",
          category: currentPost.label || "",
          sortBy: "date",
          limit: 8,
        });

        // Filter out current post
        const filtered = (Array.isArray(sameCategory) ? sameCategory : [])
          .filter((p) => p.id !== currentPost.id)
          .slice(0, 6);

        setRelatedPosts(filtered);

        // If not enough from category, try fetching recent posts from same category
        if (filtered.length < 4) {
          const morePosts = await searchPosts({
            query: currentPost.title ? currentPost.title.split(" ").slice(0, 3).join(" ") : "",
            category: currentPost.label || "",
            sortBy: "relevance",
            limit: 8,
          });
          const moreFiltered = (Array.isArray(morePosts) ? morePosts : [])
            .filter((p) => p.id !== currentPost.id && !filtered.some((f) => f.id === p.id))
            .slice(0, 6 - filtered.length);
          if (moreFiltered.length > 0) {
            setRelatedPosts((prev) => [...prev, ...moreFiltered]);
          }
        }
      } catch (err) {
        console.error("Failed to load related posts:", err);
        setRelatedPosts([]);
      } finally {
        setRelatedLoading(false);
      }
    };

    loadRelated();
  }, [currentPost?.id, currentPost?.label, currentPost?.tags, currentPost?.title]);

  const handleTranslate = async () => {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (!needsTranslation) return;
    setIsTranslating(true);
    try {
      const targetLang = getTranslationTargetLang(lang);
      if (currentPost.title) {
        const result = await translateText(currentPost.title, postLang, targetLang);
        setTranslatedTitle(result || currentPost.title);
      }
      if (currentPost.text) {
        const result = await translateText(currentPost.text, postLang, targetLang);
        setTranslatedText(result || currentPost.text);
      }
      setShowTranslated(true);
    } catch (err) {
      console.error("Modal translation error:", err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const mediaItems = useMemo(
    () =>
      content
        .map((item, index) => ({ ...item, contentIndex: index }))
        .filter((item) => item.type === "media" && item.url),
    [content]
  );

  useEffect(() => {
    if (activeMediaIndex >= mediaItems.length) {
      setActiveMediaIndex(0);
    }
  }, [activeMediaIndex, mediaItems.length]);

  useEffect(() => {
    if (!textPaneRef.current || mediaItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length === 0) return;
        const targetIndex = Number(visible[0].target.getAttribute("data-media-index"));
        if (!Number.isNaN(targetIndex)) {
          setActiveMediaIndex(targetIndex);
        }
      },
      { root: textPaneRef.current, threshold: [0.4, 0.65, 0.9] }
    );

    mediaItems.forEach((_, mediaIndex) => {
      const node = mediaRefs.current.get(mediaIndex);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [mediaItems]);

  const scrollToMedia = (mediaIndex) => {
    const container = textPaneRef.current;
    const node = mediaRefs.current.get(mediaIndex);
    if (!container || !node) return;
    const targetTop = node.offsetTop - container.clientHeight / 2 + node.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    setActiveMediaIndex(mediaIndex);
  };

  const openOriginalArticle = () => {
    if (!currentPost?.articleUrl) return;
    apiFetch(`/api/posts/${currentPost.id}/click`, { method: "POST" }).catch((error) => {
      console.error("Failed to track article click", error);
    });
    window.open(currentPost.articleUrl, "_blank", "noopener,noreferrer");
  };

  const handleRelatedClick = (relatedPost) => {
    // Scroll text pane to top when switching posts
    if (textPaneRef.current) {
      textPaneRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Switch to the clicked post - state resets will happen via useEffects
    setCurrentPost(relatedPost);
  };

  if (!currentPost) return null;

  const activeMedia = mediaItems[activeMediaIndex] || null;
  const displayTitle = showTranslated && translatedTitle ? translatedTitle : (currentPost.title || t("untitledPost"));

  const theme = darkMode ? "dark" : "light";

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-header">
            <h2 style={{ textAlign: isArabic ? "right" : "left" }}>{displayTitle}</h2>
            <button onClick={onClose} className="modal-close" aria-label="Close">✕</button>
          </div>

          {/* Body */}
          <div className="modal-body">
            <div ref={textPaneRef} className="modal-text-pane" style={{ textAlign: isArabic ? "right" : "left" }}>
              <div className="meta-row">
                {currentPost.label ? t(`category_${currentPost.label}`, currentPost.label) : ""}
                {postLang ? ` · ${getLanguageDisplayLabel(postLang, t)}` : ""}
              </div>

              {/* Topic context for topic posts */}
              {currentPost.isTopicPost && (
                <>
                  {/* Topic info banner */}
                  {currentPost.topicTitle && (
                    <div className="modal-topic-context">
                      <div className="modal-topic-context-header">
                        <span className="modal-topic-label">📰 Topic</span>
                        <span className="modal-topic-name">{currentPost.topicTitle}</span>
                      </div>
                      {currentPost.topicTags?.length > 0 && (
                        <div className="modal-topic-tags">
                          {currentPost.topicTags.slice(0, 5).map((tag, i) => (
                            <span key={i} className="modal-topic-tag">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Author info for topic posts in modal — clickable to profile */}
                  {currentPost.authorName && (
                    <div
                      className="flex items-center gap-3 mt-3 mb-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all hover:bg-gray-50"
                      style={{
                        border: "1px solid rgba(0,0,0,0.06)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                      onClick={() => {
                        if (currentPost.authorId) {
                          window.open(`/profile/${currentPost.authorId}`, "_self");
                        }
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        {currentPost.authorAvatar ? (
                          <img
                            src={currentPost.authorAvatar}
                            alt={currentPost.authorName}
                            className="w-11 h-11 rounded-full object-cover"
                            style={{ border: "2px solid #3b82f6", boxShadow: "0 0 0 2px rgba(59,130,246,0.15)" }}
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextElementSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className="w-11 h-11 rounded-full items-center justify-center text-base font-bold"
                          style={{
                            display: currentPost.authorAvatar ? "none" : "flex",
                            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                            color: "#fff",
                            boxShadow: "0 0 0 2px rgba(59,130,246,0.15)",
                          }}
                        >
                          {(currentPost.authorName || "E")[0].toUpperCase()}
                        </div>
                        {/* Online dot indicator */}
                        <div
                          className="absolute rounded-full"
                          style={{
                            width: 10, height: 10, bottom: 0, right: 0,
                            background: "#22c55e",
                            border: "2px solid #fff",
                            boxShadow: "0 0 0 1px rgba(34,197,94,0.3)",
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p className="text-sm font-semibold" style={{ color: "var(--text, #1f2937)", lineHeight: 1.3 }}>
                          {currentPost.authorName}
                        </p>
                        <p
                          className="text-xs font-medium"
                          style={{ color: "#3b82f6", display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}
                        >
                          {lang === "ar" ? "عرض الملف الشخصي" : "View Profile"}
                          <span style={{ fontSize: 10, transition: "transform 0.15s" }}>→</span>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {isLoading ? (
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>{t("loadingArticleDetails")}</div>
              ) : translatedParagraphs ? (
                content.map((item, contentIndex) => {
                  if (item.type === "paragraph" && item.paragraphIndex !== undefined) {
                    const paraText = translatedParagraphs[item.paragraphIndex];
                    if (!paraText) return null;
                    return (
                      <div key={`p-${contentIndex}`} className="content-block"><p>{paraText}</p></div>
                    );
                  }
                  if (item.type === "paragraph") {
                    const paraIdx = content.filter((c) => c.type === "paragraph").indexOf(item);
                    const paraText = translatedParagraphs[paraIdx];
                    if (!paraText) return null;
                    return (
                      <div key={`p-${contentIndex}`} className="content-block"><p>{paraText}</p></div>
                    );
                  }
                  if (item.type === "media" && item.url) {
                    const mediaIndex = mediaItems.findIndex((m) => m.contentIndex === contentIndex);
                    return (
                      <div
                        key={`m-${contentIndex}`}
                        data-media-index={mediaIndex}
                        ref={(node) => {
                          if (node) mediaRefs.current.set(mediaIndex, node);
                          else mediaRefs.current.delete(mediaIndex);
                        }}
                        className="content-block media-block"
                        onClick={() => setSelectedMedia(item)}
                      >
                        {renderMedia(item, "max-h-[1000px]")}
                      </div>
                    );
                  }
                  return null;
                })
              ) : (
                content.map((item, contentIndex) => {
                  if (item.type === "paragraph") {
                    return (
                      <div key={`p-${contentIndex}`} className="content-block"><p>{item.text}</p></div>
                    );
                  }
                  if (item.type === "media" && item.url) {
                    const mediaIndex = mediaItems.findIndex((m) => m.contentIndex === contentIndex);
                    return (
                      <div
                        key={`m-${contentIndex}`}
                        data-media-index={mediaIndex}
                        ref={(node) => {
                          if (node) mediaRefs.current.set(mediaIndex, node);
                          else mediaRefs.current.delete(mediaIndex);
                        }}
                        className="content-block media-block"
                        onClick={() => setSelectedMedia(item)}
                      >
                        {renderMedia(item, "max-h-[1000px]")}
                      </div>
                    );
                  }
                  return null;
                })
              )}

              {/* Translate link */}
              {needsTranslation && (
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  style={{
                    marginTop: 16, fontSize: "0.85rem", fontWeight: 600,
                    color: "var(--text-muted)", background: "none", border: "none",
                    cursor: "pointer", fontFamily: "var(--font-sans)",
                    transition: "color var(--transition-fast)", padding: 0,
                  }}
                >
                  {isTranslating ? t("translating") : showTranslated ? t("viewOriginal") : getTranslateButtonLabel(lang, t)}
                </button>
              )}

              {currentPost.tags?.length > 0 && (
                <div className="post-tags">
                  {currentPost.tags.map((tag, idx) => (
                    <span key={idx} className="post-tag">#{tag}</span>
                  ))}
                </div>
              )}

              {/* Related Posts Section */}
              <section className="related-posts-section" aria-label={t("relatedPosts")}>
                <div className="related-posts-header">
                  <h3 className="related-posts-title">{t("relatedPosts")}</h3>
                  {!relatedLoading && relatedPosts.length > 0 && (
                    <span className="related-posts-count">{relatedPosts.length}</span>
                  )}
                </div>
                {relatedLoading ? (
                  <div className="related-posts-loading">
                    <div className="related-post-skeleton" />
                    <div className="related-post-skeleton" />
                    <div className="related-post-skeleton" />
                  </div>
                ) : relatedPosts.length === 0 ? (
                  <div className="related-posts-empty">{t("noRelatedPosts")}</div>
                ) : (
                  <div className="related-posts-scroll">
                    {relatedPosts.map((rp) => (
                      <RelatedPostCard
                        key={rp.id}
                        post={rp}
                        onClick={() => handleRelatedClick(rp)}
                        darkMode={darkMode}
                        lang={lang}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right media panel */}
            <div className="modal-media-pane">
              <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {t("media")} ({mediaItems.length})
              </h3>
              <div
                className="modal-media-stage"
                onClick={() => activeMedia && setSelectedMedia(activeMedia)}
              >
                {activeMedia ? (
                  renderMedia(activeMedia, "max-h-[360px]")
                ) : (
                  <div className="no-media">{t("noMedia")}</div>
                )}
              </div>
              {mediaItems.length > 0 && (
                <div>
                  <div className="text-xs mb-2 font-medium" style={{ color: "var(--text-muted)" }}>
                    {activeMediaIndex + 1} / {mediaItems.length}
                  </div>
                  <div className="modal-media-thumbs">
                    {mediaItems.map((item, index) => (
                      <button
                        key={`thumb-${item.contentIndex}`}
                        onClick={() => scrollToMedia(index)}
                        className={`modal-thumb ${activeMediaIndex === index ? "active" : ""}`}
                      >
                        {item.mediaType === "video" ? (
                          <div className="thumb-video-label">Video</div>
                        ) : (
                          <img src={item.url} alt="media-thumb" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button onClick={onClose} className="btn btn-ghost">
              {t("collapse")}
            </button>
            <button
              onClick={openOriginalArticle}
              className="btn btn-primary"
              disabled={!currentPost.articleUrl}
              style={{ opacity: currentPost.articleUrl ? 1 : 0.4 }}
            >
              {t("visitOriginalArticle")}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {selectedMedia && (
        <div className="lightbox" onClick={() => setSelectedMedia(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setSelectedMedia(null)}>✕</button>
            {renderMedia(selectedMedia, "max-h-[85vh] w-full object-contain rounded-lg")}
          </div>
        </div>
      )}
    </>
  );
}

function RelatedPostCard({ post, onClick, darkMode, lang, t }) {
  const theme = darkMode ? "dark" : "light";
  const postTheme = categoryTheme[post.label]?.[theme] || categoryTheme.General[theme];
  const accent = postTheme?.accent || "var(--brand-500)";

  const publishedLabel = formatRelativeTime(post.articleCreatedAt, lang);

  const truncate = (text, max = 96) => {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };

  const [media, setMedia] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(true);

  useEffect(() => {
    if (!post.id) {
      setMediaLoading(false);
      return;
    }
    let cancelled = false;
    const loadMedia = async () => {
      setMediaLoading(true);
      try {
        const res = await apiFetch(`/api/posts/${post.id}/media`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setMedia(data);
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    };
    loadMedia();
    return () => { cancelled = true; };
  }, [post.id]);

  const imageCount = media && Array.isArray(media) ? media.length : (post.numImages || 0);
  const showImages = imageCount > 0;
  const imagesToShow = media && Array.isArray(media) && media.length > 0
    ? media.slice(0, 3)
    : Array.from({ length: Math.min(imageCount, 3) }).map(() => ({ url: POST_PLACEHOLDER_IMG, mediaType: "image" }));
  const extraCount = Math.max(0, imageCount - 3);
  const collageClass = imagesToShow.length === 1
    ? "related-post-media--single"
    : imagesToShow.length === 2
      ? "related-post-media--duo"
      : "related-post-media--trio";

  return (
    <article
      className="related-post-card"
      onClick={onClick}
      style={{ "--related-accent": accent }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {showImages && (
        <div className={`related-post-media ${collageClass}${mediaLoading ? " is-loading" : ""}`}>
          {imagesToShow.map((item, idx) => {
            const isVideo = item.mediaType === "video" || item.type === "video";
            const showMoreOverlay = idx === 2 && extraCount > 0;
            return (
              <div key={`${post.id}-media-${idx}`} className="related-post-media-cell">
                <img
                  className="related-post-media-image"
                  src={isVideo ? POST_PLACEHOLDER_IMG : (item.url || POST_PLACEHOLDER_IMG)}
                  alt=""
                  loading="lazy"
                />
                {isVideo && <span className="related-post-media-badge">Video</span>}
                {showMoreOverlay && (
                  <span className="related-post-media-more">+{extraCount}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="related-post-body">
        <div className="related-post-meta">
          {post.label && (
            <span
              className="related-post-category"
              style={{
                background: postTheme?.pillBg || "var(--brand-500)",
                color: postTheme?.pillText || "#ffffff",
              }}
            >
              {t(`category_${post.label}`, post.label)}
            </span>
          )}
          {publishedLabel && <span className="related-post-time">{publishedLabel}</span>}
        </div>

        <h4 className="related-post-title">{post.title || t("untitledPost")}</h4>
        {post.text && <p className="related-post-preview">{truncate(post.text)}</p>}

        <div className="related-post-footer">
          <span className="related-post-cta">{t("readMore", "Read more")}</span>
          <span className="related-post-arrow" aria-hidden="true">→</span>
        </div>
      </div>
    </article>
  );
}
