import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions } from "react-native";
import TopBar from "../components/TopBar";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";
import { aiFetch } from "../utils/aiFetch";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { getUserId } from "../utils/userId";
import { getPostById } from "../api/searchApi";
import PostModal from "../components/PostModal";

const MAX_SUMMARY_LENGTH = 200;
const SCREEN_WIDTH = Dimensions.get("window").width;

function mapFeedPost(post, idx) {
  return {
    postId: post.id,
    id: post.id,
    title: post.title,
    text: post.text,
    label: post.label,
    articleCreatedAt: post.articleCreatedAt,
    imageUrls: post.imageUrls || [],
    score: Math.max(0.3, 1 - idx * 0.05),
    components: { recency: 0.8, importance: 0.7, preference: 0.5 },
  };
}

function buildFallbackBrief(feedPosts, isArabic) {
  if (!feedPosts.length) {
    return isArabic ? "لا توجد أخبار متاحة حالياً." : "No stories available right now.";
  }
  const header = isArabic ? "**ملخص الأخبار**\n\n" : "**News Highlights**\n\n";
  const lines = feedPosts
    .slice(0, 5)
    .map((p) => `• ${p.title || p.text?.slice(0, 100) || "Story"}`);
  return header + lines.join("\n");
}

export default function NewsBriefPage({ navigation }) {
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";
  const isArabic = lang === "ar" || lang.startsWith("ar");

  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [langVersion, setLangVersion] = useState(0);
  const loadingRef = useRef(false);

  const fetchBrief = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      await ensureUserInitialized();
      const userId = (await getUserId()) || "android-app-anonymous";

      let data = null;
      try {
        const res = await aiFetch("/news-brief", {
          method: "POST",
          headers: {
            "X-User-Id": userId,
            "X-Generate-Summary": "true",
            "X-Language": lang,
          },
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // AI service unavailable — fall back below
      }

      if (!data || data.status !== "SUCCESS") {
        const fallbackRes = await apiFetch("/api/feed/brief?limit=10");
        if (!fallbackRes.ok) {
          throw new Error(`News brief request failed: ${fallbackRes.status}`);
        }
        const feedPosts = await fallbackRes.json();
        setBrief(buildFallbackBrief(Array.isArray(feedPosts) ? feedPosts : [], isArabic));
        setPosts((Array.isArray(feedPosts) ? feedPosts : []).map(mapFeedPost));
        return;
      }

      setBrief(data.brief || t("newsBriefNoSummary", "No summary generated."));
      setPosts(data.posts || []);
    } catch (err) {
      console.error("News brief fetch error:", err);
      setError(t("newsBriefError", "Unable to load news brief. The AI service may be unavailable."));
      setBrief(null);
      setPosts([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [lang, isArabic, t]);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief, langVersion]);

  useEffect(() => {
    const onLanguageChanged = () => setLangVersion((v) => v + 1);
    i18n.on("languageChanged", onLanguageChanged);
    return () => i18n.off("languageChanged", onLanguageChanged);
  }, [i18n]);

  const handleRefresh = () => {
    setLangVersion((v) => v + 1);
  };

  const handleOpenPost = async (post) => {
    const postId = post.postId || post.id;
    if (postId) {
      const fullPost = await getPostById(postId);
      if (fullPost) {
        setSelectedPost(fullPost);
        return;
      }
    }
    setSelectedPost({ ...post, id: postId });
  };

  const handleWatchWithPresenter = () => {
    navigation.navigate("Presenter", { posts, brief });
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    try {
      const date = new Date(isoStr.replace("Z", "+00:00").replace(" ", "T"));
      const now = new Date();
      const diffMs = now - date;
      const diffMin = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMin < 1) return isArabic ? "الآن" : "just now";
      if (diffMin < 60) return isArabic ? `منذ ${diffMin} د` : `${diffMin}m ago`;
      if (diffHrs < 24) return isArabic ? `منذ ${diffHrs} س` : `${diffHrs}h ago`;
      if (diffDays < 7) return isArabic ? `منذ ${diffDays} ي` : `${diffDays}d ago`;

      return date.toLocaleDateString(isArabic ? "ar-SA" : undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const scoreColor = (score) => {
    const pct = Math.min(100, Math.max(0, (score || 0) * 100));
    return pct > 70 ? "#22c55e" : pct > 40 ? "#eab308" : "#64748b";
  };

  const renderBriefSummary = () => {
    if (!brief) return null;
    return (
      <View style={styles.briefSummary}>
        {brief.split("\n").map((line, i) => {
          if (line.startsWith("**") && line.endsWith("**")) {
            return (
              <Text key={i} style={[styles.briefHeadline, { color: th(darkMode, dc.text, "#0b1a2b") }]}>
                {line.replace(/\*\*/g, "")}
              </Text>
            );
          }
          if (line.trim() === "") {
            return <View key={i} style={styles.briefSpacer} />;
          }
          return (
            <Text key={i} style={[styles.briefLine, { color: th(darkMode, dc.textSecondary, "#334155") }]}>
              {line}
            </Text>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, "#f8fafc"), direction: isArabic ? "rtl" : "ltr" }]}>
      <TopBar navigation={navigation} />

      <View style={[styles.header, { backgroundColor: th(darkMode, dc.surface, "#ffffff"), borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>📺</Text>
          <View>
            <Text style={[styles.headerTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>
              {t("newsBrief", "Hourly News Brief")}
            </Text>
            <Text style={[styles.headerSubtitle, { color: th(darkMode, dc.muted, "#6e869a") }]}>
              {posts.length > 0
                ? isArabic
                  ? `${posts.length} قصص رئيسية`
                  : `${posts.length} top stories`
                : t("newsBriefLatest", "Latest updates")}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {loading && (
            <Text style={[styles.updatingText, { color: th(darkMode, dc.muted, "#64748b") }]}>
              {t("newsBriefUpdating", "Updating...")}
            </Text>
          )}
          <TouchableOpacity onPress={handleRefresh} disabled={loading} style={styles.refreshBtn}>
            <Text style={styles.refreshIcon}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={[styles.loadingText, { color: th(darkMode, dc.muted, "#64748b") }]}>
              {t("newsBriefGenerating", "Generating your news brief...")}
            </Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorState}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={[styles.errorText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>
              {error}
            </Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>{t("retry", "Retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && brief ? (
          <View style={[styles.briefCard, { backgroundColor: th(darkMode, dc.surface, "#ffffff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
            {renderBriefSummary()}
          </View>
        ) : null}

        {!loading && posts.length > 0 && (
          <View style={styles.postsSection}>
            <Text style={[styles.postsSectionTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>
              {isArabic ? "القصص في هذا الموجز" : "Stories in this brief"}
            </Text>
            {posts.map((post, idx) => {
              const summaryText = post.text || post.content || "";
              const truncated = summaryText.length > MAX_SUMMARY_LENGTH
                ? summaryText.slice(0, MAX_SUMMARY_LENGTH) + "…"
                : summaryText;

              return (
                <View
                  key={post.postId || post.id || idx}
                  style={[styles.postCard, { backgroundColor: th(darkMode, dc.surface, "#ffffff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}
                >
                  <View style={[styles.rankBadge, { backgroundColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
                    <Text style={[styles.rankText, { color: th(darkMode, dc.text, "#0b1a2b") }]}>#{idx + 1}</Text>
                  </View>

                  <View style={styles.postInfo}>
                    <TouchableOpacity onPress={() => handleOpenPost(post)}>
                      <Text style={[styles.postTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>
                        {post.title || (isArabic ? "قصة بدون عنوان" : "Untitled Story")}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.postMeta, { direction: isArabic ? "rtl" : "ltr" }]}>
                      {post.label ? (
                        <Text style={[styles.postLabel, { color: th(darkMode, dc.muted, "#6e869a") }]}>
                          {post.label}
                        </Text>
                      ) : null}
                      <Text style={[styles.postTime, { color: th(darkMode, dc.muted, "#94a3b8") }]}>
                        {formatTime(post.articleCreatedAt)}
                      </Text>
                    </View>

                    {truncated ? (
                      <Text style={[styles.postSummary, { color: th(darkMode, dc.textSecondary, "#475569") }]} numberOfLines={4}>
                        {truncated}
                      </Text>
                    ) : null}

                    {post.imageUrls && post.imageUrls.length > 0 && (
                      <View style={[styles.imagesRow, { direction: isArabic ? "rtl" : "ltr" }]}>
                        {post.imageUrls.slice(0, 3).map((url, i) => (
                          <Image
                            key={i}
                            source={{ uri: url }}
                            style={[styles.postImage, { borderColor: th(darkMode, dc.border, "#e2e8f0") }]}
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    )}

                    <View style={[styles.refsRow, { direction: isArabic ? "rtl" : "ltr" }]}>
                      <Text style={[styles.refLabel, { color: th(darkMode, dc.muted, "#6e869a") }]}>
                        {isArabic ? "المراجع" : "References"}:
                      </Text>
                      <Text style={[styles.refValue, { color: th(darkMode, dc.text, "#0b1a2b") }]}>
                        {isArabic ? "النتيجة" : "Score"}: {post.score?.toFixed(2)}
                      </Text>
                      <Text style={[styles.refValue, { color: th(darkMode, dc.textSecondary, "#475569") }]}>
                        R:{post.components?.recency?.toFixed(2)}
                      </Text>
                      <Text style={[styles.refValue, { color: th(darkMode, dc.textSecondary, "#475569") }]}>
                        I:{post.components?.importance?.toFixed(2)}
                      </Text>
                      <Text style={[styles.refValue, { color: th(darkMode, dc.textSecondary, "#475569") }]}>
                        P:{post.components?.preference?.toFixed(2)}
                      </Text>
                    </View>

                    <View style={[styles.scoreBarBg, { backgroundColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
                      <View
                        style={[
                          styles.scoreBarFill,
                          {
                            width: `${Math.min(100, Math.max(0, (post.score || 0) * 100))}%`,
                            backgroundColor: scoreColor(post.score),
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!loading && !error && !brief && posts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: th(darkMode, dc.muted, "#64748b") }]}>
              {t("newsBriefEmpty", "No news stories available for the brief right now.")}
            </Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>{isArabic ? "تحقق مرة أخرى" : "Check again"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {posts.length > 0 && (
        <View style={[styles.presenterFloatingBtnContainer, { direction: "ltr" }]}>
          <TouchableOpacity onPress={handleWatchWithPresenter} style={styles.presenterFloatingBtn} activeOpacity={0.8}>
            <Text style={styles.presenterFloatingIcon}>🎙️</Text>
            <View style={styles.presenterFloatingTextContainer}>
              <Text style={styles.presenterFloatingTitle}>
                {isArabic ? "شاهد مع المقدم" : "Watch with Presenter"}
              </Text>
              <Text style={styles.presenterFloatingSubtitle}>
                {isArabic ? `عرض ${posts.length} قصة` : `Present ${posts.length} stories`}
              </Text>
            </View>
            <Text style={styles.presenterFloatingArrow}>▶</Text>
          </TouchableOpacity>
        </View>
      )}

      <PostModal post={selectedPost} visible={!!selectedPost} onClose={() => setSelectedPost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { fontSize: 24 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  updatingText: { fontSize: 12 },
  refreshBtn: { padding: 6 },
  refreshIcon: { fontSize: 18 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  loadingState: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorState: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 16 },
  errorIcon: { fontSize: 32 },
  errorText: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  briefCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  briefSummary: {},
  briefHeadline: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  briefLine: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  briefSpacer: { height: 8 },
  postsSection: {},
  postsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  postCard: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  rankText: { fontSize: 13, fontWeight: "700" },
  postInfo: { flex: 1 },
  postTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  postLabel: { fontSize: 12, fontWeight: "500" },
  postTime: { fontSize: 12 },
  postSummary: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 8,
  },
  imagesRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  postImage: {
    width: (SCREEN_WIDTH - 100) / 3,
    height: ((SCREEN_WIDTH - 100) / 3) * 0.66,
    borderRadius: 8,
    borderWidth: 1,
  },
  refsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  refLabel: { fontSize: 11, fontWeight: "600" },
  refValue: { fontSize: 11, fontWeight: "500" },
  scoreBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, textAlign: "center", marginBottom: 16, paddingHorizontal: 20 },
  presenterFloatingBtnContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },
  presenterFloatingBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4a4aff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#4a4aff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  presenterFloatingIcon: { fontSize: 24, marginRight: 10 },
  presenterFloatingTextContainer: { flex: 1 },
  presenterFloatingTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  presenterFloatingSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 },
  presenterFloatingArrow: { color: "#fff", fontSize: 16, marginLeft: 8 },
});
