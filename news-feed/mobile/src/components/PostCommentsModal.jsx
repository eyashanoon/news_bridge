import { useState, useEffect, useRef } from "react";
import {
  View, Text, Modal, ScrollView, Image, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { ensureUserInitialized, getToken } from "../utils/auth";
import { API_CONFIG } from "../api/config";
import { useTranslation } from "react-i18next";
import {
  detectItemLanguage,
  needsTranslation as itemNeedsTranslation,
  getTranslationTargetLang,
  getTranslateButtonLabel,
} from "../utils/languageUtils";
import { translateText } from "../utils/translateUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Same GIPHY API key as the web news-feed
const GIPHY_API_KEY = "lLef25w3W2ATXHCNsZflpvzbwQ44DFeE";
const EMOJI_DATA_URL = "https://cdn.jsdelivr.net/npm/@emoji-mart/data@1.2.1/sets/14/native.json";

const COMMON_EMOJIS = [
  "😀", "😂", "😍", "🥰", "😊", "😭", "😡", "👍", "👎", "❤️", "🔥", "🎉",
  "👏", "🙏", "💯", "✅", "❌", "⭐", "🤔", "😮", "😢", "🥳", "💪", "👀",
  "🙌", "💡", "📰", "🌍", "⚽", "🏀", "🎵", "☀️", "🌧️", "🍕", "☕", "🚀",
];

const PLACEHOLDER_AVATAR = "https://ui-avatars.com/api/?name=User&background=0f172a&color=ffffff";
const POST_PLACEHOLDER_IMG = "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";

// Emoji data fetched from the same CDN that emoji-picker-react uses
let _emojiDataCache = null;
function buildEmojiCategories(data) {
  const emojiMap = data?.emojis || {};
  return (data?.categories || [])
    .map((cat) => ({
      id: cat.id,
      label: cat.name || cat.id,
      emojis: (cat.emojis || [])
        .map((emojiId) => {
          const entry = emojiMap[emojiId];
          if (!entry) return null;
          const native = getNativeEmoji(entry.skins);
          if (!native) return null;
          return {
            id: entry.id || emojiId,
            name: entry.name,
            native,
            keywords: entry.keywords || [],
          };
        })
        .filter(Boolean),
    }))
    .filter((cat) => cat.emojis.length > 0);
}

async function loadEmojiData() {
  if (_emojiDataCache) return _emojiDataCache;
  try {
    const res = await fetch(EMOJI_DATA_URL);
    if (!res.ok) throw new Error("Failed to load emoji data");
    const data = await res.json();
    _emojiDataCache = data;
    return data;
  } catch (e) {
    console.warn("Emoji data load failed, using fallback:", e.message);
    _emojiDataCache = {
      categories: [{ id: "common", name: "Common", emojis: COMMON_EMOJIS.map((_, idx) => `common_${idx}`) }],
      emojis: Object.fromEntries(
        COMMON_EMOJIS.map((native, idx) => [
          `common_${idx}`,
          { id: `common_${idx}`, name: native, skins: [{ native }], keywords: [] },
        ])
      ),
    };
    return _emojiDataCache;
  }
}

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
    return url;
  }
  return `${API_CONFIG.baseURL}${url.startsWith("/") ? url : `/${url}`}`;
}

// Extract native emoji from a skin entry
function getNativeEmoji(skins) {
  if (!skins || skins.length === 0) return null;
  return skins[0]?.native || null;
}

function getGifPreviewUrl(gif) {
  return (
    gif?.images?.fixed_height?.url
    || gif?.images?.downsized?.url
    || gif?.images?.original?.url
    || null
  );
}

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

