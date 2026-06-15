import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from "react-native";
import TopicPost from "../components/TopicPost";
import PostModal from "../components/PostModal";
import { fetchTopicById, fetchTopicPosts, createTopicPost, requestToPost, getMyAssignments, canRequestToPost } from "../api/topicsApi";
import { getToken, getSessionFromToken } from "../utils/auth";
import TopBar from "../components/TopBar";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

export default function TopicDetailsPage({ navigation, route }) {
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { topicId } = route.params;
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostMediaUrl, setNewPostMediaUrl] = useState("");
  const [newPostMediaType, setNewPostMediaType] = useState("image");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [canRequest, setCanRequest] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  const token = getToken();
  const isAuthenticated = !!token;
  const session = token ? getSessionFromToken(token) : null;
  const isEditor = !!(session && session.type === "EDITOR" && (
    session.roles?.includes("PUBLISH_LIVE_NEWS") || session.roles?.includes("EDIT_LIVE_NEWS")
  ));

  const loadTopic = useCallback(async () => {
    const data = await fetchTopicById(topicId);
    setTopic(data);
  }, [topicId]);

  const loadPosts = useCallback(async () => {
    const data = await fetchTopicPosts(topicId);
    setPosts(data);
    setLoading(false);
  }, [topicId]);

  const loadAssignment = useCallback(async () => {
    const assignments = await getMyAssignments();
    const found = (assignments || []).find((a) => a.topicId === topicId);
    setAssignment(found || null);
  }, [topicId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTopic(), loadPosts(), loadAssignment()]);
  }, [loadTopic, loadPosts, loadAssignment]);

  useEffect(() => {
    if (isEditor && topicId && !assignment) {
      canRequestToPost(topicId).then((result) => {
        setCanRequest(result);
      });
    } else if (assignment) {
      setCanRequest({ eligible: true, assignmentStatus: assignment.status });
    }
  }, [isEditor, topicId, assignment]);

  const handleRequestToPost = async () => {
    setRequesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestToPost(topicId);
      setAssignment(result);
      setNotice("Your request has been submitted. Waiting for admin approval.");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to request");
    } finally {
      setRequesting(false);
    }
  };

  const handleSubmitPost = async () => {
    if (!newPostText.trim()) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createTopicPost(topicId, {
        title: newPostTitle.trim() || null,
        text: newPostText.trim(),
        label: "Update",
        lang: "en",
        tags: topic?.tags || [],
        mediaUrl: newPostMediaUrl.trim() || null,
        mediaType: newPostMediaUrl.trim() ? newPostMediaType : null,
      });
      setNewPostTitle("");
      setNewPostText("");
      setNewPostMediaUrl("");
      setNewPostMediaType("image");
      setShowEditor(false);
      setNotice("Post published!");
      await loadPosts();
      await loadTopic();
    } catch (err) {
      setError(err.message || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = assignment && (assignment.status === "APPROVED" || assignment.status === "ASSIGNED");
  const isRequested = assignment && assignment.status === "REQUESTED";
  const isRejected = assignment && assignment.status === "REJECTED";

  const translateField = (name) => {
    return t(`field_${name}`, { defaultValue: name });
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(lang === "ar" ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" });
  };

  if (loading && !topic) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  if (!topic) return null;

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, "#f8fafc"), direction: i18n.language === "ar" ? "rtl" : "ltr" }]}>
      <TopBar navigation={navigation} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
           <Text style={[styles.backBtnText, { color: th(darkMode, dc.accent, "#3b82f6") }]}>← {t("backToTrending")}</Text>
        </TouchableOpacity>

        {/* Hero Section */}
        <View style={styles.hero}>
          {topic.imageUrl && (
            <Image source={{ uri: topic.imageUrl }} style={styles.heroImage} />
          )}
          <Text style={[styles.heroTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{topic.title}</Text>
          {topic.description && (
            <Text style={[styles.heroDesc, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{topic.description}</Text>
          )}
          {topic.author && (
            <Text style={[styles.heroMeta, { color: th(darkMode, dc.muted, "#6e869a") }]}>✍️ {topic.author}</Text>
          )}
          {topic.createdAt && (
            <Text style={[styles.heroMeta, { color: th(darkMode, dc.muted, "#6e869a") }]}>📅 {formatDate(topic.createdAt)}</Text>
          )}
          {topic.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {topic.tags.map((tag, idx) => (
                <View key={idx} style={[styles.tag, { backgroundColor: th(darkMode, dc.subtle, "#f5f8fd") }]}>
                  <Text style={[styles.tagText, { color: th(darkMode, dc.muted, "#6e869a") }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Stats Bar */}
        <View style={[styles.statsBar, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>📝</Text>
            <Text style={[styles.statValue, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{topic.posts || 0}</Text>
             <Text style={[styles.statLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("posts")}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: th(darkMode, dc.border, "#e2e8f0") }]} />
          <View style={styles.stat}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={[styles.statValue, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{topic.contributors || 0}</Text>
             <Text style={[styles.statLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("contributors")}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: th(darkMode, dc.border, "#e2e8f0") }]} />
          <View style={styles.stat}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={[styles.statValue, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{topic.growth || 0}%</Text>
            <Text style={[styles.statLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{lang === "ar" ? "رائج" : "Trending"}</Text>
          </View>
          {topic.fieldNames?.length > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statFields}>
                {topic.fieldNames.map((fn, idx) => (
                  <View key={idx} style={[styles.fieldBadge, { backgroundColor: th(darkMode, dc.subtle, "#f0f9ff") }]}>
                    <Text style={[styles.fieldBadgeText, { color: th(darkMode, dc.textSecondary, "#0284c7") }]}>📌 {translateField(fn)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Editor notices */}
        {isEditor && (
          <View style={styles.editorSection}>
            {topic.status === "DRAFT" && (
              <View style={[styles.noticeCard, { backgroundColor: th(darkMode, dc.subtle, "#fffbeb") }]}>
                 <Text style={[styles.noticeTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>📋 {lang === "ar" ? "وضع مسودة" : "Draft Mode"}</Text>
                 <Text style={[styles.noticeDesc, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{lang === "ar" ? "هذا الموضوع في وضع المسودة. يمكن للمحررين التقدم والموافقة عليه، ولكن النشر متاح فقط بعد نشره من المدير." : "This topic is in DRAFT mode. Editors can apply and be approved, but posting is only possible after an admin publishes it."}</Text>
              </View>
            )}
            {isRejected && (
              <View style={[styles.noticeCard, styles.noticeError, { backgroundColor: th(darkMode, dc.subtle, "#fef2f2") }]}>
                 <Text style={[styles.noticeTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>❌ {lang === "ar" ? "تم رفض طلبك" : "Application Rejected"}</Text>
                 <Text style={[styles.noticeDesc, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{lang === "ar" ? "لا يمكنك النشر في هذا الموضوع. تم رفض طلبك." : "You cannot post to this topic. Your application was rejected."}</Text>
              </View>
            )}
            {isRequested && (
              <View style={[styles.noticeCard, styles.noticeWarning, { backgroundColor: th(darkMode, dc.subtle, "#fffbeb") }]}>
                 <Text style={[styles.noticeTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>⏳ {lang === "ar" ? "قيد المراجعة" : "Pending Approval"}</Text>
                 <Text style={[styles.noticeDesc, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{lang === "ar" ? "طلبك قيد المراجعة. سيقوم المدير بمراجعته قريباً." : "Your application is pending approval. An admin will review your request shortly."}</Text>
              </View>
            )}
            {canPost && topic.status === "ACTIVE" && (
              <View style={[styles.noticeCard, styles.noticeSuccess, { backgroundColor: th(darkMode, dc.subtle, "#f0fdf4") }]}>
                 <Text style={[styles.noticeTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>✅ {lang === "ar" ? "مسموح بالنشر" : "Authorized to Post"}</Text>
                 <Text style={[styles.noticeDesc, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{lang === "ar" ? "أنت مخول لنشر التحديثات في هذا الموضوع." : "You are authorized to post updates in this event."}</Text>
              </View>
            )}
            {canRequest?.eligible === true && !assignment && (
              <View style={[styles.applyCard, { backgroundColor: th(darkMode, dc.subtle, "#f0f9ff"), borderColor: th(darkMode, dc.border, "#bae6fd") }]}>
                 <Text style={[styles.applyText, { color: th(darkMode, dc.textSecondary, "#0369a1") }]}>{lang === "ar" ? "حقولك تتطابق مع هذا الموضوع. هل تريد المساهمة؟" : "Your fields match this event. Would you like to contribute?"}</Text>
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={handleRequestToPost}
                  disabled={requesting}
                >
                   <Text style={styles.applyBtnText}>{requesting ? (lang === "ar" ? "جاري الإرسال..." : "Requesting...") : (lang === "ar" ? "التقدم للنشر" : "Apply to Post")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Write new update */}
        {canPost && topic.status === "ACTIVE" && (
          <View style={styles.writeSection}>
            {!showEditor ? (
              <TouchableOpacity style={[styles.writeTrigger, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={() => setShowEditor(true)}>
                 <Text style={[styles.writeTriggerText, { color: th(darkMode, dc.accent, "#3b82f6") }]}>✍️ {t("writeUpdate")}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.writeCard, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
                <View style={styles.writeHeader}>
                  <Text style={[styles.writeHeaderTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("writeUpdate")}</Text>
                  <TouchableOpacity onPress={() => { setShowEditor(false); setNewPostText(""); setNewPostTitle(""); setNewPostMediaUrl(""); setError(null); setNotice(null); }}>
                    <Text style={[styles.writeClose, { color: th(darkMode, dc.muted, "#94a3b8") }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.writeTitleInput, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                   placeholder={t("postTitleOptional")}
                  placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                  value={newPostTitle}
                  onChangeText={setNewPostTitle}
                  editable={!submitting}
                />

                <TextInput
                  style={[styles.writeTextarea, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                   placeholder={t("shareUpdate")}
                  placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                  value={newPostText}
                  onChangeText={setNewPostText}
                  multiline
                  numberOfLines={4}
                  editable={!submitting}
                />

                <TextInput
                  style={[styles.writeMediaInput, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                   placeholder={t("attachMedia")}
                  placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                  value={newPostMediaUrl}
                  onChangeText={setNewPostMediaUrl}
                  editable={!submitting}
                />

                {error && <Text style={[styles.errorText, { color: th(darkMode, dc.error, "#ef4444") }]}>{error}</Text>}
                {notice && <Text style={[styles.successText, { color: th(darkMode, dc.success, "#22c55e") }]}>{notice}</Text>}

                <View style={styles.writeActions}>
                  <TouchableOpacity
                    style={[styles.publishBtn, (!newPostText.trim() || submitting) && styles.btnDisabled]}
                    onPress={handleSubmitPost}
                    disabled={submitting || !newPostText.trim()}
                  >
                    <Text style={styles.publishBtnText}>{submitting ? t("publishing") : t("publish")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: th(darkMode, dc.border, "#e2e8f0") }]}
                    onPress={() => { setShowEditor(false); setNewPostTitle(""); setNewPostText(""); setNewPostMediaUrl(""); setError(null); setNotice(null); }}
                  >
                    <Text style={[styles.cancelBtnText, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>{t("cancel")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Posts Feed */}
        <View style={styles.postsSection}>
          <View style={styles.postsHeader}>
             <Text style={[styles.postsTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("postsSection")} ({posts.length})</Text>
          </View>

          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
               <Text style={[styles.emptyPostsTitle, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("noPostsYet")}</Text>
               <Text style={[styles.emptyPostsSub, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("beFirstToShare")}</Text>
            </View>
          ) : (
            posts.map((post) => (
              <TopicPost
                key={post.id}
                post={post}
                topic={topic}
                onPress={setSelectedPost}
                onAskAI={(p) => navigation.navigate("AIAssistant", { selectedPost: p, category: "General" })}
              />
            ))
          )}
        </View>
      </ScrollView>

      <PostModal post={selectedPost} visible={!!selectedPost} onClose={() => setSelectedPost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 100 },
  backBtn: { marginBottom: 12 },
  backBtnText: { fontSize: 15, fontWeight: "600" },
  hero: { marginBottom: 16 },
  heroImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  heroDesc: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  heroMeta: { fontSize: 13, marginBottom: 4 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: "500" },
  statsBar: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    flexWrap: "wrap",
    gap: 8,
  },
  stat: { alignItems: "center", minWidth: 60 },
  statIcon: { fontSize: 18, marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  statDivider: { width: 1, marginHorizontal: 4 },
  statFields: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  fieldBadge: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  fieldBadgeText: { fontSize: 11, fontWeight: "600" },
  editorSection: { marginBottom: 16, gap: 10 },
  noticeCard: {
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  noticeError: { borderLeftColor: "#ef4444" },
  noticeWarning: { borderLeftColor: "#f59e0b" },
  noticeSuccess: { borderLeftColor: "#22c55e" },
  noticeTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  noticeDesc: { fontSize: 13, lineHeight: 18 },
  applyCard: {
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
  },
  applyText: { fontSize: 14, marginBottom: 10, lineHeight: 20 },
  applyBtn: {
    backgroundColor: "#0284c7",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  applyBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  writeSection: { marginBottom: 16 },
  writeTrigger: {
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  writeTriggerText: { fontSize: 15, fontWeight: "600" },
  writeCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  writeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  writeHeaderTitle: { fontSize: 16, fontWeight: "700" },
  writeClose: { fontSize: 18, padding: 4 },
  writeTitleInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  writeTextarea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  writeMediaInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  errorText: { fontSize: 13, marginBottom: 8 },
  successText: { fontSize: 13, marginBottom: 8 },
  writeActions: { flexDirection: "row", gap: 10 },
  publishBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  publishBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600" },
  postsSection: { marginTop: 4 },
  postsHeader: { marginBottom: 14 },
  postsTitle: { fontSize: 18, fontWeight: "700" },
  emptyPosts: { alignItems: "center", paddingVertical: 40 },
  emptyPostsTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  emptyPostsSub: { fontSize: 14 },
});