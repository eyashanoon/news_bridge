import { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { categoryTheme } from "../utils/categoryColors";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { savePost, unsavePost } from "../utils/savedPosts";
import { API_CONFIG } from "../api/config";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import GuestSignupPrompt from "./GuestSignupPrompt";
import PostCommentsModal from "./PostCommentsModal";
import { useTranslation } from "react-i18next";
import {
  detectItemLanguage,
  needsTranslation as itemNeedsTranslation,
  getTranslationTargetLang,
  getTranslateButtonLabel,
  getLanguageDisplayLabel,
} from "../utils/languageUtils";
import { translateText } from "../utils/translateUtils";

function formatPublishedAt(value) {
  if (!value) return "";
  const publishedAt = new Date(value);
  if (Number.isNaN(publishedAt.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - publishedAt.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays >= 7) {
    return publishedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  if (diffDays >= 1) return `${diffDays}d ago`;
  if (diffHours >= 1) return `${diffHours}h ago`;
  if (diffMinutes >= 1) return `${diffMinutes}m ago`;
  return "just now";
}

export default function Post({ post, onAskAI, onPress, isVisible = false }) {
  const theme = categoryTheme[post.label]?.light || categoryTheme.General.light;
  const navigation = useNavigation();
  const { session } = useSession();
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language;
  const isRtl = lang === "ar";
  const postLang = detectItemLanguage(post);
  const needsTranslation = itemNeedsTranslation(post, lang);
  const isGuest = !session?.type || session?.type === "PRIMITIVE";
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [dislikesCount, setDislikesCount] = useState(post.dislikes || 0);
  const [reaction, setReaction] = useState(post.userReaction ?? null);

  useEffect(() => {
    setLikesCount(post.likes || 0);
    setDislikesCount(post.dislikes || 0);
    setReaction(post.userReaction ?? null);
  }, [post.id, post.likes, post.dislikes, post.userReaction]);
  const [media, setMedia] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [guestPrompt, setGuestPrompt] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedFullText, setTranslatedFullText] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);

  // ─── Interaction Tracking (matches web Post.jsx) ───────────
  const visibleStart = useRef(null);
  const viewSent = useRef(false);

  const sendView = async () => {
    if (post.isTopicPost) return;
    if (viewSent.current) return;
    viewSent.current = true;
    try {
      await ensureUserInitialized();
      const userId = await getUserId();
      await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/view?userId=${userId}`, { method: "POST" });
    } catch (e) { console.warn("View tracking failed:", e); }
  };

  const sendTimeSpent = async (seconds) => {
    if (post.isTopicPost) return;
    try {
      await ensureUserInitialized();
      const userId = await getUserId();
      await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/time?userId=${userId}&seconds=${seconds}`, { method: "POST" });
    } catch (e) { console.warn("Time tracking failed:", e); }
  };

  const sendClick = async () => {
    try {
      await ensureUserInitialized();
      const userId = await getUserId();
      await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/click?userId=${userId}`, { method: "POST" });
    } catch (e) { console.warn("Click tracking failed:", e); }
  };

  // View tracking when ≥60% visible (matches web IntersectionObserver threshold)
  useEffect(() => {
    if (!isVisible) {
      if (visibleStart.current) {
        const seconds = (Date.now() - visibleStart.current) / 1000.0;
        if (seconds > 1) sendTimeSpent(seconds);
        visibleStart.current = null;
      }
      return;
    }
    visibleStart.current = Date.now();
    sendView();
    return () => {
      if (visibleStart.current) {
        const seconds = (Date.now() - visibleStart.current) / 1000.0;
        if (seconds > 1) sendTimeSpent(seconds);
        visibleStart.current = null;
      }
    };
  }, [isVisible, post.id]);

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
        const translated = await translateText(post.title, postLang, targetLang);
        setTranslatedTitle(translated || post.title);
      }
      if (post.text) {
        const translated = await translateText(post.text, postLang, targetLang);
        setTranslatedFullText(translated || post.text);
      }
      setShowTranslated(true);
    } finally {
      setIsTranslating(false);
    }
  };

  const displayText = showTranslated && translatedFullText ? translatedFullText : (post.text || "");
  const MAX_CHARS = 220;
  const isLongText = displayText.length > MAX_CHARS;
  const previewText = isLongText ? displayText.slice(0, MAX_CHARS) + "..." : displayText;
  const numImages = post.numImages || 0;

  useEffect(() => {
    if (post.isTopicPost && post.mediaItems && Array.isArray(post.mediaItems) && post.mediaItems.length > 0) {
      setMedia(post.mediaItems);
      return;
    }
    if (!post.articleId) return;
    const loadMedia = async () => {
      try {
        const res = await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/media`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setMedia(data);
      } catch { }
    };
    loadMedia();
  }, [post.id, post.articleId]);

  const react = async (type) => {
    if (isGuest) { setGuestPrompt("like"); return; }
    await ensureUserInitialized();
    const userId = await getUserId();
    const reactUrl = post.isTopicPost
      ? `${API_CONFIG.baseURL}/api/topics/${post.topicId}/posts/${post.id}/react?userId=${userId}&type=${type}`
      : `${API_CONFIG.baseURL}/api/posts/${post.id}/react?userId=${userId}&type=${type}`;
    try {
      const res = await apiFetch(reactUrl, { method: "PUT" });
      if (!res.ok) return;
      const data = await res.json();
      setLikesCount(data.likes);
      setDislikesCount(data.dislikes);
      setReaction(data.userReaction ?? (data.status === "REMOVED" ? null : type));
    } catch (e) { console.error(e); }
  };

  const handleToggleSave = async () => {
    if (isGuest) { setGuestPrompt("save"); return; }
    try {
      if (isSaved) {
        await unsavePost(post.id);
        setIsSaved(false);
      } else {
        await savePost(post);
        setIsSaved(true);
      }
    } catch (e) { console.warn(e); }
  };

  const openArticle = () => {
    if (post.articleUrl) {
      sendClick();
      Linking.openURL(post.articleUrl);
    }
  };

  const renderImages = () => {
    const items = media && Array.isArray(media) && media.length > 0 ? media : [];
    const count = items.length > 0 ? items.length : numImages;
    if (count <= 0) return null;

    const placeholder = "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";
    const getUrl = (idx) => items[idx]?.url || placeholder;

    if (count === 1) {
      return (
        <View style={styles.mediaGrid1}>
          <Image source={{ uri: getUrl(0) }} style={styles.mediaItem1} resizeMode="cover" />
        </View>
      );
    }

    if (count === 2) {
      return (
        <View style={styles.mediaGrid2}>
          <Image source={{ uri: getUrl(0) }} style={styles.mediaItem2} resizeMode="cover" />
          <Image source={{ uri: getUrl(1) }} style={styles.mediaItem2} resizeMode="cover" />
        </View>
      );
    }

    const extraCount = Math.max(0, count - 3);
    return (
      <View style={styles.mediaGrid3}>
        <Image source={{ uri: getUrl(0) }} style={styles.mediaItem3} resizeMode="cover" />
        <Image source={{ uri: getUrl(1) }} style={styles.mediaItem3} resizeMode="cover" />
        <View style={styles.mediaOverlayWrapper}>
          <Image source={{ uri: getUrl(2) }} style={styles.mediaItem3} resizeMode="cover" />
          {extraCount > 0 && (
            <View style={styles.mediaOverlay}>
              <Text style={styles.mediaOverlayText}>+{extraCount}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(post)}
      style={[styles.card, { backgroundColor: th(darkMode, dc.surface, "#ffffff"), borderColor: th(darkMode, dc.border, theme.border) }]}
    >
      {/* Category color line */}
      <View style={[styles.categoryLine, { backgroundColor: theme.accent, left: isRtl ? undefined : 0, right: isRtl ? 0 : undefined }]} />

      <View style={styles.header}>
        <View style={[styles.categoryBadge, { backgroundColor: theme.pillBg }]}>
          <Text style={[styles.categoryText, { color: theme.pillText }]}>{t(`category_${post.label}`, { defaultValue: post.label })}</Text>
        </View>
        <Text style={[styles.time, { color: th(darkMode, dc.muted, "#6e869a") }]}>{formatPublishedAt(post.articleCreatedAt)}</Text>
      </View>

      {post.isTopicPost && post.authorName && (
        <View style={styles.authorRow}>
          {post.authorAvatar ? (
            <Image source={{ uri: post.authorAvatar }} style={styles.authorAvatar} />
          ) : (
            <View style={styles.authorAvatarPlaceholder}>
              <Text style={styles.authorAvatarLetter}>{(post.authorName || "E")[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: th(darkMode, dc.text, "#1e293b") }]}>{post.authorName || "Editor"}</Text>
            <Text style={styles.authorLink}>{t("profileInfo")} →</Text>
          </View>
        </View>
      )}

      {post.title ? (
        <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>
          {showTranslated && translatedTitle ? translatedTitle : post.title}
        </Text>
      ) : null}

      <Text style={[styles.text, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{previewText}</Text>

      {needsTranslation && (
        <TouchableOpacity onPress={handleTranslate} disabled={isTranslating} style={styles.translateBtn}>
          <Text style={[styles.translateText, { color: theme.accent }]}>
            {isTranslating ? t("translating") : showTranslated ? t("viewOriginal") : getTranslateButtonLabel(lang, t)}
          </Text>
        </TouchableOpacity>
      )}

      {isLongText ? (
        <TouchableOpacity onPress={() => onPress?.(post)}>
          <Text style={[styles.showMore, { color: theme.accent }]}>{t("showMore")}</Text>
        </TouchableOpacity>
      ) : null}

      {renderImages()}

      {postLang ? (
        <Text
          accessibilityLabel={t("postLanguage")}
          style={[styles.lang, { color: th(darkMode, dc.muted, "#6e869a"), backgroundColor: th(darkMode, dc.subtle, "#f5f8fd"), alignSelf: isRtl ? "flex-end" : "flex-start" }]}
        >
          {getLanguageDisplayLabel(postLang, t)}
        </Text>
      ) : null}

      {post.tags?.length > 0 && (
        <View style={styles.tags}>
          {post.tags.map((t, idx) => (
            <Text key={idx} style={[styles.tag, { color: th(darkMode, dc.textSecondary, "#6e869a"), backgroundColor: th(darkMode, dc.subtle, "#f5f8fd") }]}>#{t}</Text>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={[styles.actions, { borderTopColor: th(darkMode, dc.border, "#e2e8f0") }]}>
        <TouchableOpacity onPress={() => react("LIKE")} style={styles.actionBtn}>
          <Text style={[styles.actionIcon, { color: th(darkMode, dc.textSecondary, "#6e869a") }, reaction === "LIKE" && styles.actionLiked]}>
            👍 {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => react("DISLIKE")} style={styles.actionBtn}>
          <Text style={[styles.actionIcon, { color: th(darkMode, dc.textSecondary, "#6e869a") }, reaction === "DISLIKE" && styles.actionDisliked]}>
            👎 {dislikesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleToggleSave} style={styles.actionBtn}>
          <Text style={[styles.actionIcon, { color: th(darkMode, dc.textSecondary, "#6e869a") }, isSaved && styles.actionSaved]}>
            {isSaved ? "📂" : "💾"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openArticle} style={styles.actionBtn} disabled={!post.articleUrl}>
          <Text style={[styles.actionIcon, { color: th(darkMode, dc.textSecondary, "#6e869a") }, !post.articleUrl && { opacity: 0.4 }]}>🔗</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowComments(true)} style={styles.actionBtn}>
          <Text style={[styles.actionIcon, { color: th(darkMode, dc.textSecondary, "#6e869a") }]}>💬</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (onAskAI) onAskAI(post);
          }}
          style={styles.actionBtn}
        >
          <Text style={[styles.actionIcon, { color: th(darkMode, dc.textSecondary, "#6e869a") }]}>🤖</Text>
        </TouchableOpacity>
      </View>

      <PostCommentsModal
        post={post}
        visible={showComments}
        onClose={() => setShowComments(false)}
      />

      <GuestSignupPrompt
        visible={!!guestPrompt}
        action={guestPrompt === "like" ? "like or dislike posts" : "save articles"}
        onClose={() => setGuestPrompt(null)}
        onGoToLogin={(mode) => { setShowComments(false); navigation?.navigate("Auth", { mode }); }}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(11,26,43,0.06), 0 1px 2px rgba(11,26,43,0.04)",
    elevation: 2,
    padding: 20,
  },
  categoryLine: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 4,
    height: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  categoryBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.06,
  },
  time: {
    fontSize: 13,
    color: "#6e869a",
    fontWeight: "500",
    flexShrink: 0,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#bfdbfe",
  },
  authorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#bfdbfe",
  },
  authorAvatarLetter: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563eb",
  },
  authorInfo: {
    gap: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  authorLink: {
    fontSize: 12,
    color: "#3b82f6",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: 8,
    color: "#0b1a2b",
  },
  text: {
    color: "#3d5468",
    lineHeight: 24,
    fontSize: 15,
  },
  showMore: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  translateBtn: { marginTop: 6, marginBottom: 4 },
  translateText: { fontSize: 13, fontWeight: "600" },
  lang: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.04,
    color: "#6e869a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#f5f8fd",
    borderRadius: 6,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tag: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6e869a",
    backgroundColor: "#f5f8fd",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    overflow: "hidden",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  actionIcon: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6e869a",
  },  // dark mode via inline
  actionLiked: {
    color: "#2563eb",
  },  // always stays blue
  actionDisliked: {
    color: "#ef4444",
  },
  actionSaved: {
    color: "#7c3aed",
  },
  mediaGrid1: {
    marginTop: 14,
    borderRadius: 10,
    overflow: "hidden",
  },
  mediaItem1: {
    width: "100%",
    height: 280,
    borderRadius: 8,
    backgroundColor: "#f5f8fd",
  },
  mediaGrid2: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    borderRadius: 8,
    overflow: "hidden",
  },
  mediaItem2: {
    flex: 1,
    height: 200,
    borderRadius: 6,
    backgroundColor: "#f5f8fd",
  },
  mediaGrid3: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    borderRadius: 8,
    overflow: "hidden",
  },
  mediaItem3: {
    flex: 1,
    height: 200,
    borderRadius: 6,
    backgroundColor: "#f5f8fd",
  },
  mediaOverlayWrapper: {
    flex: 1,
    position: "relative",
  },
  mediaOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaOverlayText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
});