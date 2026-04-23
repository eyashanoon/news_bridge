import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { getUserId } from "../utils/userId";

const AVATAR_PLACEHOLDER =
  "https://ui-avatars.com/api/?name=User&background=0f172a&color=ffffff";
const POST_IMAGE_PLACEHOLDER =
  "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";
const EMOJI_RANGES = [
  [0x1f300, 0x1f5ff],
  [0x1f600, 0x1f64f],
  [0x1f680, 0x1f6ff],
  [0x1f700, 0x1f77f],
  [0x1f780, 0x1f7ff],
  [0x1f800, 0x1f8ff],
  [0x1f900, 0x1f9ff],
  [0x1fa70, 0x1faff],
  [0x2600, 0x26ff],
  [0x2700, 0x27bf],
];
const EMOJI_NAME_MAP = {
  "😀": "grinning face smile happy",
  "😂": "tears joy laugh funny",
  "😍": "heart eyes love",
  "🔥": "fire lit hot",
  "👏": "clap applause",
  "🙏": "pray thanks",
  "👍": "thumbs up agree",
  "👎": "thumbs down disagree",
  "❤️": "heart love",
  "😭": "cry sad tears",
  "🎉": "party celebration",
  "💯": "hundred perfect",
  "🤔": "thinking",
  "😎": "cool sunglasses",
  "😊": "smile happy blush",
  "😁": "grin happy smile",
  "🥰": "love hearts",
  "😢": "sad cry",
  "😡": "angry mad",
  "🤯": "mind blown shocked",
  "✅": "check done yes",
  "❌": "cross no",
  "✨": "sparkles shine",
  "🎯": "target goal",
  "🚀": "rocket launch",
  "😴": "sleep tired",
  "🤗": "hug support",
  "🙌": "raised hands celebrate",
};
const GIF_CATALOG = [
  {
    id: "g1",
    title: "happy dance",
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
  },
  {
    id: "g2",
    title: "mind blown",
    url: "https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif",
  },
  {
    id: "g3",
    title: "thumbs up",
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
  },
  {
    id: "g4",
    title: "wow",
    url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",
  },
  {
    id: "g5",
    title: "facepalm",
    url: "https://media.giphy.com/media/TJawtKM6OCKkvwCIqX/giphy.gif",
  },
];

