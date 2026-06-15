import { useState, useEffect } from "react";
import { searchTelegramChannels, createTelegramChannel } from "../../../services/telegramService";

export function ChannelSearchModal({ session, existingChannels, onClose, onAdded }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await searchTelegramChannels(session.token, searchQuery.trim());
        setSearchResults(res.results || []);
        if ((res.results || []).length === 0) {
          setSearchError(`No channels found for "${searchQuery.trim()}".`);
        }
      } catch (err) {
        setSearchError(err.response?.status === 502
          ? "Telegram crawler server is offline."
          : "Search failed.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [searchQuery, session.token]);

  const handleAdd = async (result) => {
    setError("");
    try {
      const channel = await createTelegramChannel(session.token, {
        channelUsername: result.username,
        displayName: result.title || result.username,
        description: result.description || "",
        avatarUrl: result.avatarUrl || "",
      });
      onAdded(channel, result.subscribers);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add channel");
    }
  };

  return (
    <div className="tg-search-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tg-search-modal">
        <div className="tg-search-modal-header">
          <h3>Add Telegram Channel</h3>
          <button type="button" className="tg-search-modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="admin-error">{error}</div>}
        <div className="tg-search-bar">
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
              const added = existingChannels.some(
                (c) => c.channelUsername?.toLowerCase() === r.username?.toLowerCase()
              );
              return (
                <div key={i} className="tg-search-result-card">
                  <span className="tg-channel-avatar">
                    {r.avatarUrl ? <img src={r.avatarUrl} alt="" /> : (r.title?.[0]?.toUpperCase() || "T")}
                  </span>
                  <div className="tg-search-result-info">
                    <span className="tg-channel-name">{r.title}</span>
                    <span className="tg-channel-handle">@{r.username}</span>
                    {r.subscribers && (
                      <span className="tg-search-result-subs">{r.subscribers.toLocaleString()} subscribers</span>
                    )}
                  </div>
                  {added ? (
                    <span className="tg-search-added-badge">Added</span>
                  ) : (
                    <button type="button" className="admin-btn small primary" onClick={() => handleAdd(r)}>+ Add</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
