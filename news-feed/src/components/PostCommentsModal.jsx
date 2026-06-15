import React, { memo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";
import { useTranslation } from "react-i18next";

import { useSession } from "../context/SessionContext";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { getUserId } from "../utils/userId";
import {
  detectItemLanguage,
  needsTranslation as itemNeedsTranslation,
  getTranslationTargetLang,
  getTranslateButtonLabel,
} from "../utils/languageUtils";
import { translateText } from "../utils/translateUtils";

function getAvatarUrl(comment) {
  if (comment.profilePicture && comment.profilePicture.trim()) return comment.profilePicture;
  return "https://ui-avatars.com/api/?name=User&background=0f172a&color=ffffff";
}

const POST_IMAGE_PLACEHOLDER =
  "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";

const gf = new GiphyFetch(import.meta.env.VITE_GIPHY_API_KEY);

function shorten(text, max = 45) {
  if (!text) return "Untitled";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function timeAgo(value, lang = "en") {
  if (!value) return lang === "ar" ? "الآن" : "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return lang === "ar" ? "الآن" : "just now";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return lang === "ar" ? "الآن" : "just now";
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return lang === "ar" ? `منذ ${min} دقائق` : `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return lang === "ar" ? `منذ ${hrs} ساعات` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return lang === "ar" ? `منذ ${days} أيام` : `${days}d ago`;
  return date.toLocaleDateString();
}

function insertReplyIntoTree(nodes, parentCommentId, createdReply) {
  return nodes.map((node) => {
    if (node.id === parentCommentId) {
      return {
        ...node,
        replies: [
          ...(node.replies || []),
          { ...createdReply, replies: createdReply.replies || [] },
        ],
      };
    }
    if (node.replies?.length) {
      return {
        ...node,
        replies: insertReplyIntoTree(node.replies, parentCommentId, createdReply),
      };
    }
    return node;
  });
}

function renderAttachment(comment, onPreviewAttachment) {
  if (!comment.attachmentUrl) return null;
  const openPreview = () =>
    onPreviewAttachment?.({ url: comment.attachmentUrl, type: comment.attachmentType || "image" });

  if (comment.attachmentType === "video" || comment.attachmentUrl?.includes(".mp4")) {
    return (
      <button className="mt-2 block w-full max-w-sm text-left" onClick={openPreview}>
        <video controls className="max-h-56 w-full rounded-lg border border-slate-200">
          <source src={comment.attachmentUrl} />
        </video>
      </button>
    );
  }
  return (
    <button className="mt-2 block w-full max-w-sm text-left" onClick={openPreview}>
      <img src={comment.attachmentUrl} alt="comment attachment" className="max-h-56 w-full rounded-lg border border-slate-200 object-cover" />
    </button>
  );
}

const CommentItem = memo(function CommentItem({
  comment,
  depth = 0,
  onReply,
  voteComment,
  onPreviewAttachment,
  lang = "en",
  navigate,
}) {
  const { t } = useTranslation();
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = (comment.replies || []).length > 0;

  const commentLang = detectItemLanguage(comment);
  const needsCommentTranslation = itemNeedsTranslation(comment, lang);
  const [translatedComment, setTranslatedComment] = useState(null);
  const [showTranslatedComment, setShowTranslatedComment] = useState(false);
  const [isTranslatingComment, setIsTranslatingComment] = useState(false);

  const handleTranslateComment = async () => {
    if (showTranslatedComment) {
      setShowTranslatedComment(false);
      return;
    }
    if (!needsCommentTranslation || !comment.content) return;
    setIsTranslatingComment(true);
    try {
      const targetLang = getTranslationTargetLang(lang);
      const result = await translateText(comment.content, commentLang, targetLang);
      setTranslatedComment(result);
      setShowTranslatedComment(true);
    } catch (err) {
      console.error("Comment translation error:", err.message);
    } finally {
      setIsTranslatingComment(false);
    }
  };

  return (
        <div className={depth > 0 ? "comment-item reply" : "comment-item"}>
          <div className="flex items-start gap-3">
            <Link
              to={comment.profileUsername ? `/profile/${comment.profileUsername}` : "#"}
              onClick={(e) => { if (!comment.profileUsername) e.preventDefault(); }}
              className="flex-shrink-0"
            >
              <img
                src={getAvatarUrl(comment)}
                alt="user avatar"
                className="comment-avatar"
                style={{ cursor: comment.profileUsername ? "pointer" : "default" }}
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  to={comment.profileUsername ? `/profile/${comment.profileUsername}` : "#"}
                  className="comment-author"
                  style={{ textDecoration: "none", cursor: comment.profileUsername ? "pointer" : "default" }}
                >
                  {comment.userIdentifier || `User ${comment.userId}`}
                </Link>
                <span className="comment-time">{timeAgo(comment.createdAt, lang)}</span>
              </div>

          <div className="comment-content">
            {showTranslatedComment && translatedComment ? translatedComment : comment.content}
          </div>

          {needsCommentTranslation && comment.content && (
            <button
              onClick={handleTranslateComment}
              disabled={isTranslatingComment}
              style={{
                marginTop: 4, fontSize: "0.78rem", fontWeight: 600,
                color: "var(--text-muted)", background: "none", border: "none",
                cursor: "pointer", fontFamily: "var(--font-sans)",
                transition: "color var(--transition-fast)", padding: 0,
              }}
            >
              {isTranslatingComment ? t("translating") : showTranslatedComment ? t("viewOriginal") : getTranslateButtonLabel(lang, t)}
            </button>
          )}

          {renderAttachment(comment, onPreviewAttachment)}

          <div className="comment-actions">
            <button
              className={`comment-action-btn ${comment.userVote === 1 ? "voted-up" : ""}`}
              onClick={() => voteComment(comment.id, comment.userVote === 1 ? 0 : 1)}
            >
              ▲
            </button>

            <span className={`comment-vote-score ${comment.voteScore < 0 ? "text-red-500" : ""}`}>
              {comment.voteScore}
            </span>

            <button
              className={`comment-action-btn ${comment.userVote === -1 ? "voted-down" : ""}`}
              onClick={() => voteComment(comment.id, comment.userVote === -1 ? 0 : -1)}
            >
              ▼
            </button>

            <button
              className="comment-action-btn text-blue-600"
              onClick={() => onReply(comment)}
            >
                {t("reply")}
              </button>

            {hasReplies && (
              <button
                className="comment-action-btn"
                onClick={() => setShowReplies((prev) => !prev)}
              >
                {showReplies
                  ? t("hideReplies")
                  : t("showReplies", { count: comment.replies.length })}
              </button>
            )}
          </div>
        </div>
      </div>

              {hasReplies && showReplies && (
        <div className="mt-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              voteComment={voteComment}
              onPreviewAttachment={onPreviewAttachment}
              lang={lang}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function PostCommentsModal({ post, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const nav = useNavigate();
  const { session } = useSession();

  // Only REGISTERED or EDITOR users can comment
  const canComment = session?.type === "REGISTERED" || session?.type === "EDITOR";

  const [sortBy, setSortBy] = useState("recency");
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("trending");
  const [replyingTo, setReplyingTo] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // Helper to make authenticated API calls using the session token from context
  const authFetch = async (url, options = {}) => {
    // For reading comments (GET), we initialize a primitive user for anonymous users
    if (!options.method || options.method === "GET") {
      await ensureUserInitialized();
    }
    const token = session?.token || (await ensureUserInitialized()).token;
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(url, { ...options, headers });
  };

  const fetchRepliesRecursively = async (comment) => {
    const res = await authFetch(`/api/comments/${comment.id}/replies`);
    if (!res.ok) return { ...comment, replies: [] };
    const replies = await res.json();
    const hydratedReplies = await Promise.all(
      (replies || []).map((reply) => fetchRepliesRecursively(reply))
    );
    return { ...comment, replies: hydratedReplies };
  };

  const sortClientSide = (items) => {
    const cloned = [...items];
    if (sortBy === "newest" || sortBy === "recency") {
      return cloned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    if (sortBy === "oldest") {
      return cloned.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    if (sortBy === "most_popular") {
      return cloned.sort((a, b) => (b.voteScore || 0) - (a.voteScore || 0));
    }
    if (sortBy === "relevance") {
      return cloned.sort((a, b) => {
        const scoreA = (a.voteScore || 0) + (a.replies?.length || 0) * 0.75;
        const scoreB = (b.voteScore || 0) + (b.replies?.length || 0) * 0.75;
        return scoreB - scoreA;
      });
    }
    return cloned;
  };

  const loadComments = async () => {
    if (!post?.id) return;
    setLoading(true);
    try {
      const serverSort = sortBy === "most_popular" ? "popularity" : "recency";
      const res = await authFetch(
        `/api/comments/post/${post.id}?sortBy=${serverSort}&page=0&size=50`
      );
      if (!res.ok) throw new Error("Failed to load comments");
      const payload = await res.json();
      const roots = payload.content || [];
      const threaded = await Promise.all(
        roots.map((comment) => fetchRepliesRecursively(comment))
      );
      setComments(sortClientSide(threaded));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [sortBy, post?.id]);

  const uploadAttachmentFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const endpoint = file.type.startsWith("video/")
      ? "/api/upload/video"
      : "/api/upload/image";
    const res = await fetch(endpoint, { method: "POST", body: formData });
    if (!res.ok) throw new Error("Failed to upload attachment");
    const data = await res.json();
    if (!data.url) throw new Error("Upload response missing URL");
    return data.url;
  };

  const submitComment = async ({ content, parentCommentId = null }) => {
    const trimmed = (content || "").trim();
    if (!trimmed && !attachment) return;
    if (!canComment || !session?.token) return;

    try {
      let attachmentUrl = null;
      let attachmentType = null;
      if (attachment?.kind === "gif") {
        attachmentUrl = attachment.url;
        attachmentType = "gif";
      } else if (attachment?.kind === "file") {
        attachmentUrl = await uploadAttachmentFile(attachment.file);
        attachmentType = attachment.file.type.startsWith("video/") ? "video" : "image";
      }
      const res = await authFetch(`/api/comments`, {
        method: "POST",
        body: JSON.stringify({
          postId: post.id,
          content: trimmed || "(attachment)",
          parentCommentId,
          attachmentUrl,
          attachmentType,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Comment submission failed:", res.status, errText);
        throw new Error("Failed to submit comment");
      }
      const created = await res.json();
      setDraft("");
      setAttachment(null);
      setReplyingTo(null);
      setComments((prev) => {
        if (parentCommentId) {
          return insertReplyIntoTree(prev, parentCommentId, created);
        }
        return sortClientSide([
          { ...created, replies: created.replies || [] },
          ...prev,
        ]);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const voteComment = async (commentId, voteType) => {
    try {
      const res = await authFetch(`/api/comments/${commentId}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteType }),
      });
      if (!res.ok) throw new Error("Failed to vote");
      await loadComments();
    } catch (error) {
      console.error(error);
    }
  };

  const postPreview = shorten(post?.text || "", 220);

  return (
    <>
      <div className="comments-modal-overlay" onClick={onClose}>
        <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
          <div className="comments-modal-header">
            <h2>
              {t("postCommentsTitle", { title: shorten(post?.title || t("untitledPost"), 36) })}
            </h2>
            <button onClick={onClose} className="modal-close">✕</button>
          </div>

          <div className="comments-modal-body">
            <div className="comment-preview">
              <h4>{t("postPreview")}</h4>
              <h3 className="text-base font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
                {post?.title}
              </h3>
              <p>{postPreview}</p>
              {(post?.numImages || 0) > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {Array.from({ length: Math.min(3, post.numImages) }).map((_, idx) => (
                    <img
                      key={idx}
                      src={POST_IMAGE_PLACEHOLDER}
                      alt="post preview"
                      className="h-24 w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)" }}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("comments")}</h3>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="form-control w-auto text-sm"
                >
                  <option value="recency">{t("recencyDefault")}</option>
                  <option value="newest">{t("newestFirst")}</option>
                  <option value="oldest">{t("oldestFirst")}</option>
                  <option value="most_popular">{t("mostPopular")}</option>
                  <option value="relevance">{t("relevanceScore")}</option>
                </select>
              </div>

              {loading ? (
                <div className="rounded-lg p-4 text-sm" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>{t("loadingComments")}</div>
              ) : comments.length === 0 ? (
                <div className="rounded-lg p-4 text-sm" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                  {t("noCommentsYetDetailed")}
                </div>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onReply={setReplyingTo}
                    voteComment={voteComment}
                    onPreviewAttachment={setPreviewAttachment}
                    lang={lang}
                    navigate={nav}
                  />
                ))
              )}
            </div>
          </div>

          {canComment ? (
            <div className="comments-input-area">
              {replyingTo && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm mb-2">
                  <span className="truncate">
                    Replying to {replyingTo.userIdentifier || `User ${replyingTo.userId}`}
                  </span>
                  <button className="text-blue-700 hover:underline" onClick={() => setReplyingTo(null)}>
                    Cancel
                  </button>
                </div>
              )}

              {attachment && (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2">
                  <span className="truncate">
                    Attachment: {attachment.title || attachment.file?.name || "selected"}
                  </span>
                  <button className="text-rose-600 hover:underline" onClick={() => setAttachment(null)}>
                    Remove
                  </button>
                </div>
              )}

              <div className="comment-input-row">
                <button
                  className="btn btn-sm"
                  onClick={() => document.getElementById("comment-attachment-input")?.click()}
                >
                  Attach
                </button>
                <input
                  id="comment-attachment-input"
                  type="file"
                  accept="image/*,video/*,.gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setAttachment({ kind: "file", file, title: file.name });
                  }}
                />
                <button
                  className="btn btn-sm"
                  onClick={() => { setShowGifPicker((prev) => !prev); setShowEmojiPicker(false); }}
                >
                  GIF
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => { setShowEmojiPicker((prev) => !prev); setShowGifPicker(false); }}
                >
                  Emoji
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => submitComment({ content: draft, parentCommentId: replyingTo?.id || null })}
                >
                  {replyingTo ? "Post Reply" : "Post Comment"}
                </button>
              </div>

              {showEmojiPicker && (
                <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
                  <EmojiPicker
                    width="100%"
                    height={420}
                    searchDisabled={false}
                    skinTonesDisabled={false}
                    previewConfig={{ showPreview: true }}
                    onEmojiClick={(emojiData) => setDraft((prev) => prev + emojiData.emoji)}
                  />
                </div>
              )}

              {showGifPicker && (
                <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <input
                    value={gifSearch}
                    onChange={(e) => setGifSearch(e.target.value)}
                    placeholder="Search GIFs..."
                    className="form-control mb-3"
                  />
                  <div className="max-h-[500px] overflow-y-auto rounded-lg">
                    <Grid
                      width={800}
                      columns={3}
                      gutter={8}
                      noLink={true}
                      key={gifSearch}
                      fetchGifs={(offset) => gf.search(gifSearch || "trending", { offset, limit: 20, rating: "pg-13", lang: "en" })}
                      onGifClick={(gif, e) => {
                        e.preventDefault();
                        setAttachment({ kind: "gif", url: gif.images.original.url, title: gif.title });
                        setShowGifPicker(false);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="comments-input-area">
              <p className="text-sm text-center py-3" style={{ color: "var(--text-muted)" }}>
                <Link to="/auth/login" style={{ color: "var(--accent-primary)", fontWeight: 600, textDecoration: "underline" }}>
                  Log in
                </Link> to leave a comment.
              </p>
            </div>
          )}
        </div>
      </div>

      {previewAttachment && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/70 p-4">
          <div className="relative max-h-[90vh] w-full max-w-3xl rounded-xl bg-white p-3">
            <button
              className="absolute right-3 top-3 rounded-full border border-gray-300 px-2 py-1 text-sm bg-white"
              onClick={() => setPreviewAttachment(null)}
            >
              ✕
            </button>
            <div className="mt-8 flex justify-center">
              {previewAttachment.type === "video" ? (
                <video controls className="max-h-[75vh] w-full rounded-lg">
                  <source src={previewAttachment.url} />
                </video>
              ) : (
                <img src={previewAttachment.url} alt="attachment preview" className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}