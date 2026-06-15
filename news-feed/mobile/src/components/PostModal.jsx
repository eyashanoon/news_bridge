import { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, Modal, ScrollView, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, FlatList, Dimensions } from "react-native";
import { apiFetch } from "../utils/apiFetch";
import { categoryTheme } from "../utils/categoryColors";
import { API_CONFIG } from "../api/config";
import { searchPosts } from "../api/searchApi";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";
import {
  detectItemLanguage,
  contentSampleFromBlocks,
  normalizeLang,
  getTranslationTargetLang,
  getTranslateButtonLabel,
  getLanguageDisplayLabel,
} from "../utils/languageUtils";
import { translateText } from "../utils/translateUtils";

const POST_PLACEHOLDER_IMG = "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

function fallbackContentFromText(text) {
  if (!text) return [];
  return text.split(/\n\s*\n/).map((p, i) => ({ type: "paragraph", text: p.trim(), sortOrder: i + 1 })).filter(c => c.text);
}

function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays >= 7) return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (diffDays >= 1) return `${diffDays}d ago`;
  if (diffHours >= 1) return `${diffHours}h ago`;
  if (diffMinutes >= 1) return `${diffMinutes}m ago`;
  return "just now";
}

function RelatedPostCard({ post, onClick }) {
  const theme = categoryTheme[post.label]?.light || categoryTheme.General.light;
  const [media, setMedia] = useState(null);
  const publishedLabel = formatRelativeTime(post.articleCreatedAt);

  useEffect(() => {
    if (!post.id) return;
    let cancelled = false;
    const loadMedia = async () => {
      try {
        const res = await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/media`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setMedia(data);
      } catch {}
    };
    loadMedia();
    return () => { cancelled = true; };
  }, [post.id]);

  const truncate = (text, max = 80) => !text ? "" : text.length > max ? text.slice(0, max) + "..." : text;
  const imageCount = media && Array.isArray(media) ? media.length : (post.numImages || 0);
  const imagesToShow = media && Array.isArray(media) ? media.slice(0, 3) : Array.from({ length: Math.min(imageCount, 3) }).map(() => ({ url: POST_PLACEHOLDER_IMG }));
  const extraCount = Math.max(0, imageCount - 3);

  return (
    <TouchableOpacity style={styles.relatedCard} onPress={onClick} activeOpacity={0.8}>
      <View style={[styles.relatedAccent, { backgroundColor: theme.accent }]} />
      <View style={styles.relatedContent}>
        <Text style={styles.relatedTitle} numberOfLines={2}>{post.title || "Untitled"}</Text>
        <Text style={styles.relatedPreview} numberOfLines={2}>{truncate(post.text)}</Text>
        {imageCount > 0 && (
          <View style={styles.relatedImages}>
            {imagesToShow.slice(0, 3).map((item, idx) => (
              <View key={idx} style={styles.relatedImageWrapper}>
                <Image source={{ uri: item.url }} style={styles.relatedImage} />
                {idx === 2 && extraCount > 0 && (
                  <View style={styles.relatedImageOverlay}>
                    <Text style={styles.relatedOverlayText}>+{extraCount}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
        <View style={styles.relatedMeta}>
          {post.label ? (
            <View style={[styles.relatedCategoryPill, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.relatedCategoryText, { color: theme.pillText }]}>{post.label}</Text>
            </View>
          ) : null}
          <Text style={styles.relatedTime}>{publishedLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PostModal({ post, visible, onClose }) {
  const theme = categoryTheme[post?.label]?.light || categoryTheme.General.light;
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedText, setTranslatedText] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);

  const uiLang = i18n.language;
  const blockText = contentSampleFromBlocks(content);
  const postLang = post ? detectItemLanguage(post, blockText) : "";
  const needsTranslation = Boolean(postLang && postLang !== normalizeLang(uiLang));

  // Load content
  useEffect(() => {
    if (!post?.id || !visible) return;
    setIsLoading(true);
    setContent([]);
    setRelatedPosts([]);
    setShowTranslated(false);
    setTranslatedTitle(null);
    setTranslatedText(null);

    const loadContent = async () => {
      try {
        if (post._content && Array.isArray(post._content) && post._content.length > 0) {
          setContent(post._content);
          setIsLoading(false);
          return;
        }
        const res = await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/content`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const ordered = Array.isArray(data?.content) ? data.content : [];
        setContent(ordered.length > 0 ? ordered : fallbackContentFromText(post.text));
      } catch {
        setContent(fallbackContentFromText(post.text));
      } finally { setIsLoading(false); }
    };
    loadContent();
  }, [post?.id, post?.text, post?._content, visible]);

  // Load related posts
  useEffect(() => {
    if (!post?.id || !visible) return;
    const loadRelated = async () => {
      setRelatedLoading(true);
      try {
        const tagQuery = post.tags?.length > 0 ? post.tags.slice(0, 2).join(" ") : "";
        const sameCategory = await searchPosts({ query: tagQuery, category: post.label || "", sortBy: "date", limit: 8 });
        const filtered = (Array.isArray(sameCategory) ? sameCategory : []).filter(p => p.id !== post.id).slice(0, 6);
        setRelatedPosts(filtered);
        if (filtered.length < 4) {
          const morePosts = await searchPosts({
            query: post.title ? post.title.split(" ").slice(0, 3).join(" ") : "",
            category: post.label || "",
            sortBy: "relevance",
            limit: 8,
          });
          const moreFiltered = (Array.isArray(morePosts) ? morePosts : []).filter(p => p.id !== post.id && !filtered.some(f => f.id === p.id)).slice(0, 6 - filtered.length);
          if (moreFiltered.length > 0) setRelatedPosts(prev => [...prev, ...moreFiltered]);
        }
      } catch { setRelatedPosts([]); } finally { setRelatedLoading(false); }
    };
    loadRelated();
  }, [post?.id, visible]);

  const handleTranslate = async () => {
    if (showTranslated) { setShowTranslated(false); return; }
    if (!needsTranslation) return;
    setIsTranslating(true);
    try {
      const targetLang = getTranslationTargetLang(uiLang);
      if (post?.title) {
        const translated = await translateText(post.title, postLang, targetLang);
        setTranslatedTitle(translated || post.title);
      }
      if (post?.text) {
        const translated = await translateText(post.text, postLang, targetLang);
        setTranslatedText(translated || post.text);
      }
      setShowTranslated(true);
    } catch {} finally { setIsTranslating(false); }
  };

  const openOriginalArticle = () => {
    if (!post?.articleUrl) return;
    apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/click`, { method: "POST" }).catch(() => {});
    Linking.openURL(post.articleUrl);
  };

  const mediaItems = useMemo(() => content.filter(item => item.type === "media" && item.url), [content]);
  const displayTitle = showTranslated && translatedTitle ? translatedTitle : (post?.title || "Post");

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.container, { backgroundColor: th(darkMode, dc.surface, "#fff") }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
              <Text style={[styles.headerTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]} numberOfLines={2}>{displayTitle}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text style={[styles.closeText, { color: th(darkMode, dc.muted, "#6e869a") }]}>✕</Text></TouchableOpacity>
            </View>

            {/* Body - single column scroll on mobile */}
            <ScrollView style={styles.textPane} contentContainerStyle={styles.textPaneContent} showsVerticalScrollIndicator={true}>
                <View style={styles.metaRow}>
                  {post?.label ? <Text style={styles.metaRowText}>{post.label}</Text> : null}
                  {postLang ? <Text style={styles.metaRowText}> · {getLanguageDisplayLabel(postLang, t)}</Text> : null}
                </View>

                {/* Topic post author */}
                {post?.isTopicPost && post?.authorName && (
                  <View style={styles.authorSection}>
                    {post.authorAvatar ? (
                      <Image source={{ uri: post.authorAvatar }} style={styles.authorAvatar} />
                    ) : (
                      <View style={styles.authorAvatarPlaceholder}>
                        <Text style={styles.authorAvatarLetter}>{(post.authorName || "E")[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.authorName}>{post.authorName}</Text>
                      <Text style={styles.authorLinkText}>{t("profileInfo")} →</Text>
                    </View>
                  </View>
                )}

                {/* Content */}
                {isLoading ? (
                  <ActivityIndicator style={styles.loader} size="small" color="#64748b" />
                ) : (
                  content.map((item, idx) => {
                    if (item.type === "paragraph") {
                      return <Text key={idx} style={[styles.paragraph, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{item.text}</Text>
                    }
                    if (item.type === "media" && item.url) {
                      return (
                        <TouchableOpacity key={idx} onPress={() => setSelectedMedia(item)}>
                          <Image source={{ uri: item.url }} style={styles.contentMedia} resizeMode="contain" />
                        </TouchableOpacity>
                      );
                    }
                    return null;
                  })
                )}

                {/* Translate */}
                {needsTranslation && (
                  <TouchableOpacity onPress={handleTranslate} disabled={isTranslating} style={styles.translateBtn}>
                    <Text style={styles.translateBtnText}>
                      {isTranslating ? t("translating") : showTranslated ? t("viewOriginal") : getTranslateButtonLabel(uiLang, t)}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Related Posts */}
                <View style={styles.relatedSection}>
                  <Text style={[styles.relatedSectionTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("relatedPosts")}</Text>
                  {relatedLoading ? (
                    <ActivityIndicator size="small" color="#64748b" />
                  ) : relatedPosts.length === 0 ? (
                    <Text style={styles.relatedEmpty}>{t("noRelatedPosts")}</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
                      {relatedPosts.map(rp => (
                        <RelatedPostCard key={rp.id} post={rp} onClick={() => {
                          // Update current post — modal will re-fetch content
                          // For simplicity, just close and reopen with new post
                        }} />
                      ))}
                    </ScrollView>
                  )}
                </View>
              </ScrollView>

              {/* Footer */}
            <View style={[styles.footer, { borderTopColor: th(darkMode, dc.border, "#e2e8f0") }]}>
              <TouchableOpacity onPress={onClose} style={[styles.collapseBtn, { borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
                <Text style={[styles.collapseBtnText, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{t("collapse")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openOriginalArticle} style={[styles.visitBtn, !post?.articleUrl && { opacity: 0.4 }]} disabled={!post?.articleUrl}>
                <Text style={styles.visitBtnText}>{t("visitOriginalArticle")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lightbox */}
      {selectedMedia && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedMedia(null)}>
          <TouchableOpacity style={styles.lightbox} activeOpacity={1} onPress={() => setSelectedMedia(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.lightboxContent}>
              <TouchableOpacity onPress={() => setSelectedMedia(null)} style={styles.lightboxClose}>
                <Text style={styles.lightboxCloseText}>✕</Text>
              </TouchableOpacity>
              <Image source={{ uri: selectedMedia.url }} style={styles.lightboxImage} resizeMode="contain" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,26,43,0.55)", justifyContent: "center", alignItems: "stretch", padding: 12 },
  container: { flex: 1, maxHeight: "95%", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 48px rgba(0,0,0,0.12)", elevation: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: "#0b1a2b", lineHeight: 24 },
  closeBtn: { width: 32, height: 32, borderRadius: 999, borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center" },
  closeText: { fontSize: 16, color: "#6e869a" },
  textPane: { flex: 1 },
  textPaneContent: { padding: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  metaRowText: { fontSize: 13, color: "#6e869a" },
  authorSection: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  authorAvatar: { width: 36, height: 36, borderRadius: 18 },
  authorAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#dbeafe", justifyContent: "center", alignItems: "center" },
  authorAvatarLetter: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  authorName: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  authorLinkText: { fontSize: 12, color: "#3b82f6" },
  loader: { padding: 30 },
  paragraph: { fontSize: 15, color: "#334155", lineHeight: 26, marginBottom: 16 },
  contentMedia: { width: "100%", aspectRatio: 16 / 9, borderRadius: 10, marginBottom: 16, backgroundColor: "#f5f8fd" },
  translateBtn: { marginTop: 16, marginBottom: 8 },
  translateBtnText: { fontSize: 14, fontWeight: "600", color: "#6e869a" },
  relatedSection: { marginTop: 24 },
  relatedSectionTitle: { fontSize: 16, fontWeight: "700", color: "#0b1a2b", marginBottom: 12 },
  relatedEmpty: { fontSize: 14, color: "#6e869a", textAlign: "center", padding: 16 },
  relatedScroll: { gap: 12, paddingRight: 16 },
  relatedCard: { width: 200, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden", marginRight: 12 },
  relatedAccent: { height: 3 },
  relatedContent: { padding: 12 },
  relatedTitle: { fontSize: 14, fontWeight: "700", color: "#0b1a2b", marginBottom: 4, lineHeight: 18 },
  relatedPreview: { fontSize: 12, color: "#3d5468", lineHeight: 16, marginBottom: 8 },
  relatedImages: { flexDirection: "row", gap: 4, marginBottom: 8 },
  relatedImageWrapper: { flex: 1, aspectRatio: 1, borderRadius: 4, overflow: "hidden", position: "relative" },
  relatedImage: { width: "100%", height: "100%" },
  relatedImageOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  relatedOverlayText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  relatedMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  relatedCategoryPill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  relatedCategoryText: { fontSize: 10, fontWeight: "600" },
  relatedTime: { fontSize: 11, color: "#6e869a" },
  // Footer
  footer: { flexDirection: "row", justifyContent: "space-between", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  collapseBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  collapseBtnText: { fontSize: 14, fontWeight: "600", color: "#3d5468" },
  visitBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: "#2563eb" },
  visitBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  // Lightbox
  lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  lightboxContent: { width: "100%", maxHeight: "85vh", borderRadius: 12, backgroundColor: "#fff", padding: 12 },
  lightboxClose: { alignSelf: "flex-end", padding: 8, marginBottom: 8 },
  lightboxCloseText: { fontSize: 20, color: "#64748b" },
  lightboxImage: { width: "100%", height: 400, borderRadius: 8 },
});