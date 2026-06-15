import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, authConfig } from "../../api";
import ChannelOnboardingModal from "../../components/ChannelOnboardingModal";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { hasRole } from "../utils/roles";
import { resolveAvatar, displayNameFromEmail } from "../utils/avatars";
import {
  ADMIN_ROLES,
  REGISTERED_ROLE_OPTIONS,
  EDITOR_ROLE_OPTIONS,
  USER_STATUSES,
} from "../constants/roles";

export function ManageTelegram({ session }) {
  const [channels, setChannels] = useState([]);
  const [posts, setPosts] = useState({ content: [], totalPages: 0, number: 0 });
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [error, setError] = useState("");
  const [postsPage, setPostsPage] = useState(0);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const { askConfirm, Dialog } = useConfirmDialog();
  const cfg = authConfig(session.token);

  // â”€â”€ search modal state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [onboardingChannel, setOnboardingChannel] = useState(null);

  const loadChannels = useCallback(() => {
    api.get("/api/telegram/channels", authConfig(session.token))
       .then(r => setChannels(r.data))
       .catch(console.error);
  }, [session.token]);

  const loadPosts = useCallback((channelId, page = 0) => {
    const url = channelId
      ? `/api/telegram/posts/channel/${channelId}?page=${page}&size=15`
      : `/api/telegram/posts?page=${page}&size=15`;
    api.get(url, authConfig(session.token))
       .then(r => setPosts(r.data))
       .catch(console.error);
  }, [session.token]);

  useEffect(loadChannels, [loadChannels]);
  useEffect(() => { loadPosts(selectedChannel, postsPage); }, [selectedChannel, postsPage, loadPosts]);

  // Debounced live search as user types
  useEffect(() => {
    if (!searchOpen) return;
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await api.get(
          `/api/admin/telegram-crawler/search?q=${encodeURIComponent(searchQuery.trim())}`,
          authConfig(session.token)
        );
        setSearchResults(res.data.results || []);
        if ((res.data.results || []).length === 0) {
          setSearchError(`No channels found for "${searchQuery.trim()}". Try a different keyword or the channel's username.`);
        }
      } catch (err) {
        setSearchError(err.response?.status === 502
          ? "Telegram crawler server is offline. Start it to enable channel search."
          : "Search failed. Please try again.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen, session.token]);

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  };

  const handleAddChannel = async (result) => {
    setError("");
    try {
      const res = await api.post("/api/telegram/channels", {
        channelUsername: result.username,
        displayName: result.title || result.username,
        description: result.description || "",
        avatarUrl: result.avatarUrl || "",
      }, authConfig(session.token));
      closeSearch();
      loadChannels();
      setOnboardingChannel(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add channel");
    }
  };

  const handleStatusChange = async (ch, newStatus) => {
    try {
      await api.patch(`/api/telegram/channels/${ch.id}/status`, { status: newStatus }, authConfig(session.token));
      loadChannels();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this channel and all collected posts?", "Delete Channel");
    if (!ok) return;
    try {
      await api.delete(`/api/telegram/channels/${id}`, authConfig(session.token));
      if (selectedChannel === id) setSelectedChannel(null);
      loadChannels();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete channel");
    }
  };

  const handleEditPost = async (postId) => {
    try {
      await api.put(`/api/telegram/posts/${postId}/content`, { content: editContent }, authConfig(session.token));
      setEditingPostId(null);
      loadPosts(selectedChannel, postsPage);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to edit post");
    }
  };

  const handleDeletePost = async (postId) => {
    const ok = await askConfirm("Delete this Telegram post?");
    if (!ok) return;
    try {
      await api.delete(`/api/telegram/posts/${postId}`, authConfig(session.token));
      loadPosts(selectedChannel, postsPage);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete post");
    }
  };

  const STATUS_COLORS = { ACTIVE: "#22c55e", SUSPENDED: "#ef4444" };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Telegram Channels</h2>
        <p>Add and manage Telegram channels, view collected posts</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <button className="admin-btn primary" onClick={openSearch}>+ Add Channel</button>

      {/* â”€â”€ Search Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {searchOpen && (
        <div className="tg-search-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeSearch(); }}>
          <div className="tg-search-modal">
            <div className="tg-search-modal-header">
              <h3>Add Telegram Channel</h3>
              <button className="tg-search-modal-close" onClick={closeSearch}>x</button>
            </div>
            <p className="tg-search-modal-hint">
              Search by channel name, topic, or username in any language (e.g. <code>bbc</code>, <code>reuters</code>, <code>الجزيرة</code>).
            </p>
            <div className="tg-search-bar">
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searching && <span className="spinner-sm tg-search-spinner" />}
            </div>

            {searchQuery.trim().length >= 2 && !searching && searchError && (
              <p className="tg-search-empty">{searchError}</p>
            )}

            {searchResults.length > 0 && (
              <div className="tg-search-results">
                {searchResults.map((r, i) => {
                  const alreadyAdded = channels.some(c => c.channelUsername.toLowerCase() === r.username.toLowerCase());
                  return (
                    <div key={i} className="tg-search-result-card">
                      <span className="tg-channel-avatar">
                        {r.avatarUrl
                          ? <img src={r.avatarUrl} alt="" />
                          : (r.title?.[0]?.toUpperCase() || "T")}
                      </span>
                      <div className="tg-search-result-info">
                        <span className="tg-channel-name">{r.title}</span>
                        <span className="tg-channel-handle">@{r.username}</span>
                        {r.description && (
                          <span className="tg-search-result-desc">{r.description.slice(0, 120)}</span>
                        )}
                        {r.subscribers && (
                          <span className="tg-search-result-subs">{r.subscribers.toLocaleString()} subscribers</span>
                        )}
                        {r.hasPublicPreview === false && (
                          <span className="tg-search-result-warn">⚠ No public preview — posts cannot be scraped</span>
                        )}
                      </div>
                      {alreadyAdded ? (
                        <span className="tg-search-added-badge">Added</span>
                      ) : (
                        <button className="admin-btn small primary" onClick={() => handleAddChannel(r)}>+ Add</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery.trim().length < 2 && (
              <p className="tg-search-empty" style={{ marginTop: "1rem" }}>
                Type a name or keyword to search…
              </p>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ Channel Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="tg-channel-grid">
        {channels.map(ch => (
          <div
            key={ch.id}
            className={`tg-channel-card ${selectedChannel === ch.id ? "selected" : ""}`}
            onClick={() => { setSelectedChannel(selectedChannel === ch.id ? null : ch.id); setPostsPage(0); }}
          >
            <div className="tg-channel-card-top">
              <span className="tg-channel-avatar">{ch.displayName?.[0]?.toUpperCase() || "T"}</span>
              <div className="tg-channel-info">
                <span className="tg-channel-name">{ch.displayName || ch.channelUsername}</span>
                <span className="tg-channel-handle">@{ch.channelUsername}</span>
              </div>
              <span className="tg-channel-status-badge" style={{
                background: (STATUS_COLORS[ch.status] || "#64748b") + "22",
                color: STATUS_COLORS[ch.status] || "#64748b",
                border: `1px solid ${STATUS_COLORS[ch.status] || "#64748b"}66`
              }}>
                {ch.status}
              </span>
            </div>
            {ch.description && <p className="tg-channel-desc">{ch.description}</p>}
            <div className="tg-channel-stats">
              <span>{ch.totalPostsCollected} posts</span>
              <span>{ch.lastCrawledAt ? `Last: ${new Date(ch.lastCrawledAt).toLocaleString()}` : "Never crawled"}</span>
              {ch.crawlPriority != null && <span>Priority: {ch.crawlPriority.toFixed(1)}</span>}
              {ch.waitlist && <span className="tg-waitlist-badge">Waitlist</span>}
            </div>
            <div className="tg-channel-actions" onClick={e => e.stopPropagation()}>
              {!ch.onboardingCompleted && (
                <button className="admin-btn small primary" onClick={() => setOnboardingChannel(ch)}>Onboard</button>
              )}
              {ch.status === "ACTIVE" ? (
                <button className="admin-btn small danger" onClick={() => handleStatusChange(ch, "SUSPENDED")}>Suspend</button>
              ) : (
                <button className="admin-btn small primary" onClick={() => handleStatusChange(ch, "ACTIVE")}>Activate</button>
              )}
              <button className="admin-btn small danger" onClick={() => handleDelete(ch.id)}>Delete</button>
            </div>
          </div>
        ))}
        {channels.length === 0 && (
          <div className="event-empty-state"><p>No Telegram channels added yet. Click "+ Add Channel" to get started.</p></div>
        )}
      </div>

      {/* â”€â”€ Posts Feed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="tg-posts-section">
        <h3 className="tg-posts-title">
          {selectedChannel
            ? `Posts from @${channels.find(c => c.id === selectedChannel)?.channelUsername || "..."}`
            : "All Telegram Posts"}
        </h3>
        <div className="tg-posts-list">
          {(posts.content || []).map(p => (
            <div key={p.id} className="tg-post-card">
              <div className="tg-post-header">
                <span className="tg-post-channel">@{p.channelUsername}</span>
                <span className="tg-post-date">{p.messageDate ? new Date(p.messageDate).toLocaleString() : "-"}</span>
                <span className="tg-post-views">{p.viewCount > 0 ? `${p.viewCount} views` : ""}</span>
              </div>
              {editingPostId === p.id ? (
                <div className="tg-post-edit">
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} />
                  <div className="tg-post-edit-actions">
                    <button className="admin-btn small primary" onClick={() => handleEditPost(p.id)}>Save</button>
                    <button className="admin-btn small" onClick={() => setEditingPostId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="tg-post-content">{p.content || <em>No text content</em>}</p>
              )}
              {p.mediaUrl && (
                <div className="tg-post-media">
                  {p.mediaType === "photo"
                    ? <img src={p.mediaUrl} alt="Telegram media" />
                    : p.mediaType === "video"
                    ? <video src={p.mediaUrl} controls />
                    : null}
                </div>
              )}
              <div className="tg-post-actions">
                <button className="admin-btn small" onClick={() => { setEditingPostId(p.id); setEditContent(p.content || ""); }}>Edit</button>
                <button className="admin-btn small danger" onClick={() => handleDeletePost(p.id)}>Delete</button>
                {p.edited && <span className="tg-post-edited-badge">edited</span>}
              </div>
            </div>
          ))}
          {(posts.content || []).length === 0 && (
            <div className="event-empty-state"><p>No posts collected yet. Start the Telegram crawler to begin collecting.</p></div>
          )}
        </div>
        {posts.totalPages > 1 && (
          <div className="tg-posts-pagination">
            <button className="admin-btn small" disabled={postsPage === 0} onClick={() => setPostsPage(p => p - 1)}>{"<- Prev"}</button>
            <span>Page {postsPage + 1} of {posts.totalPages}</span>
            <button className="admin-btn small" disabled={postsPage >= posts.totalPages - 1} onClick={() => setPostsPage(p => p + 1)}>{"Next ->"}</button>
          </div>
        )}
      </div>

      {Dialog}

      {onboardingChannel && (
        <ChannelOnboardingModal
          channel={onboardingChannel}
          session={session}
          onComplete={() => { setOnboardingChannel(null); loadChannels(); }}
          onSkip={() => setOnboardingChannel(null)}
        />
      )}
    </div>
  );
}
