// SavedNews.jsx — Full-featured saved news page with collections, notes, stats, and more
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { categoryColors, categoryTheme } from "../utils/categoryColors";
import { useTheme } from "../context/ThemeContext";
import {
  detectItemLanguage,
  needsTranslation as itemNeedsTranslation,
  getTranslationTargetLang,
  getTranslateButtonLabel,
} from "../utils/languageUtils";
import { translateText } from "../utils/translateUtils";
import PostModal from "./PostModal";

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

// ─── Sub-Components ─────────────────────────────────────────

function CollectionManager({ collections, selectedCollection, onSelectCollection, onRefresh }) {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [showMenuId, setShowMenuId] = useState(null);
  const [newColIcon, setNewColIcon] = useState("📁");

  const iconOptions = ["📁", "📰", "⭐", "❤️", "🔥", "💡", "📌", "🏷️", "🎯", "📚", "🗂️", "💎"];

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createCollection(newName.trim(), newColIcon);
    setNewName("");
    setShowCreate(false);
    onRefresh();
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    await renameCollection(id, editName.trim());
    setEditingId(null);
    onRefresh();
  };

  const handleDelete = async (id) => {
    await deleteCollection(id);
    setShowMenuId(null);
    if (selectedCollection === id) onSelectCollection(null);
    onRefresh();
  };

  return (
    <div className="saved-collections-panel">
      <div className="saved-collections-header">
        <h3>📂 {t("collections")}</h3>
        <button className="saved-btn-icon" onClick={() => setShowCreate(!showCreate)} title={t("newCollection")}>
          ➕
        </button>
      </div>

      {showCreate && (
        <div className="saved-create-collection">
          <div className="saved-icon-picker">
            {iconOptions.map((ico) => (
              <button
                key={ico}
                className={`saved-ico-btn ${ico === newColIcon ? "active" : ""}`}
                onClick={() => setNewColIcon(ico)}
              >
                {ico}
              </button>
            ))}
          </div>
          <div className="saved-create-row">
            <input
              type="text"
              placeholder={t("collectionNamePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <button className="saved-btn-sm saved-btn-primary" onClick={handleCreate}>
              {t("create")}
            </button>
          </div>
        </div>
      )}

      <button
        className={`saved-col-item ${!selectedCollection ? "active" : ""}`}
        onClick={() => onSelectCollection(null)}
      >
        <span>📦 {t("allSaved")}</span>
        <span className="saved-col-count">
          {collections.reduce((sum, c) => sum + c.postCount, 0)}
        </span>
      </button>

      {collections.map((col) => (
        <div key={col.id} className="saved-col-item-wrapper">
          {editingId === col.id ? (
            <div className="saved-rename-row">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename(col.id)}
                autoFocus
                onBlur={() => setEditingId(null)}
              />
            </div>
          ) : (
            <button
              className={`saved-col-item ${selectedCollection === col.id ? "active" : ""}`}
              onClick={() => onSelectCollection(col.id)}
            >
              <span>{col.icon} {col.name}</span>
              <span className="saved-col-count">{col.postCount}</span>
            </button>
          )}

          <div className="saved-col-menu-container">
            <button
              className="saved-col-menu-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenuId(showMenuId === col.id ? null : col.id);
              }}
            >
              ⋯
            </button>
            {showMenuId === col.id && (
              <div className="saved-col-menu">
                <button
                  onClick={() => {
                    setEditName(col.name);
                    setEditingId(col.id);
                    setShowMenuId(null);
                  }}
                >
                  ✏️ {t("rename")}
                </button>
                <button className="danger" onClick={() => handleDelete(col.id)}>
                  🗑️ {t("delete")}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function NoteEditor({ postId, onUpdate }) {
  const { t } = useTranslation();
  const [note, setNoteState] = useState(() => getNote(postId));
  const [editing, setEditing] = useState(false);

  const handleSave = async () => {
    await setNote(postId, note);
    setEditing(false);
    onUpdate?.();
  };

  if (!editing) {
    return (
      <div className="saved-note-preview" onClick={() => setEditing(true)}>
        {note ? (
          <>
            <span className="saved-note-text">📝 {note}</span>
            <button className="saved-btn-icon-sm" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
              ✏️
            </button>
          </>
        ) : (
          <span className="saved-note-empty">📝 {t("addNote")}</span>
        )}
      </div>
    );
  }

  return (
    <div className="saved-note-editor">
      <textarea
        value={note}
        onChange={(e) => setNoteState(e.target.value)}
        placeholder={t("writeYourThoughts")}
        rows={3}
        autoFocus
      />
      <div className="saved-note-actions">
        <button className="saved-btn-sm saved-btn-primary" onClick={handleSave}>{t("save")}</button>
        <button className="saved-btn-sm" onClick={() => { setNoteState(getNote(postId)); setEditing(false); }}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

function SavedPostCard({ post, onUnsave, onOpen, collectionId, collections, onAddToCollection, onRemoveFromCollection }) {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const postTheme = categoryTheme[post.label]?.[darkMode ? "dark" : "light"] || categoryTheme.General[darkMode ? "dark" : "light"];
  const note = getNote(post.id);
  const [showColMenu, setShowColMenu] = useState(false);

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedText, setTranslatedText] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);

  const lang = i18n.language;
  const postLang = detectItemLanguage(post);
  const needsTranslation = itemNeedsTranslation(post, lang);

  const handleTranslate = async (e) => {
    e.stopPropagation();
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (!needsTranslation) return;
    setIsTranslating(true);
    try {
      const targetLang = getTranslationTargetLang(lang);
      if (post.title) {
        const tOut = await translateText(post.title, postLang, targetLang);
        setTranslatedTitle(tOut || post.title);
      }
      if (post.text) {
        const tOut = await translateText(post.text, postLang, targetLang);
        setTranslatedText(tOut || post.text);
      }
      setShowTranslated(true);
    } catch (err) {
      console.error("Translation error:", err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const displayTitle = showTranslated && translatedTitle ? translatedTitle : post.title;
  const displayText = showTranslated && translatedText ? translatedText : (post.text || "");

  return (
    <div
      className="saved-post-card"
      onClick={() => onOpen(post)}
      style={{
        background: postTheme.surface,
        borderColor: postTheme.border,
      }}
    >
      <div className="saved-post-card-top">
        <span
          className="saved-post-cat"
          style={{ background: postTheme.pillBg, color: postTheme.pillText }}
        >
          {t(`category_${post.label}`, post.label)}
        </span>
        <span className="saved-post-time">{timeAgo(post.savedAt)}</span>
      </div>

      {/* Topic context banner for topic posts */}
      {post.isTopicPost && post.topicTitle && (
        <div className="saved-post-topic-context">
          <span className="saved-post-topic-label">📰 {t("topic")}</span>
          <span className="saved-post-topic-name">{post.topicTitle}</span>
          {post.topicDescription && (
            <p className="saved-post-topic-desc">{post.topicDescription.slice(0, 80)}{post.topicDescription.length > 80 ? "..." : ""}</p>
          )}
          {post.topicTags?.length > 0 && (
            <div className="saved-post-topic-tags">
              {post.topicTags.slice(0, 3).map((tg, i) => (
                <span key={i} className="saved-post-topic-tag">#{tg}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {displayTitle && <h4 className="saved-post-title">{displayTitle}</h4>}
      {displayText && <p className="saved-post-text">{displayText.slice(0, 120)}...</p>}

      {/* Translate link — translates full text */}
      {needsTranslation && (
        <button
          className="saved-translate-btn"
          onClick={handleTranslate}
          disabled={isTranslating}
        >
          {isTranslating
            ? t("translating")
            : showTranslated
              ? t("viewOriginal")
              : getTranslateButtonLabel(lang, t)}
        </button>
      )}

      {/* Editor info for topic posts */}
      {post.isTopicPost && post.authorName && (
        <div className="saved-post-author-info">
          <span className="saved-post-author-icon">✍️</span>
          <span className="saved-post-author-name">{post.authorName}</span>
        </div>
      )}

      {/* Collection badges */}
      {post.collections?.length > 0 && (
        <div className="saved-post-col-badges">
          {post.collections.map((cId) => {
            const col = collections.find((c) => c.id === cId);
            return col ? (
              <span key={cId} className="saved-col-badge">
                {col.icon} {col.name}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Note preview */}
      {note && <div className="saved-post-note-line">📝 {note.slice(0, 60)}{note.length > 60 ? "..." : ""}</div>}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="saved-post-mini-tags">
          {post.tags.slice(0, 3).map((tg, i) => (
            <span key={i} className="saved-mini-tag">#{tg}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="saved-post-card-actions" onClick={(e) => e.stopPropagation()}>
        <div className="saved-card-action-group">
          <button
            className="saved-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowColMenu(!showColMenu);
            }}
            title={t("addToCollection")}
          >
            📂
          </button>
          {showColMenu && (
            <div className="saved-col-picker-dropdown">
              {collections.length === 0 && <div className="saved-col-picker-empty">{t("noCollectionsYet")}</div>}
              {collections.map((col) => {
                const isInCol = post.collections?.includes(col.id);
                return (
                  <button
                    key={col.id}
                    className={`saved-col-pick-option ${isInCol ? "active" : ""}`}
                    onClick={async () => {
                      if (isInCol) {
                        await removePostFromCollection(post.id, col.id);
                        onRemoveFromCollection?.();
                      } else {
                        await addPostToCollection(post.id, col.id);
                        onAddToCollection?.();
                      }
                      setShowColMenu(false);
                    }}
                  >
                    {isInCol ? "✓ " : ""}{col.icon} {col.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="saved-card-action-group">
          <NoteEditor postId={post.id} />
        </div>

        <button
          className="saved-action-btn danger"
          onClick={() => onUnsave(post.id)}
          title={t("removeFromSaved")}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ─── Stats Component ────────────────────────────────────────
function SavedStats({ posts, collections }) {
  const { t } = useTranslation();
  const avgNoteLength = posts.filter((p) => getNote(p.id)).length;

  const categoryCounts = {};
  posts.forEach((p) => {
    categoryCounts[p.label] = (categoryCounts[p.label] || 0) + 1;
  });
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="saved-stats-grid">
      <div className="saved-stat-card">
        <span className="saved-stat-icon">📦</span>
        <span className="saved-stat-value">{posts.length}</span>
        <span className="saved-stat-label">{t("totalSaved")}</span>
      </div>
      <div className="saved-stat-card">
        <span className="saved-stat-icon">📂</span>
        <span className="saved-stat-value">{collections.length}</span>
        <span className="saved-stat-label">{t("collections")}</span>
      </div>
      <div className="saved-stat-card">
        <span className="saved-stat-icon">📝</span>
        <span className="saved-stat-value">{avgNoteLength}</span>
        <span className="saved-stat-label">{t("withNotes")}</span>
      </div>
      <div className="saved-stat-card">
        <span className="saved-stat-icon">{topCategory?.[0] ? "🏷️" : "📭"}</span>
        <span className="saved-stat-value">{topCategory?.[1] || 0}</span>
        <span className="saved-stat-label">{topCategory?.[0] || t("all")}</span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function SavedNews() {
  const { t } = useTranslation();
  const [savedPosts, setSavedPosts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedTag, setSelectedTag] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  const refreshData = useCallback(async () => {
    setCollections(getCollections());
    const posts = getLocalSavedPosts();
    setSavedPosts(posts);
    await syncCollectionCounts();
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
        const tags = (p.tags || []).map((tg) => tg.toLowerCase());
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
        (p.tags || []).some((tg) => tg.toLowerCase().includes(q))
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

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedTag(null);
    setSelectedCollection(null);
  };

  if (loading) {
    return (
      <div className="saved-loading">
        <div className="saved-loading-spinner">🔄</div>
        <p>{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="saved-page">
      {/* Header */}
      <div className="saved-header">
        <div>
          <h1 className="saved-title">💾 {t("savedNewsTitle")}</h1>
          <p className="saved-subtitle">
            {t("articlesCountSaved", { count: savedPosts.length })}
            {selectedCollection && collections.find((c) => c.id === selectedCollection)
              ? ` ${t("inCollection")} "${collections.find((c) => c.id === selectedCollection).name}"`
              : ""}
          </p>
        </div>
        <div className="saved-header-actions">
          <button
            className={`saved-header-btn ${showStats ? "active" : ""}`}
            onClick={() => setShowStats(!showStats)}
            title={t("stats")}
          >
            📊 {t("stats")}
          </button>
        </div>
      </div>

      {/* Stats */}
      {showStats && <SavedStats posts={savedPosts} collections={collections} />}

      {/* Empty state */}
      {savedPosts.length === 0 && (
        <div className="saved-empty">
          <div className="saved-empty-icon">💾</div>
          <h3>{t("noSavedArticlesYet")}</h3>
          <p>{t("savedArticlesDesc")}</p>
          <div className="saved-empty-tips">
            <div className="saved-tip">
              <span>📂</span> {t("organIntoSaves")}
            </div>
            <div className="saved-tip">
              <span>📝</span> {t("addPersonalNotes")}
            </div>
            <div className="saved-tip">
              <span>🏷️</span> {t("filterByTags")}
            </div>
          </div>
        </div>
      )}

      {savedPosts.length > 0 && (
        <div className="saved-layout">
          {/* Left sidebar - Collections */}
          <div className="saved-sidebar">
            <CollectionManager
              collections={collections}
              selectedCollection={selectedCollection}
              onSelectCollection={setSelectedCollection}
              onRefresh={refreshData}
            />

            {/* Tag filter */}
            {allTags.length > 0 && (
              <div className="saved-tags-section">
                <h3>🏷️ {t("tags")}</h3>
                <div className="saved-tag-list">
                  <button
                    className={`saved-tag-pill ${!selectedTag ? "active" : ""}`}
                    onClick={() => setSelectedTag(null)}
                  >
                    {t("all")}
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      className={`saved-tag-pill ${selectedTag === tag ? "active" : ""}`}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main content area */}
          <div className="saved-main">
            {/* Search & sort bar */}
            <div className="saved-toolbar">
              <div className="saved-search">
                <span>🔍</span>
                <input
                  type="text"
                  placeholder={t("searchSavedPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="saved-search-clear" onClick={() => setSearchQuery("")}>
                    ✕
                  </button>
                )}
              </div>
              <select
                className="saved-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">{t("newestFirst")}</option>
                <option value="oldest">{t("oldestFirst")}</option>
                <option value="title">{t("byTitle")}</option>
                <option value="category">{t("byCategory")}</option>
              </select>
            </div>

            {/* Posts grid */}
            {filteredPosts.length === 0 ? (
              <div className="saved-no-results">
                <p>{t("noArticlesMatch")}</p>
                <button className="saved-btn-sm saved-btn-primary" onClick={clearAllFilters}>
                  {t("clearFilters")}
                </button>
              </div>
            ) : (
              <div className="saved-posts-grid">
                {filteredPosts.map((post) => (
                  <SavedPostCard
                    key={post.id}
                    post={post}
                    onUnsave={handleUnsave}
                    onOpen={setSelectedPost}
                    collectionId={selectedCollection}
                    collections={collections}
                    onAddToCollection={refreshData}
                    onRemoveFromCollection={refreshData}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Modal */}
      {selectedPost && <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />}
    </div>
  );
}
