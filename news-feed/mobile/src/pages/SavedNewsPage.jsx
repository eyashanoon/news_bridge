import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import TopBar from "../components/TopBar";
import PostModal from "../components/PostModal";
import { dark as dc, th } from "../utils/darkColors";
import {
  getLocalSavedPosts,
  fetchSavedPostsFromBackend,
  unsavePost,
  getCollections,
  createCollection,
  deleteCollection,
  renameCollection,
  addPostToCollection,
  removePostFromCollection,
  syncCollectionCounts,
  getNote,
  setNote,
  getUniqueTagsFromSaved,
} from "../utils/savedPosts";
import { categoryTheme } from "../utils/categoryColors";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import {
  detectItemLanguage,
  needsTranslation as itemNeedsTranslation,
  getTranslationTargetLang,
  getTranslateButtonLabel,
} from "../utils/languageUtils";
import { translateText } from "../utils/translateUtils";

// ─── Helpers ─────────────────────────────────────────────────
function timeAgo(timestamp, lang) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === "ar" ? "الآن" : "just now";
  if (mins < 60) return lang === "ar" ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === "ar" ? `منذ ${hours} ساعة` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
}

const ICON_OPTIONS = ["📁", "📰", "⭐", "❤️", "🔥", "💡", "📌", "🏷️", "🎯", "📚", "🗂️", "💎"];

