import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Animated,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, categoryColors, darkColors, darkCategoryColors } from "../theme/colors";
import { useTranslation } from "react-i18next";
import { apiClient } from "../api/apiClient";
import { getUserId, ensureUserInitialized } from "../api/auth";
import AIQueryModal from "./AIQueryModal";
import { useTheme } from "../context/ThemeContext";
import { savePost, unsavePost, isPostSaved } from "../utils/savedPosts";

const { width: screenWidth } = Dimensions.get("window");

const AI_BASE_URL = Platform.select({
  android: "http://10.0.2.2:9000",
  default: "http://localhost:9000",
});

// ─── Shared translate helper ──────────────────────────────────
async function translateText(text, sourceLang, targetLang) {
  if (!text || !text.trim()) return "";
  const res = await fetch(`${AI_BASE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      source_lang: sourceLang,
      target_lang: targetLang,
    }),
  });
  if (!res.ok) throw new Error(`Translation failed: ${res.status}`);
  const data = await res.json();
  return (data.translatedText || "").trim();
}

// ─── Time formatting (matching Post.jsx exactly) ────────────
const ARABIC_MONTHS = {
  0:"يناير",1:"فبراير",2:"مارس",3:"أبريل",4:"مايو",5:"يونيو",
  6:"يوليو",7:"أغسطس",8:"سبتمبر",9:"أكتوبر",10:"نوفمبر",11:"ديسمبر"
};

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
      const month = ARABIC_MONTHS[publishedAt.getMonth()];
      return `${publishedAt.getDate()} ${month} ${publishedAt.getFullYear()}`;
    }
    return publishedAt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
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

function timeAgo(value, lang) {
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
  if (lang === "ar") {
    const month = ARABIC_MONTHS[date.getMonth()];
    return `${date.getDate()} ${month} ${date.getFullYear()}`;
  }
  return date.toLocaleDateString();
}

const PLACEHOLDER_IMG =
  "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";

const AVATAR_PLACEHOLDER = "https://ui-avatars.com/api/?name=User&background=0f172a&color=ffffff";

// ─── GIPHY API config ──────────────────────────────────────
const GIPHY_API_KEY = "lLef25w3W2ATXHCNsZflpvzbwQ44DFeE";

// ─── Emoji catalog builder (from Unicode ranges) ──────────
const EMOJI_RANGES = [
  [0x1f300, 0x1f5ff], [0x1f600, 0x1f64f], [0x1f680, 0x1f6ff],
  [0x1f700, 0x1f77f], [0x1f780, 0x1f7ff], [0x1f800, 0x1f8ff],
  [0x1f900, 0x1f9ff], [0x1fa70, 0x1faff], [0x2600, 0x26ff], [0x2700, 0x27bf],
];
const EMOJI_NAME_MAP = {
  "😀": "grinning face smile happy", "😂": "tears joy laugh funny",
  "😍": "heart eyes love", "🔥": "fire lit hot", "👏": "clap applause",
  "🙏": "pray thanks", "👍": "thumbs up agree", "👎": "thumbs down disagree",
  "❤️": "heart love", "😭": "cry sad tears", "🎉": "party celebration",
  "💯": "hundred perfect", "🤔": "thinking", "😎": "cool sunglasses",
  "😊": "smile happy blush", "😁": "grin happy smile", "🥰": "love hearts",
  "😢": "sad cry", "😡": "angry mad", "🤯": "mind blown shocked",
  "✅": "check done yes", "❌": "cross no", "✨": "sparkles shine",
  "🎯": "target goal", "🚀": "rocket launch", "😴": "sleep tired",
  "🤗": "hug support", "🙌": "raised hands celebrate",
};

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
  return q.split(" ").filter(Boolean).every((token) => keyword.includes(token));
}

async function fetchGifs(query = "trending", offset = 0) {
  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&offset=${offset}&rating=pg-13&lang=en`;
    const res = await fetch(url);
    const data = await res.json();
    return (data.data || []).map((gif) => ({
      id: gif.id,
      title: gif.title || "gif",
      url: gif.images?.original?.url || gif.images?.fixed_height?.url,
      previewUrl: gif.images?.fixed_height?.url || gif.images?.original?.url,
    }));
  } catch {
    return [];
  }
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
      return { ...node, replies: insertReplyIntoTree(node.replies, parentCommentId, createdReply) };
    }
    return node;
  });
}

// ─── Helper: shorten text ───────────────────────────────────
function shorten(text, max = 45) {
  if (!text) return "Untitled";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + "...";
}