function getAvatarUrl(comment) {
  if (comment.profilePicture && comment.profilePicture.trim()) return comment.profilePicture;
  return PLACEHOLDER_AVATAR;
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

// ─── Comment Item ───────────────────────────────────────────
function CommentItem({ comment, depth = 0, onReply, voteComment, onPreviewAttachment, darkMode, uiLang, t }) {
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = (comment.replies || []).length > 0;
  const commentLang = detectItemLanguage(comment);
  const needsCommentTranslation = itemNeedsTranslation(comment, uiLang);
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
      const result = await translateText(comment.content, commentLang, getTranslationTargetLang(uiLang));
      setTranslatedComment(result);
      setShowTranslatedComment(true);
    } finally {
      setIsTranslatingComment(false);
    }
  };

  return (
    <View style={[styles.commentItem, depth > 0 && styles.replyItem]}>
      <View style={styles.commentRow}>
        <Image source={{ uri: getAvatarUrl(comment) }} style={styles.commentAvatar} />
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentAuthor, { color: th(darkMode, dc.text, "#0b1a2b") }]} numberOfLines={1}>
              {comment.userIdentifier || `User ${comment.userId}`}
            </Text>
            <Text style={[styles.commentTime, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{timeAgo(comment.createdAt)}</Text>
          </View>

          <Text style={[styles.commentContent, { color: th(darkMode, dc.textSecondary, "#334155") }]}>
            {showTranslatedComment && translatedComment ? translatedComment : comment.content}
          </Text>

          {needsCommentTranslation && comment.content ? (
            <TouchableOpacity onPress={handleTranslateComment} disabled={isTranslatingComment}>
              <Text style={[styles.translateCommentBtn, { color: th(darkMode, dc.muted, "#64748b") }]}>
                {isTranslatingComment ? t("translating") : showTranslatedComment ? t("viewOriginal") : getTranslateButtonLabel(uiLang, t)}
              </Text>
            </TouchableOpacity>
          ) : null}

          {comment.attachmentUrl ? (
            <TouchableOpacity
              style={styles.attachmentBtn}
              onPress={() => onPreviewAttachment?.({ url: comment.attachmentUrl, type: comment.attachmentType || "image" })}
            >
              {comment.attachmentType === "video" || comment.attachmentUrl?.includes(".mp4") ? (
                <View style={styles.videoPlaceholder}>
                  <Text style={styles.videoPlaceholderText}>🎥 Video Attachment</Text>
                </View>
              ) : (
                <Image source={{ uri: resolveMediaUrl(comment.attachmentUrl) }} style={styles.commentAttachment} resizeMode="cover" />
              )}
            </TouchableOpacity>
          ) : null}

          <View style={styles.commentActions}>
            <TouchableOpacity
              style={[styles.voteBtn, comment.userVote === 1 && styles.voteBtnActive]}
              onPress={() => voteComment(comment.id, comment.userVote === 1 ? 0 : 1)}
            >
              <Text style={[styles.voteBtnText, comment.userVote === 1 && styles.voteBtnTextActive]}>▲</Text>
            </TouchableOpacity>
              <Text style={[styles.voteScore, { color: th(darkMode, dc.textSecondary, "#3d5468") }, comment.voteScore < 0 && styles.voteScoreNeg]}>
              {comment.voteScore}
            </Text>
            <TouchableOpacity
              style={[styles.voteBtn, comment.userVote === -1 && styles.voteBtnDown]}
              onPress={() => voteComment(comment.id, comment.userVote === -1 ? 0 : -1)}
            >
              <Text style={[styles.voteBtnText, comment.userVote === -1 && styles.voteBtnTextDown]}>▼</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.replyBtn} onPress={() => onReply(comment)}>
                   <Text style={styles.replyBtnText}>{t("reply")}</Text>
            </TouchableOpacity>

            {hasReplies ? (
              <TouchableOpacity style={styles.toggleRepliesBtn} onPress={() => setShowReplies(!showReplies)}>
                <Text style={styles.toggleRepliesText}>
                  {showReplies ? "Hide" : `Show ${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {hasReplies && showReplies ? (
        <View style={styles.repliesContainer}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              voteComment={voteComment}
              onPreviewAttachment={onPreviewAttachment}
              darkMode={darkMode}
              uiLang={uiLang}
              t={t}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Emoji Picker (API-based, same as news-feed) ───────────
function EmojiPickerPanel({ onSelect, onClose }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadEmojiData().then((data) => {
      if (cancelled) return;
      setCategories(buildEmojiCategories(data));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSearchResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const q = text.toLowerCase();
      const results = [];
      for (const cat of categories) {
        for (const emoji of cat.emojis) {
          if (
            emoji.name?.toLowerCase().includes(q) ||
            emoji.id?.toLowerCase().includes(q) ||
            (emoji.keywords || []).some((kw) => kw.toLowerCase().includes(q))
          ) {
            results.push(emoji);
            if (results.length >= 50) break;
          }
        }
        if (results.length >= 50) break;
      }
      setSearchResults(results);
    }, 300);
  };

  const displayEmojis = searchResults || (categories[selectedCategory]?.emojis || []);

  return (
    <View style={styles.emojiPicker}>
      <View style={styles.emojiHeader}>
        <TextInput
          style={styles.emojiSearchInput}
          value={search}
          onChangeText={handleSearch}
          placeholder="Search emoji..."
          placeholderTextColor="#94a3b8"
        />
        <TouchableOpacity onPress={onClose} style={styles.emojiCloseBtn}>
          <Text style={styles.emojiCloseText}>✕</Text>
        </TouchableOpacity>
      </View>
      {!searchResults && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiTabs}>
          {categories.map((cat, idx) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.emojiTab, idx === selectedCategory && styles.emojiTabActive]}
              onPress={() => setSelectedCategory(idx)}
            >
              <Text style={[styles.emojiTabText, idx === selectedCategory && styles.emojiTabTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {loading ? (
        <ActivityIndicator style={{ padding: 20 }} size="small" color="#64748b" />
      ) : (
        <ScrollView style={styles.emojiGridScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <View style={styles.emojiGridInner}>
            {displayEmojis.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.emojiItem}
                onPress={() => onSelect(item.native)}
              >
                <Text style={styles.emojiChar}>{item.native}</Text>
              </TouchableOpacity>
            ))}
            {displayEmojis.length === 0 ? (
              <Text style={{ textAlign: "center", color: "#94a3b8", padding: 16, fontSize: 13, width: "100%" }}>
                No emojis found
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── GIF Picker (API-based, same as news-feed) ─────────────
function GifPickerPanel({ onSelect, onClose }) {
  const [search, setSearch] = useState("trending");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const fetchGifs = async (query) => {
    setLoading(true);
    try {
      // Use same endpoint and params as the web's @giphy/js-fetch-api
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query || "trending")}&limit=20&rating=pg-13&lang=en`;
      const res = await fetch(url);
      const data = await res.json();
      setGifs(data.data || []);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGifs("trending");
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(text), 500);
  };

  return (
    <View style={styles.gifPicker}>
      <View style={styles.gifHeader}>
        <TextInput
          style={styles.gifSearchInput}
          value={search}
          onChangeText={handleSearch}
          placeholder="Search GIFs..."
          placeholderTextColor="#94a3b8"
        />
        <TouchableOpacity onPress={onClose} style={styles.emojiCloseBtn}>
          <Text style={styles.emojiCloseText}>✕</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={{ padding: 20 }} size="small" color="#64748b" />
      ) : (
        <ScrollView style={styles.gifGridScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <View style={styles.gifGrid}>
            {gifs.map((item) => {
              const previewUrl = getGifPreviewUrl(item);
              if (!previewUrl) return null;
              return (
                <TouchableOpacity key={item.id} style={styles.gifItem} onPress={() => onSelect(item)}>
                  <Image source={{ uri: previewUrl }} style={styles.gifImage} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Main Comments Modal ────────────────────────────────────
export default function PostCommentsModal({ post, visible, onClose }) {
  const { session } = useSession();
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const uiLang = i18n.language;
  const canComment = session?.type === "REGISTERED" || session?.type === "EDITOR";

  const [sortBy, setSortBy] = useState("recency");
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const authFetch = async (url, options = {}) => {
    const activeSession = session?.token ? session : await ensureUserInitialized();
    const token = activeSession?.token || (await getToken());
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
    const res = await authFetch(`${API_CONFIG.baseURL}/api/comments/${comment.id}/replies`);
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
        `${API_CONFIG.baseURL}/api/comments/post/${post.id}?sortBy=${serverSort}&page=0&size=50`
      );
      if (!res.ok) throw new Error("Failed to load comments");
      const payload = await res.json();
      const roots = payload.content || [];
      const threaded = await Promise.all(
        roots.map((comment) => fetchRepliesRecursively(comment))
      );
      setComments(sortClientSide(threaded));
    } catch (error) {
      console.error("Load comments error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) loadComments();
  }, [sortBy, post?.id, visible]);

  const uploadAttachmentFile = async (asset) => {
    const mimeType = asset.type || "image/jpeg";
    const endpoint = mimeType.startsWith("video/")
      ? `${API_CONFIG.baseURL}/api/upload/video`
      : `${API_CONFIG.baseURL}/api/upload/image`;
    const token = session?.token || (await getToken());

    // Expo's fetch cannot serialize RN file FormData parts ({ uri, name, type }).
    // XMLHttpRequest uses the native networking stack which still supports them.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.onload = () => {
        try {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(`Failed to upload attachment (${xhr.status})`));
            return;
          }
          const data = JSON.parse(xhr.responseText);
          if (!data.url) {
            reject(new Error("Upload response missing URL"));
            return;
          }
          resolve(data.url);
        } catch (err) {
          reject(err);
        }
      };

      xhr.onerror = () => reject(new Error("Failed to upload attachment"));
      xhr.onabort = () => reject(new Error("Upload cancelled"));

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.name || (mimeType.startsWith("video/") ? "upload.mp4" : "upload.jpg"),
        type: mimeType,
      });
      xhr.send(formData);
    });
  };

  const submitComment = async ({ content, parentCommentId = null }) => {
    const trimmed = (content || "").trim();
    if (!trimmed && !attachment) return;
    if (!canComment || !session?.token) return;

    setSubmitting(true);
    try {
      let attachmentUrl = null;
      let attachmentType = null;
      if (attachment?.kind === "gif") {
        attachmentUrl = attachment.url;
        attachmentType = "gif";
      } else if (attachment?.kind === "file") {
        attachmentUrl = await uploadAttachmentFile(attachment);
        attachmentType = (attachment.type || "").startsWith("video/") ? "video" : "image";
      }
      const res = await authFetch(`${API_CONFIG.baseURL}/api/comments`, {
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
      console.error("Submit comment error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const voteComment = async (commentId, voteType) => {
    try {
      const res = await authFetch(`${API_CONFIG.baseURL}/api/comments/${commentId}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteType }),
      });
      if (!res.ok) throw new Error("Failed to vote");
      await loadComments();
    } catch (error) {
      console.error("Vote error:", error);
    }
  };

  const pickAttachment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setAttachment({
        kind: "file",
        uri: asset.uri,
        name: asset.fileName || "attachment",
        type: asset.mimeType || "image/jpeg",
      });
    }
  };

  const SORT_OPTIONS = [
    { value: "recency", label: t("sortRecency") },
    { value: "newest", label: t("sortNewest") },
    { value: "oldest", label: t("sortOldest") },
    { value: "most_popular", label: t("sortPopular") },
    { value: "relevance", label: t("sortRelevance") },
  ];

  const postPreview = shorten(post?.text || "", 220);

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.container, { backgroundColor: th(darkMode, dc.surface, "#fff") }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
              <Text style={[styles.headerTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]} numberOfLines={1}>
                {t("comments")} — {shorten(post?.title || t("untitledPost"), 30)}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={[styles.closeText, { color: th(darkMode, dc.muted, "#6e869a") }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {/* Post Preview */}
              <View style={[styles.postPreview, { borderBottomColor: th(darkMode, dc.border, "#e2e8f0"), backgroundColor: th(darkMode, dc.subtle, "#f8faff") }]}>
                <Text style={[styles.postPreviewLabel, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("postPreview")}</Text>
                <Text style={[styles.postPreviewTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]} numberOfLines={2}>{post?.title}</Text>
                <Text style={[styles.postPreviewText, { color: th(darkMode, dc.textSecondary, "#3d5468") }]} numberOfLines={3}>{postPreview}</Text>
                {(post?.numImages || 0) > 0 ? (
                  <View style={styles.previewImages}>
                    {Array.from({ length: Math.min(3, post.numImages) }).map((_, idx) => (
                      <Image key={idx} source={{ uri: POST_PLACEHOLDER_IMG }} style={styles.previewImage} />
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Comments Section */}
              <View style={styles.commentsSection}>
                <View style={styles.commentsHeader}>
                  <Text style={[styles.commentsTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("comments")}</Text>
                  <TouchableOpacity
                    style={styles.sortBtn}
                    onPress={() => setShowSortPicker(!showSortPicker)}
                  >
                    <Text style={[styles.sortBtnText, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>
                      {SORT_OPTIONS.find(o => o.value === sortBy)?.label || "Recent"} ▾
                    </Text>
                  </TouchableOpacity>
                </View>

                {showSortPicker ? (
                  <View style={styles.sortPicker}>
                    {SORT_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.sortOption, sortBy === opt.value && styles.sortOptionActive]}
                        onPress={() => { setSortBy(opt.value); setShowSortPicker(false); }}
                      >
                        <Text style={[styles.sortOptionText, sortBy === opt.value && styles.sortOptionTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {loading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#64748b" />
                    <Text style={styles.loadingText}>{t("loadingComments")}</Text>
                  </View>
                ) : comments.length === 0 ? (
                  <View style={styles.loadingBox}>
                    <Text style={styles.loadingText}>{t("noCommentsYet")}</Text>
                  </View>
                ) : (
                  comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      onReply={setReplyingTo}
                      voteComment={voteComment}
                      onPreviewAttachment={setPreviewAttachment}
                      darkMode={darkMode}
                      uiLang={uiLang}
                      t={t}
                    />
                  ))
                )}
              </View>
            </ScrollView>

            {/* Input Area */}
            {canComment ? (
              <View style={[styles.inputArea, { borderTopColor: th(darkMode, dc.border, "#e2e8f0"), backgroundColor: th(darkMode, dc.surface, "#fff") }]}>
                {replyingTo ? (
                  <View style={styles.replyBanner}>
                    <Text style={styles.replyBannerText} numberOfLines={1}>
                      {t("replyingTo", { user: replyingTo.userIdentifier || `User ${replyingTo.userId}` })}
                    </Text>
                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                      <Text style={styles.replyBannerCancel}>{t("cancel")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {attachment ? (
                  <View style={styles.attachmentBanner}>
                    <Text style={styles.attachmentBannerText} numberOfLines={1}>
                      📎 {attachment.name || "Attachment"}
                    </Text>
                    <TouchableOpacity onPress={() => setAttachment(null)}>
                      <Text style={styles.replyBannerCancel}>{t("remove")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {showEmojiPicker ? (
                  <EmojiPickerPanel
                    onSelect={(emoji) => setDraft((prev) => prev + emoji)}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                ) : null}

                {showGifPicker ? (
                  <GifPickerPanel
                    onSelect={(gif) => {
                      const url = getGifPreviewUrl(gif);
                      if (!url) return;
                      setAttachment({ kind: "gif", url, name: gif.title || "GIF" });
                      setShowGifPicker(false);
                    }}
                    onClose={() => setShowGifPicker(false)}
                  />
                ) : null}

                <View style={styles.inputRow}>
                  <TouchableOpacity style={styles.inputActionBtn} onPress={pickAttachment}>
                    <Text style={styles.inputActionText}>📎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inputActionBtn}
                    onPress={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                  >
                    <Text style={styles.inputActionText}>GIF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inputActionBtn}
                    onPress={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                  >
                    <Text style={styles.inputActionText}>😊</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.textInput, { borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b"), backgroundColor: th(darkMode, dc.subtle, "#f8faff") }]}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={replyingTo ? t("writeReply") : t("writeCommentPlaceholder")}
                    placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.postBtn, submitting && styles.postBtnDisabled]}
                    onPress={() => submitComment({ content: draft, parentCommentId: replyingTo?.id || null })}
                    disabled={submitting}
                  >
                    <Text style={styles.postBtnText}>{submitting ? "..." : t("postComment")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.inputArea, { borderTopColor: th(darkMode, dc.border, "#e2e8f0"), backgroundColor: th(darkMode, dc.surface, "#fff") }]}>
                <Text style={[styles.loginPrompt, { color: th(darkMode, dc.muted, "#6e869a") }]}>
                  {t("signIn")} {t("comments")}
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Attachment Preview Modal */}
      {previewAttachment ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewAttachment(null)}>
          <TouchableOpacity
            style={styles.lightbox}
            activeOpacity={1}
            onPress={() => setPreviewAttachment(null)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.lightboxContent}>
              <TouchableOpacity
                onPress={() => setPreviewAttachment(null)}
                style={styles.lightboxClose}
              >
                <Text style={styles.lightboxCloseText}>✕</Text>
              </TouchableOpacity>
              {previewAttachment.type === "video" ? (
                <Text style={{ padding: 20, textAlign: "center" }}>Video attachment preview</Text>
              ) : (
                <Image
                  source={{ uri: resolveMediaUrl(previewAttachment.url) }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,26,43,0.55)" },
  container: { flex: 1, margin: 8, marginTop: 40, marginBottom: 20, backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", elevation: 10, boxShadow: "0 20px 48px rgba(0,0,0,0.15)" },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#0b1a2b", marginRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center" },
  closeText: { fontSize: 16, color: "#6e869a" },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingBottom: 8 },

  // Post Preview
  postPreview: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#f8faff" },
  postPreviewLabel: { fontSize: 12, fontWeight: "600", color: "#6e869a", textTransform: "uppercase", letterSpacing: 0.04, marginBottom: 6 },
  postPreviewTitle: { fontSize: 16, fontWeight: "700", color: "#0b1a2b", marginBottom: 4 },
  postPreviewText: { fontSize: 13, color: "#3d5468", lineHeight: 18 },
  previewImages: { flexDirection: "row", gap: 8, marginTop: 10 },
  previewImage: { flex: 1, height: 80, borderRadius: 8 },

  // Comments Section
  commentsSection: { padding: 16 },
  commentsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  commentsTitle: { fontSize: 16, fontWeight: "700", color: "#0b1a2b" },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  sortBtnText: { fontSize: 13, fontWeight: "600", color: "#3d5468" },

  // Sort Picker
  sortPicker: { marginBottom: 16, backgroundColor: "#f8faff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  sortOption: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  sortOptionActive: { backgroundColor: "#eff6ff" },
  sortOptionText: { fontSize: 14, color: "#3d5468" },
  sortOptionTextActive: { color: "#2563eb", fontWeight: "600" },

  // Loading
  loadingBox: { padding: 20, alignItems: "center" },
  loadingText: { fontSize: 14, color: "#94a3b8", marginTop: 8 },

  // Comment Item
  commentItem: { marginBottom: 16 },
  replyItem: { marginLeft: 24, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: "#e2e8f0" },  // dark via inline
  commentRow: { flexDirection: "row" },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, marginTop: 2 },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  commentAuthor: { fontSize: 14, fontWeight: "600", color: "#0b1a2b" },
  commentTime: { fontSize: 12, color: "#94a3b8" },
  commentContent: { fontSize: 14, color: "#334155", lineHeight: 20, marginBottom: 6 },
  translateCommentBtn: { fontSize: 12, fontWeight: "600", marginBottom: 6 },

  // Attachment
  attachmentBtn: { marginTop: 4, marginBottom: 6 },
  commentAttachment: { width: "100%", height: 160, borderRadius: 10, backgroundColor: "#f5f8fd" },
  videoPlaceholder: { padding: 16, backgroundColor: "#f1f5f9", borderRadius: 10, alignItems: "center" },
  videoPlaceholderText: { fontSize: 14, color: "#64748b" },

  // Comment Actions
  commentActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  voteBtn: { width: 30, height: 28, borderRadius: 6, justifyContent: "center", alignItems: "center" },
  voteBtnActive: { backgroundColor: "#eff6ff" },
  voteBtnDown: { backgroundColor: "#fef2f2" },
  voteBtnText: { fontSize: 14, color: "#94a3b8" },
  voteBtnTextActive: { color: "#2563eb" },
  voteBtnTextDown: { color: "#ef4444" },
  voteScore: { fontSize: 13, fontWeight: "600", color: "#3d5468", minWidth: 24, textAlign: "center" },
  voteScoreNeg: { color: "#ef4444" },
  replyBtn: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 4 },
  replyBtnText: { fontSize: 13, fontWeight: "600", color: "#2563eb" },
  toggleRepliesBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  toggleRepliesText: { fontSize: 12, fontWeight: "600", color: "#6e869a" },
  repliesContainer: { marginTop: 8 },

  // Input Area
  inputArea: { borderTopWidth: 1, borderTopColor: "#e2e8f0", padding: 12, backgroundColor: "#fff" },
  replyBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  replyBannerText: { fontSize: 13, color: "#1e40af", flex: 1 },
  replyBannerCancel: { fontSize: 13, fontWeight: "600", color: "#2563eb", marginLeft: 8 },
  attachmentBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  attachmentBannerText: { fontSize: 13, color: "#3d5468", flex: 1 },

  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  inputActionBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  inputActionText: { fontSize: 14, fontWeight: "600", color: "#3d5468" },
  textInput: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: "#0b1a2b", maxHeight: 80, backgroundColor: "#f8faff" },
  postBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#2563eb" },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  loginPrompt: { fontSize: 14, color: "#6e869a", textAlign: "center", paddingVertical: 12 },

  // Emoji Picker
  emojiPicker: { backgroundColor: "#f8faff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 8, maxHeight: 280 },
  emojiHeader: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  emojiTabs: { flex: 1, paddingHorizontal: 8 },
  emojiTab: { paddingHorizontal: 12, paddingVertical: 8 },
  emojiTabActive: { borderBottomWidth: 2, borderBottomColor: "#2563eb" },
  emojiTabText: { fontSize: 12, fontWeight: "600", color: "#6e869a" },
  emojiTabTextActive: { color: "#2563eb" },
  emojiSearchInput: { flex: 1, borderWidth: 0, borderBottomWidth: 0, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: "#0b1a2b", backgroundColor: "#fff" },
  emojiCloseBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  emojiCloseText: { fontSize: 16, color: "#6e869a" },
  emojiGrid: { maxHeight: 220 },
  emojiGridScroll: { maxHeight: 220 },
  emojiGridInner: { flexDirection: "row", flexWrap: "wrap", padding: 4 },
  emojiItem: { width: "12.5%", aspectRatio: 1, justifyContent: "center", alignItems: "center" },
  emojiChar: { fontSize: 22 },

  // GIF Picker
  gifPicker: { backgroundColor: "#f8faff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 8, maxHeight: 280 },
  gifHeader: { flexDirection: "row", alignItems: "center", padding: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  gifSearchInput: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, color: "#0b1a2b", backgroundColor: "#fff" },
  gifGridScroll: { maxHeight: 280 },
  gifGrid: { flexDirection: "row", flexWrap: "wrap", padding: 4 },
  gifItem: { width: "33.33%", padding: 2, borderRadius: 8, overflow: "hidden" },
  gifImage: { width: "100%", height: 100 },

  // Lightbox
  lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  lightboxContent: { width: "100%", maxHeight: "85%", borderRadius: 12, backgroundColor: "#fff", padding: 12 },
  lightboxClose: { alignSelf: "flex-end", padding: 8, marginBottom: 8 },
  lightboxCloseText: { fontSize: 20, color: "#64748b" },
  lightboxImage: { width: "100%", height: 400, borderRadius: 8 },
});