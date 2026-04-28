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

  // NEW: popup state
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Main Modal */}
      <div className="relative z-50 bg-white w-[95%] max-w-screen-2xl h-[90%] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">
            {post.title || "Untitled Post"}
          </h1>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-600 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left content */}
          <div
            ref={textPaneRef}
            className="w-full md:w-2/3 p-5 overflow-y-auto border-r"
          >
            <div className="text-sm text-gray-500 mb-4">
              {post.label} {post.lang ? `· ${post.lang}` : ""}
            </div>

            {isLoading ? (
              <div className="text-sm text-gray-500">
                Loading article details...
              </div>
            ) : (
              <div className="space-y-6">
                {content.map((item, contentIndex) => {
                  if (item.type === "paragraph") {
                    return (
                      <p
                        key={`paragraph-${contentIndex}`}
                        className="text-gray-700 leading-relaxed whitespace-pre-line"
                      >
                        {item.text}
                      </p>
                    );
                  }

                  if (item.type === "media" && item.url) {
                    const mediaIndex = mediaItems.findIndex(
                      (media) => media.contentIndex === contentIndex
                    );

                    return (
                      <div
                        key={`media-${contentIndex}`}
                        data-media-index={mediaIndex}
                        ref={(node) => {
                          if (node) {
                            mediaRefs.current.set(mediaIndex, node);
                          } else {
                            mediaRefs.current.delete(mediaIndex);
                          }
                        }}
                        className="rounded-xl border border-gray-200 p-2 bg-gray-50 cursor-zoom-in"
                        onClick={() => setSelectedMedia(item)}
                      >
                        {renderMedia(item, "max-h-[1000px]")}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="hidden md:flex md:w-1/3 flex-col p-5 bg-gray-50 border-l gap-4">
            <h2 className="font-semibold text-gray-700">
              Media ({mediaItems.length})
            </h2>

            <div
              className="rounded-xl border bg-white p-2 min-h-[250px] flex items-center justify-center cursor-zoom-in"
              onClick={() =>
                activeMedia && setSelectedMedia(activeMedia)
              }
            >
              {activeMedia ? (
                renderMedia(activeMedia, "max-h-[320px]")
              ) : (
                <div className="text-sm text-gray-500">
                  No media available.
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="flex gap-2 pb-1">
                {mediaItems.map((item, index) => (
                  <button
                    key={`thumb-${item.contentIndex}`}
                    onClick={() => scrollToMedia(index)}
                    className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                      activeMediaIndex === index
                        ? "border-blue-500"
                        : "border-transparent hover:border-blue-300"
                    }`}
                  >
                    {item.mediaType === "video" ? (
                      <div className="w-full h-full bg-slate-900 text-white text-xs flex items-center justify-center">
                        Video
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt="media-thumb"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition text-gray-700 font-medium"
          >
            Collapse
          </button>

          <button
            onClick={openOriginalArticle}
            className={`px-4 py-2 rounded-lg transition text-white font-medium ${
              post.articleUrl
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-300 cursor-not-allowed"
            }`}
            disabled={!post.articleUrl}
          >
            Visit Original Article
          </button>
        </div>
      </div>

      {/* LIGHTBOX POPUP */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="relative max-w-5xl w-[90%] max-h-[90%]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute -top-10 right-0 text-white text-2xl font-bold"
            >
              ✕
            </button>

            {renderMedia(
              selectedMedia,
              "max-h-[85vh] w-full object-contain rounded-lg"
            )}
          </div>
        </div>
      )}
    </div>
  );
}