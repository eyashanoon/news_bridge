// SavedNews.jsx — Full-featured saved news page with collections, notes, stats, and more
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { categoryColors } from "../utils/categoryColors";
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
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [showMenuId, setShowMenuId] = useState(null);
  const [newColIcon, setNewColIcon] = useState("📁");

  const iconOptions = ["📁", "📰", "⭐", "❤️", "🔥", "💡", "📌", "🏷️", "🎯", "📚", "🗂️", "💎"];

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
    deleteCollection(id);
    setShowMenuId(null);
    if (selectedCollection === id) onSelectCollection(null);
    onRefresh();
  };

  return (
    <div className="saved-collections-panel">
      <div className="saved-collections-header">
        <h3>📂 Collections</h3>
        <button className="saved-btn-icon" onClick={() => setShowCreate(!showCreate)} title="New Collection">
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
              placeholder="Collection name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <button className="saved-btn-sm saved-btn-primary" onClick={handleCreate}>
              Create
            </button>
          </div>
        </div>
      )}

      <button
        className={`saved-col-item ${!selectedCollection ? "active" : ""}`}
        onClick={() => onSelectCollection(null)}
      >
        <span>📦 All Saved</span>
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
                  ✏️ Rename
                </button>
                <button className="danger" onClick={() => handleDelete(col.id)}>
                  🗑️ Delete
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
  const [note, setNoteState] = useState(() => getNote(postId));
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    setNote(postId, note);
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
          <span className="saved-note-empty">📝 Add a note...</span>
        )}
      </div>
    );
  }

  return (
    <div className="saved-note-editor">
      <textarea
        value={note}
        onChange={(e) => setNoteState(e.target.value)}
        placeholder="Write your thoughts about this article..."
        rows={3}
        autoFocus
      />
      <div className="saved-note-actions">
        <button className="saved-btn-sm saved-btn-primary" onClick={handleSave}>Save</button>
        <button className="saved-btn-sm" onClick={() => { setNoteState(getNote(postId)); setEditing(false); }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SavedPostCard({ post, onUnsave, onOpen, collectionId, collections, onAddToCollection, onRemoveFromCollection }) {
  const colors = categoryColors[post.label] || {};
  const note = getNote(post.id);
  const [showColMenu, setShowColMenu] = useState(false);

  return (
    <div className="saved-post-card" onClick={() => onOpen(post)}>
      <div className="saved-post-card-top">
        <span className="saved-post-cat" style={{ background: colors.text || undefined, color: colors.text ? "#fff" : undefined }}>
          {post.label}
        </span>
        <span className="saved-post-time">{timeAgo(post.savedAt)}</span>
      </div>

      {post.title && <h4 className="saved-post-title">{post.title}</h4>}
      {post.text && <p className="saved-post-text">{post.text.slice(0, 120)}...</p>}

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
          {post.tags.slice(0, 3).map((t, i) => (
            <span key={i} className="saved-mini-tag">#{t}</span>
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
            title="Add to collection"
          >
            📂
          </button>
          {showColMenu && (
            <div className="saved-col-picker-dropdown">
              {collections.length === 0 && <div className="saved-col-picker-empty">No collections yet</div>}
              {collections.map((col) => {
                const isInCol = post.collections?.includes(col.id);
                return (
                  <button
                    key={col.id}
                    className={`saved-col-pick-option ${isInCol ? "active" : ""}`}
                    onClick={() => {
                      if (isInCol) {
                        removePostFromCollection(post.id, col.id);
                        onRemoveFromCollection?.();
                      } else {
                        addPostToCollection(post.id, col.id);
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
          title="Remove from saved"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ─── Stats Component ────────────────────────────────────────
function SavedStats({ posts, collections }) {
  const avgNoteLength = posts.filter((p) => getNote(p.id)).length;
  const colStats = collections.map((c) => ({
    name: `${c.icon} ${c.name}`,
    count: c.postCount,
  }));

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
        <span className="saved-stat-label">Total Saved</span>
      </div>
      <div className="saved-stat-card">
        <span className="saved-stat-icon">📂</span>
        <span className="saved-stat-value">{collections.length}</span>
        <span className="saved-stat-label">Collections</span>
      </div>
      <div className="saved-stat-card">
        <span className="saved-stat-icon">📝</span>
        <span className="saved-stat-value">{avgNoteLength}</span>
        <span className="saved-stat-label">With Notes</span>
      </div>
      <div className="saved-stat-card">
        <span className="saved-stat-icon">{topCategory?.[0] ? "🏷️" : "📭"}</span>
        <span className="saved-stat-value">{topCategory?.[1] || 0}</span>
        <span className="saved-stat-label">{topCategory?.[0] || "No posts"}</span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function SavedNews() {
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
      <div className="saved-loading">
        <div className="saved-loading-spinner">🔄</div>
        <p>Loading your saved news...</p>
      </div>
    );
  }

  return (
    <div className="saved-page">
      {/* Header */}
      <div className="saved-header">
        <div>
          <h1 className="saved-title">💾 Saved News</h1>
          <p className="saved-subtitle">
            {savedPosts.length} {savedPosts.length === 1 ? "article" : "articles"} saved
            {selectedCollection && collections.find((c) => c.id === selectedCollection)
              ? ` in "${collections.find((c) => c.id === selectedCollection).name}"`
              : ""}
          </p>
        </div>
        <div className="saved-header-actions">
          <button
            className={`saved-header-btn ${showStats ? "active" : ""}`}
            onClick={() => setShowStats(!showStats)}
            title="Stats"
          >
            📊 Stats
          </button>
        </div>
      </div>

      {/* Stats */}
      {showStats && <SavedStats posts={savedPosts} collections={collections} />}

      {/* Empty state */}
      {savedPosts.length === 0 && (
        <div className="saved-empty">
          <div className="saved-empty-icon">💾</div>
          <h3>No saved articles yet</h3>
          <p>Click the 💾 Save button on any post to save it here for later reading.</p>
          <div className="saved-empty-tips">
            <div className="saved-tip">
              <span>📂</span> Organize saves into collections
            </div>
            <div className="saved-tip">
              <span>📝</span> Add personal notes to articles
            </div>
            <div className="saved-tip">
              <span>🏷️</span> Filter by tags and categories
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
                <h3>🏷️ Tags</h3>
                <div className="saved-tag-list">
                  <button
                    className={`saved-tag-pill ${!selectedTag ? "active" : ""}`}
                    onClick={() => setSelectedTag(null)}
                  >
                    All
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
                  placeholder="Search saved articles..."
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
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">By Title</option>
                <option value="category">By Category</option>
              </select>
            </div>

            {/* Posts grid */}
            {filteredPosts.length === 0 ? (
              <div className="saved-no-results">
                <p>No articles match your filters.</p>
                <button className="saved-btn-sm saved-btn-primary" onClick={() => { setSearchQuery(""); setSelectedTag(null); setSelectedCollection(null); }}>
                  Clear Filters
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