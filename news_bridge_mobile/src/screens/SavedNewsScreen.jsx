// SavedNewsScreen.jsx — Full-featured saved news screen for mobile (port of SavedNews.jsx)
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  StatusBar,
  Linking,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { colors, darkColors } from "../theme/colors";
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

// ─── Helpers ─────────────────────────────────────────────────
function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CATEGORY_COLORS = {
  General: { text: "#6366f1", bg: "#eef2ff" },
  Politics: { text: "#dc2626", bg: "#fef2f2" },
  Sports: { text: "#16a34a", bg: "#f0fdf4" },
  Finance: { text: "#2563eb", bg: "#eff6ff" },
  Medical: { text: "#0891b2", bg: "#ecfeff" },
  Tech: { text: "#7c3aed", bg: "#f5f3ff" },
  Culture: { text: "#d946ef", bg: "#fdf4ff" },
  Religion: { text: "#ca8a04", bg: "#fefce8" },
};

const ICON_OPTIONS = ["📁", "📰", "⭐", "❤️", "🔥", "💡", "📌", "🏷️", "🎯", "📚", "🗂️", "💎"];

// ─── Collection Manager ──────────────────────────────────────
function CollectionManager({
  collections,
  selectedCollection,
  onSelectCollection,
  onRefresh,
  themeColors,
  darkMode,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [showMenuId, setShowMenuId] = useState(null);
  const [newColIcon, setNewColIcon] = useState("📁");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCollection(newName.trim(), newColIcon);
    setNewName("");
    setShowCreate(false);
    onRefresh();
  };

  const handleRename = (id) => {
    if (!editName.trim()) return;
    renameCollection(id, editName.trim());
    setEditingId(null);
    onRefresh();
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Collection", "Are you sure you want to delete this collection?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        deleteCollection(id);
        setShowMenuId(null);
        if (selectedCollection === id) onSelectCollection(null);
        onRefresh();
      }},
    ]);
  };

  return (
    <View style={[styles.colPanel, { borderColor: themeColors.borderLight }]}>
      <View style={styles.colPanelHeader}>
        <Text style={[styles.colPanelTitle, { color: themeColors.text }]}>📂 Collections</Text>
        <TouchableOpacity onPress={() => setShowCreate(!showCreate)} style={styles.colAddBtn}>
          <Text style={styles.colAddBtnText}>➕</Text>
        </TouchableOpacity>
      </View>

      {showCreate && (
        <View style={[styles.createColBox, { backgroundColor: themeColors.bg, borderColor: themeColors.borderLight }]}>
          <View style={styles.iconPicker}>
            {ICON_OPTIONS.map((ico) => (
              <TouchableOpacity
                key={ico}
                onPress={() => setNewColIcon(ico)}
                style={[styles.iconOption, newColIcon === ico && { backgroundColor: themeColors.brand + "20" }]}
              >
                <Text style={styles.iconOptionText}>{ico}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.createRow}>
            <TextInput
              placeholder="Collection name..."
              placeholderTextColor={themeColors.muted}
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={handleCreate}
              style={[styles.createInput, { color: themeColors.text, borderColor: themeColors.borderLight }]}
              autoFocus
            />
            <TouchableOpacity onPress={handleCreate} style={[styles.createBtn, { backgroundColor: themeColors.brand }]}>
              <Text style={styles.createBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={() => onSelectCollection(null)}
        style={[styles.colItem, !selectedCollection && { backgroundColor: themeColors.brand + "15", borderLeftColor: themeColors.brand, borderLeftWidth: 3 }]}
      >
        <Text style={[styles.colItemText, { color: themeColors.text }]}>📦 All Saved</Text>
        <Text style={[styles.colCount, { color: themeColors.muted }]}>{collections.reduce((sum, c) => sum + c.postCount, 0)}</Text>
      </TouchableOpacity>

      {collections.map((col) => (
        <View key={col.id} style={styles.colItemWrapper}>
          {editingId === col.id ? (
            <View style={[styles.renameRow, { borderColor: themeColors.borderLight }]}>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                onSubmitEditing={() => handleRename(col.id)}
                onBlur={() => setEditingId(null)}
                style={[styles.renameInput, { color: themeColors.text, borderColor: themeColors.borderLight }]}
                autoFocus
              />
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => onSelectCollection(col.id)}
              style={[styles.colItem, selectedCollection === col.id && { backgroundColor: themeColors.brand + "15", borderLeftColor: themeColors.brand, borderLeftWidth: 3 }]}
            >
              <Text style={[styles.colItemText, { color: themeColors.text }]}>{col.icon} {col.name}</Text>
              <Text style={[styles.colCount, { color: themeColors.muted }]}>{col.postCount}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.colMenuContainer}>
            <TouchableOpacity
              onPress={() => setShowMenuId(showMenuId === col.id ? null : col.id)}
              style={styles.colMenuTrigger}
            >
              <Text style={[styles.colMenuTriggerText, { color: themeColors.muted }]}>⋯</Text>
            </TouchableOpacity>
            {showMenuId === col.id && (
              <View style={[styles.colMenu, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight, elevation: 5 }]}>
                <TouchableOpacity
                  onPress={() => { setEditName(col.name); setEditingId(col.id); setShowMenuId(null); }}
                  style={styles.colMenuItem}
                >
                  <Text style={[styles.colMenuItemText, { color: themeColors.text }]}>✏️ Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(col.id)} style={styles.colMenuItem}>
                  <Text style={[styles.colMenuItemText, { color: "#dc2626" }]}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Note Editor ────────────────────────────────────────────
function NoteEditor({ postId, themeColors, onUpdate }) {
  const [note, setNoteState] = useState(() => getNote(postId));
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    setNote(postId, note);
    setEditing(false);
    onUpdate?.();
  };

  if (!editing) {
    return (
      <TouchableOpacity onPress={() => setEditing(true)} style={styles.notePreview}>
        {note ? (
          <View style={styles.notePreviewRow}>
            <Text style={[styles.noteText, { color: themeColors.text }]} numberOfLines={1}>📝 {note}</Text>
            <Text style={[styles.noteEditHint, { color: themeColors.muted }]}>✏️</Text>
          </View>
        ) : (
          <Text style={[styles.noteEmpty, { color: themeColors.muted }]}>📝 Add a note...</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.noteEditor, { backgroundColor: themeColors.bg, borderColor: themeColors.borderLight }]}>
      <TextInput
        value={note}
        onChangeText={setNoteState}
        placeholder="Write your thoughts about this article..."
        placeholderTextColor={themeColors.muted}
        multiline
        numberOfLines={3}
        style={[styles.noteTextarea, { color: themeColors.text, borderColor: themeColors.borderLight }]}
        autoFocus
      />
      <View style={styles.noteActions}>
        <TouchableOpacity onPress={handleSave} style={[styles.noteSaveBtn, { backgroundColor: themeColors.brand }]}>
          <Text style={styles.noteSaveBtnText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setNoteState(getNote(postId)); setEditing(false); }} style={styles.noteCancelBtn}>
          <Text style={[styles.noteCancelBtnText, { color: themeColors.muted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Saved Post Card ─────────────────────────────────────────
function SavedPostCard({ post, onUnsave, onOpen, collections, onRefresh, themeColors }) {
  const cColors = CATEGORY_COLORS[post.label] || {};
  const note = getNote(post.id);
  const [showColMenu, setShowColMenu] = useState(false);

  return (
    <TouchableOpacity onPress={() => onOpen(post)} style={[styles.postCard, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
      <View style={styles.postCardTop}>
        <View style={[styles.postCardCat, cColors.text ? { backgroundColor: cColors.text } : {}]}>
          <Text style={[styles.postCardCatText, { color: cColors.text ? "#fff" : themeColors.text }]}>{post.label}</Text>
        </View>
        <Text style={[styles.postCardTime, { color: themeColors.muted }]}>{timeAgo(post.savedAt)}</Text>
      </View>

      {post.title && <Text style={[styles.postCardTitle, { color: themeColors.text }]}>{post.title}</Text>}
      {post.text && <Text style={[styles.postCardText, { color: themeColors.muted }]} numberOfLines={2}>{post.text.slice(0, 120)}...</Text>}

      {/* Collection badges */}
      {post.collections?.length > 0 && (
        <View style={styles.postCardColBadges}>
          {post.collections.map((cId) => {
            const col = collections.find((c) => c.id === cId);
            return col ? (
              <View key={cId} style={[styles.colBadge, { backgroundColor: themeColors.brand + "15" }]}>
                <Text style={[styles.colBadgeText, { color: themeColors.brand }]}>{col.icon} {col.name}</Text>
              </View>
            ) : null;
          })}
        </View>
      )}

      {/* Note preview */}
      {note && <Text style={[styles.postCardNoteLine, { color: themeColors.text }]} numberOfLines={1}>📝 {note.slice(0, 60)}{note.length > 60 ? "..." : ""}</Text>}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <View style={styles.postCardMiniTags}>
          {post.tags.slice(0, 3).map((t, i) => (
            <Text key={i} style={[styles.miniTag, { color: themeColors.brand }]}>#{t}</Text>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.postCardActions}>
        <View style={styles.cardActionGroup}>
          <TouchableOpacity onPress={() => setShowColMenu(!showColMenu)} style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>📂</Text>
          </TouchableOpacity>
          {showColMenu && (
            <View style={[styles.colPickerDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight, elevation: 5 }]}>
              {collections.length === 0 && (
                <Text style={[styles.colPickerEmpty, { color: themeColors.muted }]}>No collections yet</Text>
              )}
              {collections.map((col) => {
                const isInCol = post.collections?.includes(col.id);
                return (
                  <TouchableOpacity
                    key={col.id}
                    onPress={() => {
                      if (isInCol) {
                        removePostFromCollection(post.id, col.id);
                      } else {
                        addPostToCollection(post.id, col.id);
                      }
                      onRefresh();
                      setShowColMenu(false);
                    }}
                    style={[styles.colPickerOption, isInCol && { backgroundColor: themeColors.brand + "10" }]}
                  >
                    <Text style={[styles.colPickerOptionText, { color: themeColors.text }, isInCol && { color: themeColors.brand }]}>
                      {isInCol ? "✓ " : ""}{col.icon} {col.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.cardActionGroup}>
          <NoteEditor postId={post.id} themeColors={themeColors} onUpdate={onRefresh} />
        </View>

        <TouchableOpacity onPress={() => onUnsave(post.id)} style={[styles.actionBtn, styles.actionBtnDanger]}>
          <Text style={styles.actionBtnIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Stats Component ────────────────────────────────────────
function SavedStats({ posts, collections, themeColors }) {
  const avgNoteLength = posts.filter((p) => getNote(p.id)).length;

  const categoryCounts = {};
  posts.forEach((p) => {
    categoryCounts[p.label] = (categoryCounts[p.label] || 0) + 1;
  });
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <View style={styles.statsGrid}>
      <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
        <Text style={styles.statIcon}>📦</Text>
        <Text style={[styles.statValue, { color: themeColors.text }]}>{posts.length}</Text>
        <Text style={[styles.statLabel, { color: themeColors.muted }]}>Total Saved</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
        <Text style={styles.statIcon}>📂</Text>
        <Text style={[styles.statValue, { color: themeColors.text }]}>{collections.length}</Text>
        <Text style={[styles.statLabel, { color: themeColors.muted }]}>Collections</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
        <Text style={styles.statIcon}>📝</Text>
        <Text style={[styles.statValue, { color: themeColors.text }]}>{avgNoteLength}</Text>
        <Text style={[styles.statLabel, { color: themeColors.muted }]}>With Notes</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
        <Text style={styles.statIcon}>{topCategory?.[0] ? "🏷️" : "📭"}</Text>
        <Text style={[styles.statValue, { color: themeColors.text }]}>{topCategory?.[1] || 0}</Text>
        <Text style={[styles.statLabel, { color: themeColors.muted }]}>{topCategory?.[0] || "No posts"}</Text>
      </View>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function SavedNewsScreen({ onClose }) {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const themeColors = darkMode ? darkColors : colors;
  const isArabic = i18n.language === "ar";

  const [savedPosts, setSavedPosts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedTag, setSelectedTag] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  const refreshData = useCallback(() => {
    setCollections(getCollections());
    const posts = getLocalSavedPosts();
    setSavedPosts(posts);
    syncCollectionCounts();
    setCollections(getCollections());
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchSavedPostsFromBackend();
      refreshData();
      setLoading(false);
    };
    load();
  }, [refreshData]);

  const allTags = useMemo(() => getUniqueTagsFromSaved(), [savedPosts]);

  const filteredPosts = useMemo(() => {
    let filtered = [...savedPosts];

    // Filter by collection
    if (selectedCollection) {
      filtered = filtered.filter((p) => (p.collections || []).includes(selectedCollection));
    }

    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter((p) => {
        const tags = (p.tags || []).map((t) => t.toLowerCase());
        return tags.includes(selectedTag.toLowerCase()) || p.label?.toLowerCase() === selectedTag.toLowerCase();
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.text || "").toLowerCase().includes(q) ||
        (p.label || "").toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
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
    refreshData();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={[styles.loadingText, { color: themeColors.muted }]}>Loading your saved news...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg, direction: isArabic ? "rtl" : "ltr", writingDirection: isArabic ? "rtl" : "ltr" }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: darkMode ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)", borderBottomColor: themeColors.borderLight }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={[styles.backBtn, { borderColor: themeColors.borderLight }]}>
              <Text style={[styles.backBtnText, { color: themeColors.text }]}>←</Text>
            </TouchableOpacity>
            <View>
              <Text style={[styles.headerTitle, { color: themeColors.text }]}>💾 Saved News</Text>
              <Text style={[styles.headerSubtitle, { color: themeColors.muted }]}>
                {savedPosts.length} {savedPosts.length === 1 ? "article" : "articles"} saved
                {selectedCollection && collections.find((c) => c.id === selectedCollection)
                  ? ` in "${collections.find((c) => c.id === selectedCollection)?.name}"`
                  : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowStats(!showStats)}
            style={[styles.statsBtn, showStats && { backgroundColor: themeColors.brand + "20" }]}
          >
            <Text style={styles.statsBtnIcon}>📊</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        {showStats && <SavedStats posts={savedPosts} collections={collections} themeColors={themeColors} />}

        {/* Empty state */}
        {savedPosts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💾</Text>
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No saved articles yet</Text>
            <Text style={[styles.emptyText, { color: themeColors.muted }]}>
              Click the 💾 Save button on any post to save it here for later reading.
            </Text>
            <View style={styles.emptyTips}>
              <Text style={[styles.tip, { color: themeColors.muted }]}>📂 Organize saves into collections</Text>
              <Text style={[styles.tip, { color: themeColors.muted }]}>📝 Add personal notes to articles</Text>
              <Text style={[styles.tip, { color: themeColors.muted }]}>🏷️ Filter by tags and categories</Text>
            </View>
          </View>
        )}

        {savedPosts.length > 0 && (
          <>
            {/* Collection sidebar */}
            <CollectionManager
              collections={collections}
              selectedCollection={selectedCollection}
              onSelectCollection={setSelectedCollection}
              onRefresh={refreshData}
              themeColors={themeColors}
              darkMode={darkMode}
            />

            {/* Tags */}
            {allTags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={[styles.tagsTitle, { color: themeColors.text }]}>🏷️ Tags</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagList}>
                  <TouchableOpacity
                    onPress={() => setSelectedTag(null)}
                    style={[styles.tagPill, !selectedTag && { backgroundColor: themeColors.brand, borderColor: themeColors.brand }]}
                  >
                    <Text style={[styles.tagPillText, { color: !selectedTag ? "#fff" : themeColors.text }]}>All</Text>
                  </TouchableOpacity>
                  {allTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      style={[styles.tagPill, selectedTag === tag && { backgroundColor: themeColors.brand, borderColor: themeColors.brand }]}
                    >
                      <Text style={[styles.tagPillText, { color: selectedTag === tag ? "#fff" : themeColors.text }]}>#{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Search & sort */}
            <View style={styles.toolbar}>
              <View style={[styles.searchBox, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
                <Text style={[styles.searchIcon, { color: themeColors.muted }]}>🔍</Text>
                <TextInput
                  placeholder="Search saved articles..."
                  placeholderTextColor={themeColors.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={[styles.searchInput, { color: themeColors.text }]}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClear}>
                    <Text style={[styles.searchClearText, { color: themeColors.muted }]}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={[styles.sortPicker, { borderColor: themeColors.borderLight }]}>
                <Text style={[styles.sortLabel, { color: themeColors.muted }]}>Sort:</Text>
                {["newest", "oldest", "title", "category"].map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setSortBy(option)}
                    style={[styles.sortOption, sortBy === option && { backgroundColor: themeColors.brand + "15" }]}
                  >
                    <Text style={[styles.sortOptionText, { color: sortBy === option ? themeColors.brand : themeColors.text }]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Posts */}
            {filteredPosts.length === 0 ? (
              <View style={styles.noResults}>
                <Text style={[styles.noResultsText, { color: themeColors.muted }]}>No articles match your filters.</Text>
                <TouchableOpacity
                  onPress={() => { setSearchQuery(""); setSelectedTag(null); setSelectedCollection(null); }}
                  style={[styles.clearFiltersBtn, { backgroundColor: themeColors.brand }]}
                >
                  <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.postsList}>
                {filteredPosts.map((post) => (
                  <SavedPostCard
                    key={post.id}
                    post={post}
                    onUnsave={handleUnsave}
                    onOpen={setSelectedPost}
                    collections={collections}
                    onRefresh={refreshData}
                    themeColors={themeColors}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Post Detail Modal */}
      {selectedPost && (
        <Modal animationType="slide" transparent={false} visible={!!selectedPost} onRequestClose={() => setSelectedPost(null)}>
          <SavedPostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} themeColors={themeColors} darkMode={darkMode} />
        </Modal>
      )}
    </View>
  );
}

// ─── Post Detail Modal (simplified port of PostModal) ──────
function SavedPostDetailModal({ post, onClose, themeColors, darkMode }) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";

  const openOriginalArticle = () => {
    if (!post?.articleUrl) return;
    // On mobile, use Linking.openURL (works on both Android and iOS)
    Linking.openURL(post.articleUrl).catch(() => {
      // Fallback: show alert with URL
      Alert.alert("Open Article", post.articleUrl);
    });
  };

  return (
    <View style={[styles.detailContainer, { backgroundColor: themeColors.bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <View style={[styles.detailHeader, { backgroundColor: darkMode ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)", borderBottomColor: themeColors.borderLight }]}>
        <TouchableOpacity onPress={onClose} style={[styles.backBtn, { borderColor: themeColors.borderLight }]}>
          <Text style={[styles.backBtnText, { color: themeColors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.detailTitle, { color: themeColors.text }]} numberOfLines={1}>{post.title || "Post Details"}</Text>
      </View>

      <ScrollView style={styles.detailBody} contentContainerStyle={styles.detailBodyContent}>
        <View style={[styles.detailMeta, { borderColor: themeColors.borderLight }]}>
          <View style={[styles.detailCatBadge, { backgroundColor: (CATEGORY_COLORS[post.label] || {}).text || themeColors.brand }]}>
            <Text style={styles.detailCatText}>{post.label}</Text>
          </View>
          {post.lang && <Text style={[styles.detailLang, { color: themeColors.muted }]}>{post.lang}</Text>}
        </View>

        {post.title && <Text style={[styles.detailPostTitle, { color: themeColors.text }]}>{post.title}</Text>}

        {post.text && (
          <Text style={[styles.detailText, { color: themeColors.text }]}>{post.text}</Text>
        )}

        {post.tags?.length > 0 && (
          <View style={styles.detailTags}>
            {post.tags.map((t, i) => (
              <Text key={i} style={[styles.detailTag, { color: themeColors.brand }]}>#{t}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={openOriginalArticle}
          disabled={!post.articleUrl}
          style={[styles.visitBtn, { backgroundColor: themeColors.brand, opacity: post.articleUrl ? 1 : 0.4 }]}
        >
          <Text style={styles.visitBtnText}>Visit Original Article</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingText: { marginTop: 12, fontWeight: "600", fontSize: 15 },

  // Header
  header: {
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backBtnText: { fontSize: 18, fontWeight: "600" },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  statsBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statsBtnIcon: { fontSize: 20 },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 40 },

  // Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "600" },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 20, lineHeight: 20 },
  emptyTips: { marginTop: 16, gap: 8 },
  tip: { fontSize: 14 },

  // Collections
  colPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  colPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  colPanelTitle: { fontSize: 16, fontWeight: "700" },
  colAddBtn: { padding: 4 },
  colAddBtnText: { fontSize: 18 },
  createColBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  iconPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  iconOption: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  iconOptionText: { fontSize: 16 },
  createRow: { flexDirection: "row", gap: 8 },
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  createBtn: { borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  colItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  colItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
  colCount: { fontSize: 13, fontWeight: "600" },
  colItemWrapper: { position: "relative" },
  renameRow: { borderWidth: 1, borderRadius: 8, marginVertical: 4, padding: 4 },
  renameInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14 },
  colMenuContainer: { position: "absolute", right: 40, top: 6, zIndex: 10 },
  colMenuTrigger: { padding: 4 },
  colMenuTriggerText: { fontSize: 18, fontWeight: "700" },
  colMenu: {
    position: "absolute",
    right: 0,
    top: 24,
    borderWidth: 1,
    borderRadius: 8,
    padding: 4,
    zIndex: 20,
    minWidth: 120,
  },
  colMenuItem: { paddingVertical: 8, paddingHorizontal: 12 },
  colMenuItemText: { fontSize: 14, fontWeight: "500" },

  // Tags
  tagsSection: { marginBottom: 16 },
  tagsTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  tagList: { flexDirection: "row" },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.2)",
    marginRight: 6,
  },
  tagPillText: { fontSize: 13, fontWeight: "600" },

  // Toolbar
  toolbar: { gap: 8, marginBottom: 16 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  searchClear: { padding: 4 },
  searchClearText: { fontSize: 14, fontWeight: "600" },
  sortPicker: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  sortLabel: { fontSize: 12, fontWeight: "600", marginRight: 4, marginLeft: 8 },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sortOptionText: { fontSize: 13, fontWeight: "600" },

  // Posts
  postsList: { gap: 12 },

  // Post card
  postCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  postCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postCardCat: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  postCardCatText: { fontSize: 12, fontWeight: "700" },
  postCardTime: { fontSize: 12, fontWeight: "500" },
  postCardTitle: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  postCardText: { fontSize: 13, lineHeight: 18 },
  postCardColBadges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  colBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  colBadgeText: { fontSize: 12, fontWeight: "600" },
  postCardNoteLine: { fontSize: 13, fontStyle: "italic" },
  postCardMiniTags: { flexDirection: "row", gap: 8 },
  miniTag: { fontSize: 12, fontWeight: "600" },
  postCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  cardActionGroup: { position: "relative" },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnIcon: { fontSize: 18 },
  actionBtnDanger: { marginLeft: "auto" },

  // Collection picker dropdown
  colPickerDropdown: {
    position: "absolute",
    top: 36,
    left: 0,
    borderWidth: 1,
    borderRadius: 8,
    padding: 4,
    zIndex: 50,
    minWidth: 150,
  },
  colPickerEmpty: { padding: 10, fontSize: 13 },
  colPickerOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  colPickerOptionText: { fontSize: 14, fontWeight: "500" },

  // No results
  noResults: { alignItems: "center", paddingVertical: 30, gap: 10 },
  noResultsText: { fontSize: 15, fontWeight: "600" },
  clearFiltersBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  clearFiltersBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Note
  notePreview: { paddingVertical: 4 },
  notePreviewRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  noteText: { fontSize: 13, flex: 1 },
  noteEditHint: { fontSize: 12 },
  noteEmpty: { fontSize: 13 },
  noteEditor: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 6 },
  noteTextarea: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    textAlignVertical: "top",
    minHeight: 60,
  },
  noteActions: { flexDirection: "row", gap: 8 },
  noteSaveBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  noteSaveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  noteCancelBtn: { padding: 6 },
  noteCancelBtnText: { fontSize: 13, fontWeight: "600" },

  // Detail modal
  detailContainer: { flex: 1 },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  detailTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  detailBody: { flex: 1 },
  detailBodyContent: { padding: 16, gap: 14, paddingBottom: 40 },
  detailMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  detailCatBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  detailCatText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  detailLang: { fontSize: 13, fontWeight: "500" },
  detailPostTitle: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  detailText: { fontSize: 15, lineHeight: 23 },
  detailTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailTag: { fontSize: 14, fontWeight: "600" },
  visitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  visitBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});