// ─── Main Component ──────────────────────────────────────────
export default function SavedNewsPage({ navigation }) {
  const { currentCategory, darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const theme = categoryTheme[currentCategory]?.light || categoryTheme.General.light;

  const [savedPosts, setSavedPosts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedTag, setSelectedTag] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [allTags, setAllTags] = useState([]);

  // Collection manager state
  const [showCreateCol, setShowCreateCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColIcon, setNewColIcon] = useState("📁");
  const [editingColId, setEditingColId] = useState(null);
  const [editColName, setEditColName] = useState("");
  const [showColMenuId, setShowColMenuId] = useState(null);

  // Note editor state per post
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState("");

  // Collection picker for posts
  const [pickerPostId, setPickerPostId] = useState(null);

  const refreshData = useCallback(async () => {
    const cols = await getCollections();
    setCollections(cols);
    const posts = await getLocalSavedPosts();
    setSavedPosts(posts);
    await syncCollectionCounts();
    const cols2 = await getCollections();
    setCollections(cols2);
    const tags = await getUniqueTagsFromSaved();
    setAllTags(tags);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchSavedPostsFromBackend();
      await refreshData();
      setLoading(false);
    };
    load();
  }, [refreshData]);

  const filteredPosts = useMemo(() => {
    let filtered = [...savedPosts];

    if (selectedCollection) {
      filtered = filtered.filter((p) => (p.collections || []).includes(selectedCollection));
    }

    if (selectedTag) {
      filtered = filtered.filter((p) => {
        const tags = (p.tags || []).map((t) => t.toLowerCase());
        return tags.includes(selectedTag.toLowerCase()) || p.label?.toLowerCase() === selectedTag.toLowerCase();
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.text || "").toLowerCase().includes(q) ||
        (p.label || "").toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      if (sortBy === "newest") return (b.savedAt || 0) - (a.savedAt || 0);
      if (sortBy === "oldest") return (a.savedAt || 0) - (b.savedAt || 0);
      if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "category") return (a.label || "").localeCompare(b.label || "");
      return 0;
    });

    return filtered;
  }, [savedPosts, selectedCollection, selectedTag, searchQuery, sortBy]);

  const handleUnsave = async (postId) => {
    await unsavePost(postId);
    await refreshData();
  };

  // ─── Loading ─────────────────────────────────────────────
  const isRtl = i18n.language === "ar";

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={[styles.loadingText, { color: th(darkMode, dc.muted, "#6e869a") }]}>{lang === "ar" ? "جاري تحميل المقالات المحفوظة..." : "Loading saved articles..."}</Text>
        </View>
      </View>
    );
  }

  // ─── Empty state ──────────────────────────────────────────
  if (savedPosts.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
           <Text style={[styles.pageTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("savedNews")}</Text>
           <View style={styles.emptyContainer}>
             <Text style={styles.emptyIcon}>💾</Text>
             <Text style={[styles.emptyTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("noSavedPosts")}</Text>
             <Text style={[styles.emptyDesc, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("howToSave")}</Text>
             <View style={styles.tipsContainer}>
               <Text style={[styles.tipItem, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>{lang === "ar" ? "📂 نظم المنشورات في مجموعات" : "📂 Organize saves into collections"}</Text>
               <Text style={[styles.tipItem, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>{lang === "ar" ? "📝 أضف ملاحظات شخصية للمقالات" : "📝 Add personal notes to articles"}</Text>
               <Text style={[styles.tipItem, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>{lang === "ar" ? "🏷️ صفي حسب الوسوم والتصنيفات" : "🏷️ Filter by tags and categories"}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  const totalPosts = savedPosts.length;
  const colName = selectedCollection ? collections.find((c) => c.id === selectedCollection)?.name : null;

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
      <TopBar navigation={navigation} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
             <Text style={[styles.pageTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("savedNews")}</Text>
             <Text style={[styles.pageSubtitle, { color: th(darkMode, dc.muted, "#6e869a") }]}>
               {totalPosts} {totalPosts === 1 ? t("article") : t("article", { defaultValue: "articles" })} {t("saved")}{colName ? ` ${t("inCollection")} "${colName}"` : ""}
            </Text>
          </View>
          <TouchableOpacity style={[styles.statsBtn, { borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={() => setShowStats(!showStats)}>
             <Text style={[styles.statsBtnText, { color: th(darkMode, dc.textSecondary, "#64748b") }, showStats && { backgroundColor: th(darkMode, dc.subtle, "#eff6ff"), borderColor: "#3b82f6", color: "#2563eb" }]}>📊 {lang === "ar" ? "الإحصائيات" : "Stats"}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {showStats && (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
              <Text style={styles.statIcon}>📦</Text>
              <Text style={[styles.statValue, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{totalPosts}</Text>
               <Text style={[styles.statLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("totalSaved")}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
              <Text style={styles.statIcon}>📂</Text>
              <Text style={[styles.statValue, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{collections.length}</Text>
               <Text style={[styles.statLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("collections")}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
              <Text style={styles.statIcon}>📝</Text>
              <Text style={[styles.statValue, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{savedPosts.filter((p) => p.note).length}</Text>
               <Text style={[styles.statLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("withNotes")}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
              <Text style={styles.statIcon}>🏷️</Text>
              <Text style={[styles.statValue, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{allTags.length}</Text>
               <Text style={[styles.statLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{lang === "ar" ? "الوسوم" : "Tags"}</Text>
            </View>
          </View>
        )}

        {/* ─── Collections Panel ─────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
             <Text style={[styles.sectionTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("collections")}</Text>
            <TouchableOpacity onPress={() => setShowCreateCol(!showCreateCol)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>➕</Text>
            </TouchableOpacity>
          </View>

          {showCreateCol && (
            <View style={[styles.createColBox, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
              <View style={styles.iconPickerRow}>
                {ICON_OPTIONS.map((ico) => (
                  <TouchableOpacity key={ico} style={[styles.iconPickerBtn, { borderColor: th(darkMode, dc.border, "#e2e8f0") }, newColIcon === ico && styles.iconPickerBtnActive]} onPress={() => setNewColIcon(ico)}>
                    <Text style={styles.iconPickerText}>{ico}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.createColRow}>
                <TextInput
                  style={[styles.colInput, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                   placeholder={t("collectionNamePlaceholder")}
                  placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                  value={newColName}
                  onChangeText={setNewColName}
                  onSubmitEditing={async () => {
                    if (!newColName.trim()) return;
                    await createCollection(newColName.trim(), newColIcon);
                    setNewColName("");
                    setShowCreateCol(false);
                    await refreshData();
                  }}
                />
                <TouchableOpacity
                  style={styles.colCreateBtn}
                  onPress={async () => {
                    if (!newColName.trim()) return;
                    await createCollection(newColName.trim(), newColIcon);
                    setNewColName("");
                    setShowCreateCol(false);
                    await refreshData();
                  }}
                >
                   <Text style={styles.colCreateBtnText}>{t("create")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* All Saved */}
          <TouchableOpacity
            style={[styles.colItem, !selectedCollection && { backgroundColor: th(darkMode, dc.subtle, "#eff6ff") }]}
            onPress={() => setSelectedCollection(null)}
          >
             <Text style={[styles.colItemText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("allSaved")}</Text>
            <Text style={[styles.colItemCount, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{totalPosts}</Text>
          </TouchableOpacity>

          {collections.map((col) => (
            <View key={col.id}>
              {editingColId === col.id ? (
                <View style={styles.renameRow}>
                  <TextInput
                    style={[styles.colInput, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                    value={editColName}
                    onChangeText={setEditColName}
                    onSubmitEditing={async () => {
                      if (!editColName.trim()) return;
                      await renameCollection(col.id, editColName.trim());
                      setEditingColId(null);
                      await refreshData();
                    }}
                    autoFocus
                    onBlur={async () => {
                      if (editColName.trim() && editColName !== col.name) {
                        await renameCollection(col.id, editColName.trim());
                        await refreshData();
                      }
                      setEditingColId(null);
                    }}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.colItem, selectedCollection === col.id && { backgroundColor: th(darkMode, dc.subtle, "#eff6ff") }]}
                  onPress={() => setSelectedCollection(col.id)}
                >
                  <Text style={[styles.colItemText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{col.icon} {col.name}</Text>
                  <View style={styles.colItemRight}>
                    <Text style={[styles.colItemCount, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{col.postCount}</Text>
                    <TouchableOpacity style={styles.colMenuBtn} onPress={() => setShowColMenuId(showColMenuId === col.id ? null : col.id)}>
                      <Text style={[styles.colMenuBtnText, { color: th(darkMode, dc.muted, "#94a3b8") }]}>⋯</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
              {showColMenuId === col.id && editingColId !== col.id && (
                <View style={[styles.colMenuDropdown, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
                  <TouchableOpacity style={styles.colMenuItem} onPress={() => {
                    setEditColName(col.name);
                    setEditingColId(col.id);
                    setShowColMenuId(null);
                  }}>
                    <Text style={[styles.colMenuItemText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>✏️ {t("rename")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.colMenuItem, styles.colMenuDanger]} onPress={async () => {
                    setShowColMenuId(null);
                    if (selectedCollection === col.id) setSelectedCollection(null);
                    await deleteCollection(col.id);
                    await refreshData();
                  }}>
                     <Text style={[styles.colMenuItemText, styles.dangerText]}>🗑️ {t("delete")}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* ─── Tags Section ─────────────────────────────── */}
        {allTags.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{lang === "ar" ? "🏷️ الوسوم" : "🏷️ Tags"}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
              <TouchableOpacity
                style={[styles.tagPill, { backgroundColor: th(darkMode, dc.subtle, "#f5f8fd") }, !selectedTag && { backgroundColor: "#2563eb" }]}
                onPress={() => setSelectedTag(null)}
              >
                 <Text style={[styles.tagPillText, { color: th(darkMode, dc.textSecondary, "#6e869a") }, !selectedTag && { color: "#fff" }]}>{t("all")}</Text>
              </TouchableOpacity>
              {allTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagPill, { backgroundColor: th(darkMode, dc.subtle, "#f5f8fd") }, selectedTag === tag && { backgroundColor: "#2563eb" }]}
                  onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  <Text style={[styles.tagPillText, { color: th(darkMode, dc.textSecondary, "#6e869a") }, selectedTag === tag && { color: "#fff" }]}>#{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── Search & Sort ────────────────────────────── */}
        <View style={styles.toolbar}>
          <View style={[styles.searchBar, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: th(darkMode, dc.text, "#0b1a2b") }]}
               placeholder={lang === "ar" ? "ابحث في المقالات المحفوظة..." : "Search saved articles..."}
              placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text style={[styles.searchClear, { color: th(darkMode, dc.muted, "#94a3b8") }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.sortRow}>
            {["newest", "oldest", "title", "category"].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.sortBtn, { backgroundColor: th(darkMode, dc.subtle, "#f5f8fd") }, sortBy === opt && { backgroundColor: "#2563eb" }]}
                onPress={() => setSortBy(opt)}
              >
                <Text style={[styles.sortBtnText, { color: th(darkMode, dc.textSecondary, "#6e869a") }, sortBy === opt && { color: "#fff" }]}>
                   {opt === "newest" ? t("newestFirst") : opt === "oldest" ? t("oldestFirst") : opt === "title" ? t("byTitle") : t("byCategory")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Posts ──────────────────────────────────────── */}
        {filteredPosts.length === 0 ? (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("noArticlesMatch")}</Text>
            <TouchableOpacity style={styles.clearFiltersBtn} onPress={() => { setSearchQuery(""); setSelectedTag(null); setSelectedCollection(null); }}>
              <Text style={styles.clearFiltersBtnText}>{t("clearFilters")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredPosts.map((post) => (
            <SavedPostCard
              key={post.id}
              post={post}
              collections={collections}
              onUnsave={handleUnsave}
              onOpen={setSelectedPost}
              pickerPostId={pickerPostId}
              setPickerPostId={setPickerPostId}
              editingNoteId={editingNoteId}
              setEditingNoteId={setEditingNoteId}
              noteText={noteText}
              setNoteText={setNoteText}
              refreshData={refreshData}
              darkMode={darkMode}
              lang={lang}
            />
          ))
        )}
      </ScrollView>

      <PostModal post={selectedPost} visible={!!selectedPost} onClose={() => setSelectedPost(null)} />
    </View>
  );
}

// ─── SavedPostCard ───────────────────────────────────────────
function SavedPostCard({ post, collections, onUnsave, onOpen, pickerPostId, setPickerPostId, editingNoteId, setEditingNoteId, noteText, setNoteText, refreshData, darkMode, lang }) {
  const { t } = useTranslation();
  const [localNote, setLocalNote] = useState(post.note || "");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedText, setTranslatedText] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const postLang = detectItemLanguage(post);
  const needsTranslation = itemNeedsTranslation(post, lang);
  const colors = categoryTheme[post.label]?.light || categoryTheme.General.light;
  const isEditingNote = editingNoteId === post.id;
  const isPickerOpen = pickerPostId === post.id;

  const handleTranslate = async (e) => {
    e?.stopPropagation?.();
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (!needsTranslation) return;
    setIsTranslating(true);
    try {
      const targetLang = getTranslationTargetLang(lang);
      if (post.title) {
        setTranslatedTitle(await translateText(post.title, postLang, targetLang) || post.title);
      }
      if (post.text) {
        setTranslatedText(await translateText(post.text, postLang, targetLang) || post.text);
      }
      setShowTranslated(true);
    } finally {
      setIsTranslating(false);
    }
  };

  const displayTitle = showTranslated && translatedTitle ? translatedTitle : post.title;
  const displayText = showTranslated && translatedText ? translatedText : (post.text || "");

  return (
    <TouchableOpacity activeOpacity={0.85} style={[styles.card, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={() => onOpen(post)}>
      {/* Top row */}
      <View style={styles.cardTopRow}>
        <View style={[styles.cardCatBadge, { backgroundColor: colors.pillBg }]}>
          <Text style={[styles.cardCatText, { color: colors.pillText }]}>{t(`category_${post.label}`, { defaultValue: post.label })}</Text>
        </View>
        <Text style={[styles.cardTime, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{timeAgo(post.savedAt, lang)}</Text>
      </View>

      {/* Topic context banner */}
      {post.isTopicPost && post.topicTitle && (
        <View style={[styles.topicBanner, { backgroundColor: th(darkMode, dc.subtle, "#f0f9ff"), borderColor: th(darkMode, dc.border, "#e0f2fe") }]}>
          <Text style={[styles.topicBannerLabel, { color: th(darkMode, dc.textSecondary, "#0284c7") }]}>{lang === "ar" ? "📰 موضوع" : "📰 Topic"}</Text>
          <Text style={[styles.topicBannerName, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{post.topicTitle}</Text>
          {post.topicDescription ? (
            <Text style={[styles.topicBannerDesc, { color: th(darkMode, dc.textSecondary, "#6e869a") }]} numberOfLines={2}>{post.topicDescription}</Text>
          ) : null}
          {post.topicTags?.length > 0 && (
            <View style={styles.topicTagsRow}>
              {post.topicTags.slice(0, 3).map((t, i) => (
                <Text key={i} style={[styles.topicTag, { color: th(darkMode, dc.muted, "#6e869a"), backgroundColor: th(darkMode, dc.surface, "#fff") }]}>#{t}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Title & text */}
      {displayTitle ? <Text style={[styles.cardTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{displayTitle}</Text> : null}
      {displayText ? <Text style={[styles.cardText, { color: th(darkMode, dc.textSecondary, "#3d5468") }]} numberOfLines={3}>{displayText}</Text> : null}

      {needsTranslation && (
        <TouchableOpacity onPress={handleTranslate} disabled={isTranslating}>
          <Text style={[styles.translateBtn, { color: th(darkMode, dc.muted, "#64748b") }]}>
            {isTranslating ? t("translating") : showTranslated ? t("viewOriginal") : getTranslateButtonLabel(lang, t)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Editor info */}
      {post.isTopicPost && post.authorName && (
        <View style={styles.authorRow}>
          <Text style={styles.authorIcon}>✍️</Text>
          <Text style={[styles.authorName, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{post.authorName}</Text>
        </View>
      )}

      {/* Collection badges */}
      {post.collections?.length > 0 && (
        <View style={styles.colBadgesRow}>
          {post.collections.map((cId) => {
            const col = collections.find((c) => c.id === cId);
            return col ? (
              <View key={cId} style={[styles.colBadge, { backgroundColor: th(darkMode, dc.subtle, "#f5f8fd") }]}>
                <Text style={[styles.colBadgeText, { color: th(darkMode, dc.muted, "#6e869a") }]}>{col.icon} {col.name}</Text>
              </View>
            ) : null;
          })}
        </View>
      )}

      {/* Note preview / editor */}
      {isEditingNote ? (
        <View style={[styles.noteEditorBox, { backgroundColor: th(darkMode, dc.subtle, "#fffbeb") }]}>
          <TextInput
            style={[styles.noteInput, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#fbbf24"), color: th(darkMode, dc.text, "#92400e") }]}
            value={noteText}
            onChangeText={setNoteText}
            placeholder={lang === "ar" ? "اكتب أفكارك حول هذه المقالة..." : "Write your thoughts about this article..."}
            placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
            multiline
            numberOfLines={3}
            autoFocus
          />
          <View style={styles.noteActions}>
            <TouchableOpacity style={styles.noteSaveBtn} onPress={async () => {
              await setNote(post.id, noteText);
              setEditingNoteId(null);
              await refreshData();
            }}>
              <Text style={styles.noteSaveBtnText}>{t("save")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.noteCancelBtn, { borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={() => setEditingNoteId(null)}>
              <Text style={[styles.noteCancelBtnText, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : post.note ? (
        <TouchableOpacity style={[styles.notePreview, { backgroundColor: th(darkMode, dc.subtle, "#fffbeb") }]} onPress={() => {
          setEditingNoteId(post.id);
          setNoteText(post.note);
        }}>
          <Text style={[styles.notePreviewText, { color: th(darkMode, dc.textSecondary, "#92400e") }]}>📝 {post.note.length > 60 ? post.note.slice(0, 60) + "..." : post.note}</Text>
          <Text style={styles.noteEditIcon}>✏️</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.notePreviewEmpty} onPress={() => {
          setEditingNoteId(post.id);
          setNoteText("");
        }}>
          <Text style={[styles.notePreviewTextEmpty, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{lang === "ar" ? "📝 أضف ملاحظة..." : "📝 Add a note..."}</Text>
        </TouchableOpacity>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <View style={styles.tagsRow}>
          {post.tags.slice(0, 4).map((t, i) => (
            <Text key={i} style={[styles.miniTag, { color: th(darkMode, dc.muted, "#6e869a"), backgroundColor: th(darkMode, dc.subtle, "#f5f8fd") }]}>#{t}</Text>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={[styles.cardActions, { borderTopColor: th(darkMode, dc.border, "#f1f5f9") }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={(e) => {
          e.stopPropagation?.();
          setPickerPostId(isPickerOpen ? null : post.id);
        }}>
          <Text style={styles.actionBtnText}>📂</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={(e) => {
          e.stopPropagation?.();
          setEditingNoteId(post.id);
          setNoteText(post.note || "");
        }}>
          <Text style={styles.actionBtnText}>📝</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={() => onUnsave(post.id)}>
          <Text style={styles.actionBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {/* Collection picker dropdown */}
      {isPickerOpen && (
        <View style={[styles.colPickerDropdown, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
          {collections.length === 0 && <Text style={[styles.colPickerEmpty, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("noCollectionsYet")}</Text>}
          {collections.map((col) => {
            const isInCol = post.collections?.includes(col.id);
            return (
              <TouchableOpacity key={col.id} style={[styles.colPickOption, isInCol && { backgroundColor: th(darkMode, dc.subtle, "#eff6ff") }]} onPress={async () => {
                if (isInCol) {
                  await removePostFromCollection(post.id, col.id);
                } else {
                  await addPostToCollection(post.id, col.id);
                }
                setPickerPostId(null);
                await refreshData();
              }}>
                <Text style={[styles.colPickOptionText, { color: th(darkMode, dc.textSecondary, "#334155") }, isInCol && { color: "#2563eb", fontWeight: "600" }]}>
                  {isInCol ? "✓ " : ""}{col.icon} {col.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 15 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerLeft: { flex: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  pageSubtitle: { fontSize: 14 },
  statsBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  statsBtnText: { fontSize: 14, fontWeight: "600" },

  // Empty
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptyDesc: { fontSize: 15, textAlign: "center", marginBottom: 24, paddingHorizontal: 20 },
  tipsContainer: { gap: 8 },
  tipItem: { fontSize: 14 },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minWidth: "45%", borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1 },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 2 },

  // Section
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 18 },

  // Create collection
  createColBox: { borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1 },
  iconPickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  iconPickerBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  iconPickerBtnActive: { backgroundColor: "#eff6ff", borderColor: "#3b82f6" },
  iconPickerText: { fontSize: 18 },
  createColRow: { flexDirection: "row", gap: 8 },
  colInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  colCreateBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  colCreateBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  renameRow: { marginBottom: 4 },

  // Collection items
  colItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 2 },
  colItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
  colItemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  colItemCount: { fontSize: 13, fontWeight: "600" },
  colMenuBtn: { padding: 4 },
  colMenuBtnText: { fontSize: 16 },
  colMenuDropdown: { borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, marginLeft: 20 },
  colMenuItem: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  colMenuDanger: {},
  colMenuItemText: { fontSize: 14, fontWeight: "500" },
  dangerText: { color: "#ef4444" },

  // Tags
  tagsScroll: { marginBottom: 4 },
  tagPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9999, marginRight: 8 },
  tagPillText: { fontSize: 13, fontWeight: "600" },

  // Toolbar
  toolbar: { marginBottom: 14 },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, marginBottom: 8 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  searchClear: { fontSize: 16, padding: 4 },
  sortRow: { flexDirection: "row", gap: 8 },
  sortBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 9999 },
  sortBtnText: { fontSize: 13, fontWeight: "600" },

  // No results
  noResults: { alignItems: "center", paddingVertical: 40 },
  noResultsText: { fontSize: 15, marginBottom: 12 },
  clearFiltersBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  clearFiltersBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // ─── Card ────────────────────────────────────────────────
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 14, padding: 16, elevation: 2, boxShadow: "0 1px 3px rgba(11,26,43,0.06)" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardCatBadge: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 },
  cardCatText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.06 },
  cardTime: { fontSize: 12 },
  topicBanner: { borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1 },
  topicBannerLabel: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  topicBannerName: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  topicBannerDesc: { fontSize: 12, lineHeight: 16 },
  topicTagsRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  topicTag: { fontSize: 11, fontWeight: "500", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, overflow: "hidden" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  cardText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  translateBtn: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  authorIcon: { fontSize: 14 },
  authorName: { fontSize: 13, fontWeight: "600" },
  colBadgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  colBadge: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 },
  colBadgeText: { fontSize: 12, fontWeight: "500" },
  notePreview: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  notePreviewEmpty: { marginBottom: 8, paddingVertical: 6, paddingHorizontal: 10 },
  notePreviewText: { fontSize: 13, flex: 1 },
  noteEditIcon: { fontSize: 14 },
  notePreviewTextEmpty: { fontSize: 13 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  miniTag: { fontSize: 12, fontWeight: "500", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999, overflow: "hidden" },

  // Note editor
  noteEditorBox: { borderRadius: 8, padding: 10, marginBottom: 8 },
  noteInput: { borderWidth: 1, borderRadius: 6, padding: 10, fontSize: 14, minHeight: 80, textAlignVertical: "top", marginBottom: 8 },
  noteActions: { flexDirection: "row", gap: 8 },
  noteSaveBtn: { backgroundColor: "#2563eb", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16 },
  noteSaveBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  noteCancelBtn: { borderWidth: 1, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  noteCancelBtnText: { fontSize: 13, fontWeight: "600" },

  // Card actions
  cardActions: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 9999 },
  actionDanger: {},
  actionBtnText: { fontSize: 16 },

  // Collection picker
  colPickerDropdown: { borderRadius: 8, padding: 8, marginTop: 8, borderWidth: 1 },
  colPickerEmpty: { fontSize: 13, padding: 10, textAlign: "center" },
  colPickOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  colPickOptionText: { fontSize: 14, fontWeight: "500" },
});