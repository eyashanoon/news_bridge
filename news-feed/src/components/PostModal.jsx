import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

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

export default function PostModal({ post, onClose }) {
  const [content, setContent] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);

  const textPaneRef = useRef(null);
  const mediaRefs = useRef(new Map());

  useEffect(() => {
    if (!post?.id) return;

    const loadContent = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch(`/api/posts/${post.id}/content`);
        if (!res.ok) throw new Error("Failed to load post content");
        const data = await res.json();
        const orderedContent = Array.isArray(data?.content) ? data.content : [];

        if (orderedContent.length > 0) {
          setContent(orderedContent);
        } else {
          setContent(fallbackContentFromText(post.text));
        }
      } catch (error) {
        console.error("Failed to load ordered post content", error);
        setContent(fallbackContentFromText(post.text));
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [post?.id, post?.text]);

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

        const targetIndex = Number(
          visible[0].target.getAttribute("data-media-index")
        );

        if (!Number.isNaN(targetIndex)) {
          setActiveMediaIndex(targetIndex);
        }
      },
      {
        root: textPaneRef.current,
        threshold: [0.4, 0.65, 0.9],
      }
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

    const targetTop =
      node.offsetTop - container.clientHeight / 2 + node.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });

    setActiveMediaIndex(mediaIndex);
  };

  const openOriginalArticle = () => {
    if (!post?.articleUrl) return;

    apiFetch(`/api/posts/${post.id}/click`, {
      method: "POST",
    }).catch((error) => {
      console.error("Failed to track article click", error);
    });

    window.open(post.articleUrl, "_blank", "noopener,noreferrer");
  };

  if (!post) return null;

  const activeMedia = mediaItems[activeMediaIndex] || null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-header">
            <h2>{post.title || "Untitled Post"}</h2>
            <button onClick={onClose} className="modal-close" aria-label="Close">✕</button>
          </div>

          {/* Body */}
          <div className="modal-body">
            <div ref={textPaneRef} className="modal-text-pane">
              <div className="meta-row">
                {post.label} {post.lang ? `· ${post.lang}` : ""}
              </div>

              {isLoading ? (
                <div className="text-sm text-gray-500">Loading article details...</div>
              ) : (
                content.map((item, contentIndex) => {
                  if (item.type === "paragraph") {
                    return (
                      <div key={`p-${contentIndex}`} className="content-block">
                        <p>{item.text}</p>
                      </div>
                    );
                  }

                  if (item.type === "media" && item.url) {
                    const mediaIndex = mediaItems.findIndex(
                      (media) => media.contentIndex === contentIndex
                    );

                    return (
                      <div
                        key={`m-${contentIndex}`}
                        data-media-index={mediaIndex}
                        ref={(node) => {
                          if (node) {
                            mediaRefs.current.set(mediaIndex, node);
                          } else {
                            mediaRefs.current.delete(mediaIndex);
                          }
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
            </div>

            {/* Right media panel */}
            <div className="modal-media-pane">
              <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">
                Media ({mediaItems.length})
              </h3>

              <div
                className="modal-media-stage"
                onClick={() => activeMedia && setSelectedMedia(activeMedia)}
              >
                {activeMedia ? (
                  renderMedia(activeMedia, "max-h-[360px]")
                ) : (
                  <div className="no-media">No media available.</div>
                )}
              </div>

              {mediaItems.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2 font-medium">
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
              Collapse
            </button>

            <button
              onClick={openOriginalArticle}
              className="btn btn-primary"
              disabled={!post.articleUrl}
              style={{ opacity: post.articleUrl ? 1 : 0.4 }}
            >
              Visit Original Article
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {selectedMedia && (
        <div className="lightbox" onClick={() => setSelectedMedia(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close"
              onClick={() => setSelectedMedia(null)}
            >
              ✕
            </button>
            {renderMedia(selectedMedia, "max-h-[85vh] w-full object-contain rounded-lg")}
          </div>
        </div>
      )}
    </>
  );
}