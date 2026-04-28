// Post.jsx
import { useEffect, useRef, useState } from "react";
import { categoryColors } from "../utils/categoryColors";
import { getUserId } from "../utils/userId";
import PostModal from "./PostModal";
import PostCommentsModal from "./PostCommentsModal";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";

export default function Post({ post, onAskAI}) {
  const colors = categoryColors[post.label] || {};

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
    // try to load media (images/videos) for the related article from the backend
    const loadMedia = async () => {
      if (!post.articleId) return;

      try {
        const res = await apiFetch(`/api/posts/${post.id}/media`);
        if (!res.ok) return;
        const data = await res.json();

        // Expect data to be an array of { type: 'image'|'video', url: string }
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
            className="w-full rounded-lg object-cover h-48 bg-black"
          />
        );
      }

      const common = {
        key: idx,
        src: item.url,
        alt: 'post',
        className: 'w-full rounded-lg object-cover h-48',
      };

      if (idx === 2 && extraCount > 0) {
        return (
          <div key={idx} className="relative">
            <img {...common} className="w-full rounded-lg object-cover h-48 brightness-50" />
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl">
              +{extraCount}
            </div>
          </div>
        );
      }

      return <img {...common} />;
    };

    if (count === 1) {
      return (
        <div className="mt-4">
          {items[0].type === 'video' ? (
            <video src={items[0].url} controls className="w-full rounded-lg object-cover max-h-80" />
          ) : (
            <img src={items[0].url} alt="post" className="w-full rounded-lg object-cover max-h-80" />
          )}
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {items.slice(0, 2).map((it, idx) => renderMediaElement(it, idx, 0))}
        </div>
      );
    }

    const extraCount = Math.max(0, count - 3);
    return (
      <div className="mt-4 grid grid-cols-3 gap-2">
        {items.slice(0, 3).map((it, idx) => renderMediaElement(it, idx, extraCount))}
      </div>
    );
  };

  return (
    <>
      <div
        ref={postRef}
        onClick={openModal}
        className={`cursor-pointer bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border-l-4 ${
          colors.border || ""
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className={`text-xs font-semibold ${colors.text || ""}`}>
            {post.label}
          </div>
          {publishedLabel ? (
            <div className="text-xs text-gray-400 text-right">{publishedLabel}</div>
          ) : null}
        </div>

        {post.title && (
          <h2 className="text-lg font-bold text-gray-800 mb-2">{post.title}</h2>
        )}

        <p className="text-gray-700 whitespace-pre-line">{previewText}</p>

        {isLongText && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            className="text-blue-600 font-medium text-sm mt-2 hover:underline"
          >
            Show more...
          </button>
        )}

        {renderImages()}

        <div className="text-xs text-gray-400 mt-3">{post.lang}</div>

        <div className="flex flex-wrap gap-2 mt-3">
          {post.tags?.map((t, idx) => (
            <span
              key={idx}
              className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full"
            >
              #{t}
            </span>
          ))}
        </div>

        <div
          className="flex justify-around items-center mt-4 pt-2 border-t text-sm text-gray-500"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => react("LIKE")}
            className={`flex items-center gap-1 transition ${
              reaction === "LIKE"
                ? "text-blue-500 font-bold"
                : "hover:text-blue-500"
            }`}
          >
            👍 {likesCount}
          </button>

          <button
            onClick={() => react("DISLIKE")}
            className={`flex items-center gap-1 transition ${
              reaction === "DISLIKE"
                ? "text-red-500 font-bold"
                : "hover:text-red-500"
            }`}
          >
            👎 {dislikesCount}
          </button>

          <button
            onClick={() => setIsCommentsOpen(true)}
            className="hover:text-blue-500 transition"
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
            className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition"
          >
            🤖 Ask AI
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              sendClick();
              openOriginalArticle();
            }}
            className={`transition ${
              post.articleUrl
                ? "hover:text-blue-500"
                : "text-gray-300 cursor-not-allowed"
            }`}
            disabled={!post.articleUrl}
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