function shorten(text, max = 45) {
  if (!text) return "Untitled";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function timeAgo(value) {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return "just now";
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function buildEmojiCatalog() {
  const regex = /\p{Extended_Pictographic}/u;
  const unique = new Map();

  for (const [start, end] of EMOJI_RANGES) {
    for (let cp = start; cp <= end; cp += 1) {
      const emoji = String.fromCodePoint(cp);
      if (!regex.test(emoji)) continue;
      if (unique.has(emoji)) continue;
      const hex = cp.toString(16).toUpperCase();
      const keyword = EMOJI_NAME_MAP[emoji] || `emoji u+${hex}`;
      unique.set(emoji, { emoji, keyword });
    }
  }

  return Array.from(unique.values());
}

function normalizeText(value) {
  return (value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchesEmoji(emojiEntry, query) {
  if (!query) return true;
  const q = normalizeText(query);
  const keyword = normalizeText(emojiEntry.keyword);
  if (emojiEntry.emoji.includes(q)) return true;
  if (keyword.includes(q)) return true;
  return q
    .split(" ")
    .filter(Boolean)
    .every((token) => keyword.includes(token));
}

function insertReplyIntoTree(nodes, parentCommentId, createdReply) {
  return nodes.map((node) => {
    if (node.id === parentCommentId) {
      return {
        ...node,
        replies: [...(node.replies || []), { ...createdReply, replies: createdReply.replies || [] }],
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
    onPreviewAttachment?.({
      url: comment.attachmentUrl,
      type: comment.attachmentType || "image",
    });

  if (comment.attachmentType === "video") {
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
      <img
        src={comment.attachmentUrl}
        alt="comment attachment"
        className="max-h-56 w-full rounded-lg border border-slate-200 object-cover"
      />
    </button>
  );
}

function CommentItem({
  comment,
  depth = 0,
  onReply,
  voteComment,
  onPreviewAttachment,
}) {
  const [showReplies, setShowReplies] = useState(true);

  const hasReplies = (comment.replies || []).length > 0;

  return (
    <div className={`${depth > 0 ? "ml-6 border-l border-slate-200 pl-4" : ""} mb-4`}>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-start gap-3">
          <img
            src={AVATAR_PLACEHOLDER}
            alt="user avatar"
            className="h-9 w-9 rounded-full border border-slate-200 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-slate-800">
                {comment.userIdentifier || `User ${comment.userId}`}
              </span>
              <span className="text-xs text-slate-500">{timeAgo(comment.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.content}</p>
            {renderAttachment(comment, onPreviewAttachment)}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <button
                className={`rounded-md px-2 py-1 ${
                  comment.userVote === 1
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                onClick={() => voteComment(comment.id, comment.userVote === 1 ? 0 : 1)}
              >
                ▲
              </button>
              <span
                className={`font-semibold ${
                  comment.voteScore < 0 ? "text-rose-600" : "text-slate-700"
                }`}
              >
                {comment.voteScore}
              </span>
              <button
                className={`rounded-md px-2 py-1 ${
                  comment.userVote === -1
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                onClick={() => voteComment(comment.id, comment.userVote === -1 ? 0 : -1)}
              >
                ▼
              </button>
              <button
                className="text-blue-600 hover:underline"
                onClick={() => onReply(comment)}
              >
                Reply
              </button>
              {hasReplies && (
                <button
                  className="text-slate-600 hover:underline"
                  onClick={() => setShowReplies((prev) => !prev)}
                >
                  {showReplies ? "Hide replies" : `Show replies (${comment.replies.length})`}
                </button>
              )}
            </div>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostCommentsModal({ post, onClose }) {
  const [sortBy, setSortBy] = useState("recency");
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const deferredEmojiSearch = useDeferredValue(emojiSearch);
  const [emojiRenderCount, setEmojiRenderCount] = useState(280);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const filteredGifs = useMemo(() => {
    const q = gifSearch.trim().toLowerCase();
    if (!q) return GIF_CATALOG;
    return GIF_CATALOG.filter((g) => g.title.includes(q));
  }, [gifSearch]);

  const emojiCatalog = useMemo(() => buildEmojiCatalog(), []);
  const filteredEmojis = useMemo(() => {
    const q = deferredEmojiSearch.trim();
    return emojiCatalog.filter((entry) => matchesEmoji(entry, q));
  }, [emojiCatalog, deferredEmojiSearch]);
  const displayedEmojis = useMemo(
    () => filteredEmojis.slice(0, emojiRenderCount),
    [filteredEmojis, emojiRenderCount]
  );

  useEffect(() => {
    setEmojiRenderCount(280);
  }, [deferredEmojiSearch, showEmojiPicker]);

  const fetchRepliesRecursively = async (comment, userId) => {
    const res = await apiFetch(`/api/comments/${comment.id}/replies?userId=${userId}`);
    if (!res.ok) return { ...comment, replies: [] };
    const replies = await res.json();
    const hydratedReplies = await Promise.all(
      (replies || []).map((reply) => fetchRepliesRecursively(reply, userId))
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
      await ensureUserInitialized();
      const userId = getUserId();
      const serverSort = sortBy === "most_popular" ? "popularity" : "recency";
      const res = await apiFetch(
        `/api/comments/post/${post.id}?sortBy=${serverSort}&page=0&size=50&userId=${userId}`
      );
      if (!res.ok) throw new Error("Failed to load comments");
      const payload = await res.json();
      const roots = payload.content || [];
      const threaded = await Promise.all(
        roots.map((comment) => fetchRepliesRecursively(comment, userId))
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

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const submitComment = async ({ content, parentCommentId = null }) => {
    const trimmed = (content || "").trim();
    if (!trimmed && !attachment) return;

    try {
      await ensureUserInitialized();
      const userId = getUserId();

      let attachmentUrl = null;
      let attachmentType = null;
      if (attachment?.kind === "gif") {
        attachmentUrl = attachment.url;
        attachmentType = "gif";
      } else if (attachment?.kind === "file") {
        attachmentUrl = await readFileAsDataUrl(attachment.file);
        attachmentType = attachment.file.type.startsWith("video/") ? "video" : "image";
      }

      const res = await apiFetch(`/api/comments?userId=${userId}`, {
        method: "POST",
        body: JSON.stringify({
          postId: post.id,
          content: trimmed || "(attachment)",
          parentCommentId,
          attachmentUrl,
          attachmentType,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit comment");
      const created = await res.json();

      setDraft("");
      setAttachment(null);
      setReplyingTo(null);
      setComments((prev) => {
        if (parentCommentId) {
          return insertReplyIntoTree(prev, parentCommentId, created);
        }
        return sortClientSide([{ ...created, replies: created.replies || [] }, ...prev]);
      });

      // Keep server state synced for ordering/vote totals after immediate UI update.
      await loadComments();
    } catch (error) {
      console.error(error);
    }
  };

  const voteComment = async (commentId, voteType) => {
    try {
      await ensureUserInitialized();
      const userId = getUserId();
      const res = await apiFetch(`/api/comments/${commentId}/vote?userId=${userId}`, {
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[71] h-[92vh] w-[96%] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3">
            <h2 className="text-lg font-bold text-slate-800">
              Post {shorten(post?.title || "Untitled", 36)}
              {"'"}s comments
            </h2>
            <button
              onClick={onClose}
              className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Post Preview
              </h3>
              <h4 className="text-base font-semibold text-slate-800">{post?.title}</h4>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{postPreview}</p>
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

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-800">Comments</h3>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="recency">Recency (default)</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="most_popular">Most popular</option>
                  <option value="relevance">Relevance</option>
                </select>
              </div>

              {loading ? (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  No comments yet. Be the first to comment.
                </div>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onReply={setReplyingTo}
                    voteComment={voteComment}
                    onPreviewAttachment={setPreviewAttachment}
                  />
                ))
              )}
            </div>
          </div>

          <div className="border-t bg-white p-3">
            {replyingTo && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                <span className="truncate">
                  Replying to {replyingTo.userIdentifier || `User ${replyingTo.userId}`}
                </span>
                <button
                  className="text-blue-700 hover:underline"
                  onClick={() => setReplyingTo(null)}
                >
                  Cancel
                </button>
              </div>
            )}
            {attachment && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate">
                  Attachment: {attachment.title || attachment.file?.name || "selected"}
                </span>
                <button className="text-rose-600 hover:underline" onClick={() => setAttachment(null)}>
                  Remove
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                onClick={() => {
                  setShowGifPicker((prev) => !prev);
                  setShowEmojiPicker(false);
                }}
              >
                GIF
              </button>
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                onClick={() => {
                  setShowEmojiPicker((prev) => !prev);
                  setShowGifPicker(false);
                }}
              >
                Emoji
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                onClick={() =>
                  submitComment({ content: draft, parentCommentId: replyingTo?.id || null })
                }
              >
                {replyingTo ? "Post Reply" : "Post Comment"}
              </button>
            </div>
            {showEmojiPicker && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <input
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search emoji (example: heart, smile, 👍)"
                  className="mb-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid max-h-44 grid-cols-10 gap-2 overflow-y-auto">
                  {displayedEmojis.map(({ emoji, keyword }) => (
                    <button
                      key={emoji}
                      title={keyword}
                      className="rounded-md bg-white px-2 py-1 text-xl hover:bg-slate-100"
                      onClick={() => setDraft((prev) => `${prev}${emoji}`)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {filteredEmojis.length > displayedEmojis.length && (
                  <button
                    className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => setEmojiRenderCount((prev) => prev + 240)}
                  >
                    Show more emojis
                  </button>
                )}
              </div>
            )}
            {showGifPicker && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <input
                  value={gifSearch}
                  onChange={(e) => setGifSearch(e.target.value)}
                  placeholder="Search GIFs (from gifpy/giphy style picker)"
                  className="mb-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid max-h-44 grid-cols-5 gap-2 overflow-y-auto">
                  {filteredGifs.map((gif) => (
                    <button
                      key={gif.id}
                      className="overflow-hidden rounded-lg border border-slate-300"
                      onClick={() => {
                        setAttachment({ kind: "gif", url: gif.url, title: gif.title });
                        setShowGifPicker(false);
                      }}
                    >
                      <img src={gif.url} alt={gif.title} className="h-20 w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {previewAttachment && (
        <div className="absolute inset-0 z-[72] flex items-center justify-center bg-black/70 p-4">
          <div className="relative max-h-[90vh] w-full max-w-3xl rounded-xl bg-white p-3">
            <button
              className="absolute right-3 top-3 rounded-full border border-slate-300 px-2 py-1 text-sm"
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
                <img
                  src={previewAttachment.url}
                  alt="attachment preview"
                  className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