// ─── Render media helper ────────────────➖─────────────────────
function PostMedia({ items, type = "card" }) {
  const count = items?.length || 0;
  if (count <= 0) return null;

  const singleHeight = type === "modal" ? 280 : 280;
  const gridItemHeight = type === "modal" ? 180 : 200;

  const renderMediaElement = (item, idx, extraCount) => {
    if (item.type === "video") {
      return (
        <TouchableOpacity key={idx} onPress={() => item.url && Linking.openURL(item.url)} style={[styles.mediaGridItem, { height: gridItemHeight, backgroundColor: "#111", borderRadius: 8, justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>▶ Play Video</Text>
        </TouchableOpacity>
      );
    }

    if (idx === 2 && extraCount > 0) {
      return (
        <View key={idx} style={[{ flex: 1, borderRadius: 8, overflow: "hidden", height: gridItemHeight }]}>
          <Image source={{ uri: item.url }} style={{ width: "100%", height: "100%", opacity: 0.6 }} resizeMode="cover" />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900" }}>+{extraCount}</Text>
          </View>
        </View>
      );
    }

    return (
      <Image key={idx} source={{ uri: item.url }} style={[styles.mediaGridItem, { height: gridItemHeight }]} resizeMode="cover" />
    );
  };

  if (count === 1) {
    const item = items[0];
    if (item.type === "video") {
      return (
        <View style={{ marginTop: 14, borderRadius: 12, overflow: "hidden", height: singleHeight, backgroundColor: "#111", justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>▶ Play Video</Text>
        </View>
      );
    }
    return (
      <View style={{ marginTop: 14, borderRadius: 12, overflow: "hidden" }}>
        <Image source={{ uri: item.url }} style={{ width: "100%", height: singleHeight }} resizeMode="cover" />
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
        {items.slice(0, 2).map((item, idx) => (
          <Image key={idx} source={{ uri: item.url }} style={[styles.mediaGridItem, { height: gridItemHeight }]} resizeMode="cover" />
        ))}
      </View>
    );
  }

  const extraCount = Math.max(0, count - 3);
  return (
    <View style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
      {items.slice(0, 3).map((item, idx) => renderMediaElement(item, idx, extraCount))}
    </View>
  );
}

// ─── Comment Item Component ──────────────────────────────────
function CommentItem({ comment, depth = 0, onReply, voteComment, onOpenAttachment, lang = "en" }) {
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const themeColors = darkMode ? darkColors : colors;
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = (comment.replies || []).length > 0;

  const [translatedComment, setTranslatedComment] = useState(null);
  const [showTranslatedComment, setShowTranslatedComment] = useState(false);
  const [isTranslatingComment, setIsTranslatingComment] = useState(false);

  const commentLang = comment.lang || "en";
  const needsCommentTranslation = (lang === "ar" && commentLang !== "ar") || (lang !== "ar" && commentLang === "ar");

  const handleTranslateComment = async () => {
    if (showTranslatedComment) {
      setShowTranslatedComment(false);
      return;
    }
    if (!needsCommentTranslation || !comment.content) return;
    setIsTranslatingComment(true);
    try {
      const targetLang = lang === "ar" ? "ar" : "en";
      const sourceLang = lang === "ar" ? "en" : "ar";
      const result = await translateText(comment.content, sourceLang, targetLang);
      setTranslatedComment(result);
      setShowTranslatedComment(true);
    } catch (err) {
      console.error("Comment translation error:", err.message);
    } finally {
      setIsTranslatingComment(false);
    }
  };

  return (
    <View style={[depth > 0 && { marginLeft: 16, borderLeftWidth: 1, borderLeftColor: themeColors.borderLight, paddingLeft: 12 }, { marginBottom: 10 }]}>
      <View style={[styles.commentCard, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Image source={{ uri: AVATAR_PLACEHOLDER }} style={[styles.commentAvatar, { borderColor: themeColors.borderLight }]} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.commentAuthorName, { color: themeColors.text }]}>{comment.userIdentifier || `User ${comment.userId?.slice?.(0, 8) || ""}`}</Text>
              <Text style={[styles.commentTime, { color: themeColors.muted }]}>{timeAgo(comment.createdAt, lang)}</Text>
            </View>
            <Text style={[styles.commentContent, { color: themeColors.textSecondary }]}>
              {showTranslatedComment && translatedComment ? translatedComment : comment.content}
            </Text>

            {/* Comment translate link */}
            {needsCommentTranslation && comment.content && (
              <TouchableOpacity onPress={handleTranslateComment} disabled={isTranslatingComment} style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.muted }}>
                  {isTranslatingComment ? t("translating") : showTranslatedComment ? t("viewOriginal") : (lang === "ar" ? t("translateToAr") : t("translateToEn"))}
                </Text>
              </TouchableOpacity>
            )}

            {comment.attachmentUrl && (
              <TouchableOpacity onPress={() => onOpenAttachment?.({ url: comment.attachmentUrl, type: comment.attachmentType || "image" })}>
                {comment.attachmentType === "video" ? (
                  <View style={{ width: 200, height: 120, backgroundColor: "#111", borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 6 }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>▶ Play Video</Text>
                  </View>
                ) : (
                  <Image source={{ uri: comment.attachmentUrl }} style={{ width: 200, height: 120, borderRadius: 8, marginTop: 6 }} resizeMode="cover" />
                )}
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => voteComment(comment.id, comment.userVote === 1 ? 0 : 1)}
                style={[styles.voteBtn, comment.userVote === 1 && styles.voteBtnActiveUp]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700" }}>▲</Text>
              </TouchableOpacity>
              <Text style={[styles.voteScore, { color: themeColors.text }, (comment.voteScore || 0) < 0 && { color: "#dc2626" }]}>
                {comment.voteScore || 0}
              </Text>
              <TouchableOpacity
                onPress={() => voteComment(comment.id, comment.userVote === -1 ? 0 : -1)}
                style={[styles.voteBtn, comment.userVote === -1 && styles.voteBtnActiveDown]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700" }}>▼</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onReply(comment)} style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: colors.brand, fontWeight: "600", fontSize: 13 }}>{t("comment")}</Text>
              </TouchableOpacity>
              {hasReplies && (
                <TouchableOpacity onPress={() => setShowReplies((prev) => !prev)} style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {showReplies ? t("hideReplies") : t("showReplies", { count: comment.replies.length })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>

      {hasReplies && showReplies && (
        <View style={{ marginTop: 6 }}>
            {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} onReply={onReply} voteComment={voteComment} onOpenAttachment={onOpenAttachment} lang={lang} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Emoji Picker ─────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }) {
  const emojiCatalog = useMemo(() => buildEmojiCatalog(), []);
  const [search, setSearch] = useState("");
  const [renderCount, setRenderCount] = useState(280);

  const filtered = useMemo(() => {
    const q = search.trim();
    return emojiCatalog.filter((entry) => matchesEmoji(entry, q));
  }, [emojiCatalog, search]);

  const displayed = useMemo(() => filtered.slice(0, renderCount), [filtered, renderCount]);

  return (
    <View style={styles.emojiPicker}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontWeight: "700", color: colors.text }}>Emoji</Text>
        <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: colors.muted }}>✕</Text></TouchableOpacity>
      </View>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search emoji..."
        placeholderTextColor={colors.muted}
        style={styles.emojiSearchInput}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, maxHeight: 180, overflow: "scroll" }}>
        {displayed.map(({ emoji, keyword }) => (
          <TouchableOpacity
            key={emoji}
            onPress={() => { onSelect(emoji); }}
            style={{ padding: 4, minWidth: 32, alignItems: "center" }}
          >
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {filtered.length > displayed.length && (
        <TouchableOpacity onPress={() => setRenderCount((prev) => prev + 240)} style={{ marginTop: 6, alignItems: "center" }}>
          <Text style={{ color: colors.brand, fontWeight: "600", fontSize: 12 }}>{t("showMoreEmojis")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── GIF Picker ───────────────────────────────────────────────
function GifPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState("trending");
  const [gifs, setGifs] = useState([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const debounceRef = useRef(null);

  const loadGifs = useCallback(async (query) => {
    setLoadingGifs(true);
    const results = await fetchGifs(query || "trending");
    setGifs(results);
    setLoadingGifs(false);
  }, []);

  useEffect(() => {
    loadGifs("trending");
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadGifs(text.trim() || "trending");
    }, 400);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <View style={styles.emojiPicker}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontWeight: "700", color: colors.text }}>GIFs</Text>
        <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: colors.muted }}>✕</Text></TouchableOpacity>
      </View>
      <TextInput
        value={search === "trending" ? "" : search}
        onChangeText={handleSearch}
        placeholder="Search GIFs..."
        placeholderTextColor={colors.muted}
        style={styles.emojiSearchInput}
      />
      {loadingGifs ? (
        <View style={{ height: 180, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="small" color={colors.brand} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} style={{ maxHeight: 180 }}>
          {gifs.map((gif) => (
            <TouchableOpacity key={gif.id} onPress={() => onSelect(gif)} style={{ width: 100, height: 80, borderRadius: 8, overflow: "hidden" }}>
              <Image source={{ uri: gif.previewUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Main PostCard Component ────────────────────────────────
export default function PostCard({ post, lang }) {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const isArabic = lang === "ar";
  const rtl = isArabic ? "rtl" : "ltr";
  const rtlRow = isArabic ? "row-reverse" : "row";
  const catColor = darkMode ? (darkCategoryColors[post.label] || darkCategoryColors.Other) : (categoryColors[post.label] || categoryColors.Other);

  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [dislikesCount, setDislikesCount] = useState(post.dislikes || 0);
  const [reaction, setReaction] = useState(post.userReaction || null);
  const [media, setMedia] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(() => isPostSaved(post.id));
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedText, setTranslatedText] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const postLang = post.lang || "en";
  const needsTranslation = (lang === "ar" && postLang !== "ar") || (lang !== "ar" && postLang === "ar");

  const MAX_CHARS = 220;
  const isLongText = post.text && post.text.length > MAX_CHARS;
  const previewText = isLongText ? post.text.slice(0, MAX_CHARS) + "..." : post.text;
  const publishedLabel = formatPublishedAt(post.articleCreatedAt || post.timestamp, i18n.language);
  const numImages = post.numImages || 0;

  // Load media
  useEffect(() => {
    if (!post.articleId && !post.id) return;
    const loadMedia = async () => {
      try {
        const res = await apiClient.get(`/api/posts/${post.id}/media`);
        if (res.data && Array.isArray(res.data)) {
          setMedia(res.data);
        }
      } catch {}
    };
    loadMedia();
  }, [post.articleId, post.id]);

  const getAuthUserId = async () => {
    await ensureUserInitialized();
    return getUserId() || "mobile-user";
  };

  const react = async (type) => {
    try {
      const userId = await getAuthUserId();
      const res = await apiClient.put(`/api/posts/${post.id}/react?userId=${userId}&type=${type}`);
      const data = res.data;
      setLikesCount(data.likes);
      setDislikesCount(data.dislikes);
      setReaction(data.status === "REMOVED" ? null : type);
    } catch {}
  };

  const handleToggleSave = async (e) => {
    e?.stopPropagation?.();
    if (isSaved) {
      unsavePost(post.id);
      setIsSaved(false);
    } else {
      savePost(post);
      setIsSaved(true);
    }
  };

  const visitOriginal = () => {
    if (post.articleUrl) Linking.openURL(post.articleUrl);
  };

  const openAIModal = () => {
    setIsAIModalOpen(true);
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const handleTranslate = async () => {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (!needsTranslation) return;
    setIsTranslating(true);
    try {
      const targetLang = lang === "ar" ? "ar" : "en";
      const sourceLang = lang === "ar" ? "en" : "ar";

      // Translate title separately
      if (post.title) {
        const translatedTitleText = await translateText(post.title, sourceLang, targetLang);
        setTranslatedTitle(translatedTitleText || post.title);
      }
      // Translate body text separately
      if (post.text) {
        const translatedBody = await translateText(post.text, sourceLang, targetLang);
        setTranslatedText(translatedBody || post.text);
      }
      setShowTranslated(true);
    } catch (err) {
      console.error("Translation error:", err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const buildMediaItems = () => {
    if (media && Array.isArray(media) && media.length > 0) {
      return media;
    }
    const count = numImages;
    if (count <= 0) return [];
    return Array.from({ length: count }, () => ({ type: "image", url: PLACEHOLDER_IMG }));
  };

  const mediaItems = buildMediaItems();

  // ── Full Article Modal (matching PostModal.jsx) ─────────────
  const renderArticleModal = () => (
    <PostModal
      post={post}
      visible={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      catColor={catColor}
      isArabic={isArabic}
      mediaItems={mediaItems}
      t={t}
      visitOriginal={visitOriginal}
      lang={lang}
    />
  );

  // ── Comments Modal ──────────────────────────────────────────
  const renderCommentsModal = () => (
    <CommentsModal
      post={post}
      visible={isCommentsOpen}
      onClose={() => setIsCommentsOpen(false)}
      lang={lang}
    />
  );

  return (
    <>
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => setIsModalOpen(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.card,
            { backgroundColor: darkMode ? catColor.bg : colors.surface, borderColor: catColor.border, direction: rtl, writingDirection: rtl },
          ]}
        >
          {/* Category accent line — positioned absolute left edge */}
          <View style={[styles.categoryLine, { backgroundColor: catColor.accent }]} />

          <View style={styles.cardContent}>
            {/* Header: category badge + time */}
            <View style={styles.postHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: catColor.pillBg }]}>
                <Text style={[styles.categoryText, { color: catColor.pillText }]}>{post.label ? t(`category_${post.label}`, post.label) : t("category_General")}</Text>
              </View>
              {publishedLabel ? <Text style={[styles.timeText, { color: darkMode ? "#94a3b8" : "#6e869a" }]}>{publishedLabel}</Text> : null}
            </View>

            {/* Title */}
            {post.title ? <Text style={[styles.title, { color: darkMode ? "#f1f5f9" : colors.text }, { textAlign: isArabic ? "right" : "left" }]}>{showTranslated && translatedTitle ? translatedTitle : post.title}</Text> : null}

            {/* Body */}
            <Text style={[styles.bodyText, { color: darkMode ? "#cbd5e1" : colors.textSecondary }, { textAlign: isArabic ? "right" : "left" }]} numberOfLines={isLongText && !showTranslated ? 5 : undefined}>
              {showTranslated && translatedText ? translatedText : previewText}
            </Text>

            {/* Show more link */}
            {isLongText && (
              <TouchableOpacity onPress={() => setIsModalOpen(true)}>
                <Text style={[styles.showMore, { color: darkMode ? "#60a5fa" : colors.brand600 }]}>{t("showMore")}</Text>
              </TouchableOpacity>
            )}

            {/* Translate link — gray text between body and media */}
            {needsTranslation && (
              <TouchableOpacity onPress={handleTranslate} disabled={isTranslating} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: darkMode ? "#64748b" : "#94a3b8" }}>
                  {isTranslating ? t("translating") : showTranslated ? t("viewOriginal") : (lang === "ar" ? t("translateToAr") : t("translateToEn"))}
                </Text>
              </TouchableOpacity>
            )}

            {/* Media */}
            {mediaItems.length > 0 && (
              <View style={styles.mediaContainer}>
                <PostMedia items={mediaItems} type="card" />
              </View>
            )}

            {/* Language badge */}
            {post.lang ? <Text style={[styles.langText, { backgroundColor: darkMode ? "#334155" : "#f5f8fd", color: darkMode ? "#94a3b8" : "#6e869a" }]}>{post.lang}</Text> : null}

            {/* Tags */}
            {post.tags?.length > 0 && (
              <View style={styles.postTags}>
                {post.tags.map((tag, idx) => (
                  <Text key={idx} style={[styles.postTag, { backgroundColor: darkMode ? "#334155" : "#f5f8fd", color: darkMode ? "#94a3b8" : "#6e869a" }]}>#{tag}</Text>
                ))}
              </View>
            )}

            {/* Actions bar — scrollable to prevent overflow */}
            <View style={[styles.postActions, { borderTopColor: darkMode ? "#334155" : colors.borderLight }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: rtlRow, alignItems: "center", gap: 4 }}>
                <TouchableOpacity onPress={() => react("LIKE")} style={styles.postActionBtn}>
                  <Text style={styles.postActionIcon}>👍</Text>
                  <Text style={[styles.postActionLabel, { color: darkMode ? "#94a3b8" : "#6e869a" }, reaction === "LIKE" && { color: darkMode ? "#60a5fa" : colors.brand600 }]}>{likesCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => react("DISLIKE")} style={styles.postActionBtn}>
                  <Text style={styles.postActionIcon}>👎</Text>
                  <Text style={[styles.postActionLabel, { color: darkMode ? "#94a3b8" : "#6e869a" }, reaction === "DISLIKE" && { color: darkMode ? "#fca5a5" : colors.error }]}>{dislikesCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsCommentsOpen(true)} style={styles.postActionBtn}>
                  <Text style={styles.postActionIcon}>💬</Text>
                  <Text style={styles.postActionLabel}>{t("comment")}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={openAIModal} style={[styles.postActionBtn, { backgroundColor: darkMode ? "#2d1b69" : "#f5f3ff", borderRadius: 999, paddingHorizontal: 10 }]}>
                  <Text style={[styles.postActionLabel, { color: darkMode ? "#a78bfa" : "#7c3aed" }]}>🤖 {t("askAI")}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={(e) => { e?.stopPropagation?.(); handleToggleSave(e); }} style={styles.postActionBtn}>
                  <Text style={styles.postActionIcon}>{isSaved ? "📂" : "💾"}</Text>
                  <Text style={[styles.postActionLabel, isSaved && { color: "#7c3aed" }]}>
                    {isSaved ? t("saved") : t("save")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={visitOriginal} style={styles.postActionBtn} disabled={!post.articleUrl}>
                  <Text style={[styles.postActionIcon, !post.articleUrl && { opacity: 0.4 }]}>🔗</Text>
                  <Text style={[styles.postActionLabel, !post.articleUrl && { opacity: 0.4 }]}>{t("visit")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {renderArticleModal()}
      {renderCommentsModal()}
      <AIQueryModal post={post} visible={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} />
    </>
  );
}

// ─── Render comment attachment ──────────────────────────────
function renderCommentAttachment(comment, onPreviewAttachment) {
  if (!comment.attachmentUrl) return null;
  const openPreview = () => onPreviewAttachment?.({ url: comment.attachmentUrl, type: comment.attachmentType || "image" });

  if (comment.attachmentType === "video" || comment.attachmentUrl?.includes(".mp4")) {
    return (
      <TouchableOpacity key="vid" onPress={openPreview} style={{ marginTop: 6, borderRadius: 8, overflow: "hidden", width: "100%", maxWidth: 320 }}>
        <View style={{ height: 160, backgroundColor: "#111", justifyContent: "center", alignItems: "center", borderRadius: 8 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>▶ Play Video</Text>
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity key="img" onPress={openPreview} style={{ marginTop: 6, borderRadius: 8, overflow: "hidden", width: "100%", maxWidth: 320 }}>
      <Image source={{ uri: comment.attachmentUrl }} style={{ width: "100%", height: 160, borderRadius: 8 }} resizeMode="cover" />
    </TouchableOpacity>
  );
}

// ─── Comments Modal ──────────────────────────────────────────
const POST_IMG_PLACEHOLDER = "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";

function CommentsModal({ post, visible, onClose, lang }) {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const themeColors = darkMode ? darkColors : colors;
  const commentsLang = i18n.language;
  const isArabicComments = commentsLang === "ar";
  const isArabic = lang === "ar";
  const catColor = categoryColors[post?.label] || categoryColors.Other;

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("trending");
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [sortBy, setSortBy] = useState("recency");

  const fetchRepliesRecursively = async (comment, userId) => {
    try {
      const res = await apiClient.get(`/api/comments/${comment.id}/replies?userId=${userId}`);
      const replies = res.data || [];
      const hydrated = await Promise.all(replies.map((r) => fetchRepliesRecursively(r, userId)));
      return { ...comment, replies: hydrated };
    } catch {
      return { ...comment, replies: [] };
    }
  };

  const sortClientSide = (items) => {
    const cloned = [...items];
    if (sortBy === "newest" || sortBy === "recency") return cloned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sortBy === "oldest") return cloned.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (sortBy === "most_popular") return cloned.sort((a, b) => (b.voteScore || 0) - (a.voteScore || 0));
    if (sortBy === "relevance") {
      return cloned.sort((a, b) => {
        const sa = (a.voteScore || 0) + (a.replies?.length || 0) * 0.75;
        const sb = (b.voteScore || 0) + (b.replies?.length || 0) * 0.75;
        return sb - sa;
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
      const res = await apiClient.get(`/api/comments/post/${post.id}?sortBy=${serverSort}&page=0&size=50&userId=${userId}`);
      const payload = res.data;
      const roots = payload.content || [];
      const threaded = await Promise.all(roots.map((c) => fetchRepliesRecursively(c, userId)));
      setComments(sortClientSide(threaded));
    } catch (err) {
      console.error("Load comments error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [sortBy, post?.id]);

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
        attachmentUrl = attachment.url;
        attachmentType = attachment.file?.type?.startsWith("video/") ? "video" : "image";
      }
      const res = await apiClient.post(`/api/comments?userId=${userId}`, {
        postId: post.id,
        content: trimmed || "(attachment)",
        parentCommentId,
        attachmentUrl,
        attachmentType,
      });
      const created = res.data;
      setDraft("");
      setAttachment(null);
      setReplyingTo(null);
      setComments((prev) => {
        if (parentCommentId) {
          return insertReplyIntoTree(prev, parentCommentId, created);
        }
        return sortClientSide([{ ...created, replies: created.replies || [] }, ...prev]);
      });
      await loadComments();
    } catch (err) {
      console.error("Submit comment error:", err.message);
    }
  };

  const voteComment = async (commentId, voteType) => {
    try {
      await ensureUserInitialized();
      const userId = getUserId();
      await apiClient.post(`/api/comments/${commentId}/vote?userId=${userId}`, { voteType });
      await loadComments();
    } catch (err) {
      console.error("Vote error:", err.message);
    }
  };

  const handleFilePick = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === "video";
        setAttachment({
          kind: "file",
          file: { name: asset.fileName || "attachment", type: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg") },
          url: asset.uri,
          title: asset.fileName || (isVideo ? "video" : "image"),
        });
      }
    } catch {}
  };

  const postPreview = shorten(post?.text || "", 220);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: themeColors.bg }}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ flex: 1, backgroundColor: themeColors.surface, marginTop: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: themeColors.borderLight }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.text, flex: 1 }} numberOfLines={1}>
              {t("postCommentsTitle", { title: shorten(post?.title || t("untitledPost"), 36) })}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 999, borderWidth: 1, borderColor: themeColors.borderLight, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 16, color: themeColors.text }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }}>
              {/* Post Preview */}
              <View style={{ margin: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: themeColors.borderLight, backgroundColor: themeColors.surface }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: themeColors.muted, textTransform: "uppercase", letterSpacing: 1 }}>{t("postPreview")}</Text>
                {post?.title && <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.text, marginTop: 4 }}>{post.title}</Text>}
                <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 4, lineHeight: 18 }}>{postPreview}</Text>
                {(post?.numImages || 0) > 0 && (
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                    {Array.from({ length: Math.min(3, post.numImages || 0) }).map((_, idx) => (
                      <Image key={idx} source={{ uri: POST_IMG_PLACEHOLDER }} style={{ flex: 1, height: 80, borderRadius: 8 }} resizeMode="cover" />
                    ))}
                  </View>
                )}
              </View>

              {/* Sort & Comments */}
              <View style={{ margin: 12, padding: 0 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ fontWeight: "700", color: themeColors.text, fontSize: 15 }}>{t("comments")}</Text>
                  <TouchableOpacity onPress={() => {
                    const options = ["recency", "newest", "oldest", "most_popular", "relevance"];
                    const idx = options.indexOf(sortBy);
                    setSortBy(options[(idx + 1) % options.length]);
                  }} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: themeColors.surfaceSoft, borderWidth: 1, borderColor: themeColors.borderLight }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.text }}>
                      {sortBy === "most_popular" ? t("sortPopular") : sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                    </Text>
                  </TouchableOpacity>
                </View>

                {loading ? (
                  <View style={{ padding: 16, backgroundColor: themeColors.surfaceSoft, borderRadius: 12, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={{ fontSize: 13, color: themeColors.muted, marginTop: 6 }}>{t("loadingComments")}</Text>
                  </View>
                ) : comments.length === 0 ? (
                  <View style={{ padding: 16, backgroundColor: themeColors.surfaceSoft, borderRadius: 12 }}>
                    <Text style={{ fontSize: 13, color: themeColors.muted, textAlign: "center" }}>{t("noCommentsYet")}</Text>
                  </View>
                ) : (
                  comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} onReply={setReplyingTo} voteComment={voteComment} onOpenAttachment={setPreviewAttachment} lang={i18n.language} />
                  ))
                )}
              </View>
            </ScrollView>

            {/* Input area */}
            <View style={{ borderTopWidth: 1, borderTopColor: themeColors.borderLight, backgroundColor: themeColors.surface, paddingBottom: 20 }}>
              {replyingTo && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: darkMode ? "#1e1b4b" : colors.brand50, marginHorizontal: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: darkMode ? "#312e81" : colors.brandLight }}>
                  <Text style={{ fontSize: 12, color: darkMode ? "#a78bfa" : colors.brand, flex: 1 }} numberOfLines={1}>
                    Replying to {replyingTo.userIdentifier || `User ${replyingTo.userId?.slice?.(0, 8) || ""}`}
                  </Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}><Text style={{ color: darkMode ? "#a78bfa" : colors.brand, fontWeight: "700", fontSize: 12 }}>Cancel</Text></TouchableOpacity>
                </View>
              )}

              {attachment && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: themeColors.surfaceSoft, marginHorizontal: 8, marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: themeColors.borderLight }}>
                  <Text style={{ fontSize: 12, color: themeColors.text, flex: 1 }} numberOfLines={1}>
                    Attachment: {attachment.title || attachment.file?.name || "selected"}
                  </Text>
                  <TouchableOpacity onPress={() => setAttachment(null)}><Text style={{ color: "#dc2626", fontWeight: "600", fontSize: 12 }}>Remove</Text></TouchableOpacity>
                </View>
              )}

              {/* Toolbar + Input */}
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 8 }}>
                <TouchableOpacity onPress={handleFilePick} style={[styles.commentToolBtn, { backgroundColor: darkMode ? "#334155" : "#f1f5f9", borderColor: darkMode ? "#475569" : colors.borderLight }]}><Text style={{ fontSize: 14 }}>📎</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowGifPicker((prev) => !prev); setShowEmojiPicker(false); }} style={[styles.commentToolBtn, { backgroundColor: darkMode ? "#334155" : "#f1f5f9", borderColor: darkMode ? "#475569" : colors.borderLight }]}><Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.text }}>GIF</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowEmojiPicker((prev) => !prev); setShowGifPicker(false); }} style={[styles.commentToolBtn, { backgroundColor: darkMode ? "#334155" : "#f1f5f9", borderColor: darkMode ? "#475569" : colors.borderLight }]}><Text style={{ fontSize: 14 }}>😊</Text></TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4 }}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={replyingTo ? t("writeReply") : t("writeCommentPlaceholder")}
                  placeholderTextColor={themeColors.muted}
                  style={[styles.commentInput, { flex: 1, marginRight: 8, backgroundColor: themeColors.surfaceSoft, borderColor: themeColors.borderLight, color: themeColors.text }]}
                  multiline
                />
                <TouchableOpacity
                  onPress={() => submitComment({ content: draft, parentCommentId: replyingTo?.id || null })}
                  style={[styles.commentSubmit, { paddingVertical: 8, paddingHorizontal: 14 }]}
                >
                  <Text style={styles.commentSubmitText}>{replyingTo ? t("postReply") : t("postComment")}</Text>
                </TouchableOpacity>
              </View>

              {/* Emoji / GIF pickers */}
              {showEmojiPicker && <EmojiPicker onSelect={(emoji) => { setDraft((prev) => `${prev || ""}${emoji}`); }} onClose={() => setShowEmojiPicker(false)} />}
              {showGifPicker && <GifPicker onSelect={(gif) => { setAttachment({ kind: "gif", url: gif.url, title: gif.title }); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />}
            </View>
          </View>

          {/* Attachment Preview Modal */}
          <Modal visible={!!previewAttachment} transparent onRequestClose={() => setPreviewAttachment(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => setPreviewAttachment(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 8, maxWidth: "90%", maxHeight: "80%" }}>
                <TouchableOpacity onPress={() => setPreviewAttachment(null)} style={{ alignSelf: "flex-end", padding: 6 }}><Text style={{ fontSize: 20 }}>✕</Text></TouchableOpacity>
                {previewAttachment?.type === "video" ? (
                  <View style={{ width: 250, height: 200, backgroundColor: "#111", borderRadius: 8, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>▶ Video Attachment</Text>
                  </View>
                ) : (
                  <Image source={{ uri: previewAttachment?.url }} style={{ width: 250, height: 250, borderRadius: 8 }} resizeMode="contain" />
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── PostModal — Full Article Viewer (matching PostModal.jsx) ─
function PostModal({ post, visible, onClose, catColor, isArabic, mediaItems, t, visitOriginal, lang }) {
  const { darkMode } = useTheme();
  const themeColors = darkMode ? darkColors : colors;
  const rtl = isArabic ? "rtl" : "ltr";

  const [content, setContent] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const textPaneRef = useRef(null);
  const mediaRefs = useRef(new Map());

  // Translation state for PostModal
  const [isTranslatingPost, setIsTranslatingPost] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [showTranslatedPost, setShowTranslatedPost] = useState(false);

  const postLang = post.lang || "en";
  const needsPostTranslation = (lang === "ar" && postLang !== "ar") || (lang !== "ar" && postLang === "ar");

  const handleTranslatePost = async () => {
    if (showTranslatedPost) {
      setShowTranslatedPost(false);
      return;
    }
    if (!needsPostTranslation) return;
    setIsTranslatingPost(true);
    try {
      const targetLang = lang === "ar" ? "ar" : "en";
      const sourceLang = lang === "ar" ? "en" : "ar";
      // Translate title
      if (post.title) {
        const tt = await translateText(post.title, sourceLang, targetLang);
        setTranslatedTitle(tt || post.title);
      }
      // Translate body text
      if (post.text) {
        const tb = await translateText(post.text, sourceLang, targetLang);
        setTranslatedContent(tb || post.text);
      }
      setShowTranslatedPost(true);
    } catch (err) {
      console.error("PostModal translation error:", err.message);
    } finally {
      setIsTranslatingPost(false);
    }
  };

  // Load ordered content from API, with fallback
  useEffect(() => {
    if (!post?.id) return;
    const loadContent = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/api/posts/${post.id}/content`);
        const data = res.data;
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

  const allMediaItems = useMemo(
    () =>
      content
        .map((item, index) => ({ ...item, contentIndex: index }))
        .filter((item) => item.type === "media" && item.url),
    [content]
  );

  useEffect(() => {
    if (activeMediaIndex >= allMediaItems.length) {
      setActiveMediaIndex(0);
    }
  }, [activeMediaIndex, allMediaItems.length]);

  useEffect(() => {
    if (!textPaneRef.current || allMediaItems.length === 0) return;
  }, [allMediaItems]);

  const scrollToMedia = (mediaIndex) => {
    setActiveMediaIndex(mediaIndex);
  };

  const activeMedia = allMediaItems[activeMediaIndex] || null;

  const renderSingleMedia = (item, maxHeight = "100%") => {
    if (!item) return null;
    if (item.mediaType === "video" || item.url?.includes(".mp4")) {
      return (
        <View style={{ width: "100%", borderRadius: 8, overflow: "hidden", backgroundColor: "#000" }}>
          <TouchableOpacity onPress={() => item.url && Linking.openURL(item.url)} style={{ height: 300, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>▶ Play Video</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <TouchableOpacity onPress={() => setSelectedMedia(item)} style={{ width: "100%" }}>
        <Image source={{ uri: item.url }} style={{ width: "100%", height: 280, borderRadius: 8 }} resizeMode="contain" />
      </TouchableOpacity>
    );
  };

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(11,26,43,0.55)" }}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ flex: 1, backgroundColor: themeColors.surface, marginTop: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: themeColors.borderLight, direction: rtl, writingDirection: rtl }}>
            <View style={{ flex: 1, direction: rtl, writingDirection: rtl }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: themeColors.text, lineHeight: 24 }} numberOfLines={1}>
                {showTranslatedPost && translatedTitle ? translatedTitle : post.title || t("untitledPost")}
              </Text>
              {/* Translate button in header */}
              {needsPostTranslation && (
                <TouchableOpacity onPress={handleTranslatePost} disabled={isTranslatingPost} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#94a3b8" }}>
                    {isTranslatingPost ? t("translating") : showTranslatedPost ? t("viewOriginal") : (lang === "ar" ? t("translateToAr") : t("translateToEn"))}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
                <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: themeColors.borderLight, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 18, color: themeColors.muted }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body — full article content */}
          <ScrollView ref={textPaneRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
            {/* Meta row */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <View style={[styles.categoryBadge, { backgroundColor: catColor.pillBg }]}>
                <Text style={[styles.categoryText, { color: catColor.pillText }]}>{post.label ? t(`category_${post.label}`, post.label) : t("category_General")}</Text>
              </View>
              {post.lang ? <Text style={{ fontSize: 13, color: themeColors.muted, marginLeft: 8 }}>· {post.lang}</Text> : null}
            </View>

            {isLoading ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={{ fontSize: 14, color: themeColors.muted, marginTop: 8 }}>{t("loadingArticleDetails")}</Text>
              </View>
            ) : (
              content.map((item, contentIndex) => {
                if (item.type === "paragraph") {
                  return (
                    <View key={`p-${contentIndex}`} style={{ marginBottom: 20 }}>
                      <Text style={styles.modalArticleBody}>
                        {showTranslatedPost && translatedContent ? translatedContent : item.text}
                      </Text>
                    </View>
                  );
                }

                if (item.type === "media" && item.url) {
                  const mediaIdx = allMediaItems.findIndex((media) => media.contentIndex === contentIndex);
                  const isVideo = item.mediaType === "video" || item.url?.includes(".mp4");

                  return (
                    <TouchableOpacity
                      key={`m-${contentIndex}`}
                      activeOpacity={0.9}
                      onPress={() => { if (!isVideo) setSelectedMedia(item); else if (item.url) Linking.openURL(item.url); }}
                      style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: themeColors.borderLight }}
                    >
                      {isVideo ? (
                        <View style={{ height: 280, backgroundColor: "#111", justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>▶ Play Video</Text>
                        </View>
                      ) : (
                        <Image source={{ uri: item.url }} style={{ width: "100%", height: 300 }} resizeMode="cover" />
                      )}
                    </TouchableOpacity>
                  );
                }

                return null;
              })
            )}

            {/* Tags */}
            {post.tags?.length > 0 && (
              <View style={styles.postTags}>
                {post.tags.map((tag, idx) => (
                  <Text key={idx} style={[styles.postTag, { backgroundColor: darkMode ? "#334155" : "#f5f8fd", color: darkMode ? "#94a3b8" : "#6e869a" }]}>#{tag}</Text>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: themeColors.borderLight, backgroundColor: themeColors.surface }}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: themeColors.muted }}>{t("collapse")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={visitOriginal}
              disabled={!post.articleUrl}
              style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: post.articleUrl ? colors.brand : themeColors.borderLight }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: post.articleUrl ? "#fff" : themeColors.muted }}>
                {t("visitOriginalArticle")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lightbox */}
          <Modal visible={!!selectedMedia} transparent onRequestClose={() => setSelectedMedia(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => setSelectedMedia(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 }}>
              <View style={{ maxWidth: "90%", maxHeight: "90vh" }}>
                <TouchableOpacity onPress={() => setSelectedMedia(null)} style={{ alignSelf: "flex-end", padding: 8, marginBottom: 8 }}>
                  <Text style={{ color: "#fff", fontSize: 22, opacity: 0.7 }}>✕</Text>
                </TouchableOpacity>
                {selectedMedia?.mediaType === "video" || selectedMedia?.url?.includes(".mp4") ? (
                  <View style={{ width: screenWidth - 80, height: 300, backgroundColor: "#111", borderRadius: 12, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>▶ Video</Text>
                  </View>
                ) : (
                  <Image source={{ uri: selectedMedia?.url }} style={{ width: screenWidth - 80, height: 500, borderRadius: 12 }} resizeMode="contain" />
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
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

// ─── Styles — matching Post.css classes exactly ──────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: "#0b1a2b",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  cardContent: {
    padding: 20,
  },
  // .post-category-line
  categoryLine: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  // .post-header
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  // .post-category
  categoryBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.72,
  },
  // .post-time
  timeText: {
    fontSize: 13,
    color: "#6e869a",
    fontWeight: "500",
  },
  // .post-title
  title: {
    fontFamily: "Plus Jakarta Sans",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: 8,
    color: colors.text,
  },
  // .post-text
  bodyText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 25,
  },
  // .post-show-more
  showMore: {
    color: colors.brand600,
    fontWeight: "600",
    fontSize: 14,
    marginTop: 8,
  },
  mediaContainer: { marginTop: 14 },
  mediaSingle: { width: "100%", borderRadius: 12 },
  mediaGrid2: { flexDirection: "row", gap: 6 },
  mediaGrid3: { flexDirection: "row", gap: 6 },
  mediaGridItem: { flex: 1, borderRadius: 8 },
  mediaOverlay: { opacity: 0.6 },
  mediaExtraOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  mediaExtraText: { color: "#fff", fontSize: 24, fontWeight: "900" },
  videoPlaceholder: { width: "100%", borderRadius: 12, backgroundColor: "#111", justifyContent: "center", alignItems: "center" },
  videoPlayText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  // .post-lang
  langText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.48,
    color: "#6e869a",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#f5f8fd",
    alignSelf: "flex-start",
    marginTop: 10,
    overflow: "hidden",
  },
  // .post-tags
  postTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  // .post-tag
  postTag: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6e869a",
    backgroundColor: "#f5f8fd",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  // .post-actions
  postActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  // .post-action-btn
  postActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  postActionIcon: {
    fontSize: 14,
  },
  postActionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6e869a",
  },

  // Modals
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  modalClose: { fontSize: 22, color: colors.text, fontWeight: "700" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  modalContent: { padding: 16 },
  modalCategoryBadge: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, marginBottom: 12 },
  modalCategoryText: { fontSize: 12, fontWeight: "800" },
  modalArticleTitle: { fontSize: 20, fontWeight: "900", color: colors.text, marginBottom: 12, lineHeight: 26 },
  modalArticleBody: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  viewOriginalBtn: { marginTop: 20, backgroundColor: colors.brand, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  viewOriginalText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Comments
  commentCard: { backgroundColor: colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight },
  commentAuthorName: { fontSize: 13, fontWeight: "700", color: colors.text },
  commentTime: { fontSize: 11, color: colors.muted },
  commentContent: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  voteBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#f1f5f9" },
  voteBtnActiveUp: { backgroundColor: "#d1fae5" },
  voteBtnActiveDown: { backgroundColor: "#fee2e2" },
  voteScore: { fontSize: 13, fontWeight: "700", color: colors.text },

  // Comment input / tools
  commentToolBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: colors.borderLight },
  commentInput: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.text, backgroundColor: colors.surfaceSoft, maxHeight: 80 },
  commentSubmit: { backgroundColor: colors.brand, borderRadius: 10, justifyContent: "center" },
  commentSubmitText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  // Emoji / GIF picker
  emojiPicker: { borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.surfaceSoft, padding: 12, maxHeight: 280 },
  emojiSearchInput: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: colors.text, backgroundColor: colors.surface, marginBottom: 8 },
});