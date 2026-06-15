import { useState, useEffect, useRef, useCallback } from "react";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { useTranslation } from "react-i18next";
import TelegramPostCard from "./TelegramPostCard";

const TABS = {
  FOR_YOU: "for-you",
  BY_CHANNEL: "by-channel",
  DISCOVER: "discover",
};

const PAGE_SIZE = 20;

const FALLBACK_SUGGESTIONS = ["news", "gaza", "sports", "politics", "tech"];

const TAB_META = [
  { id: TABS.FOR_YOU, icon: "✨", labelKey: "telegramFeed.tabForYou", defaultLabel: "For You" },
  { id: TABS.BY_CHANNEL, icon: "📡", labelKey: "telegramFeed.tabByChannel", defaultLabel: "By Channel" },
  { id: TABS.DISCOVER, icon: "🔍", labelKey: "telegramFeed.tabDiscover", defaultLabel: "Discover" },
];

function PostSkeleton() {
  return (
    <div className="tg-post-card tg-post-skeleton" aria-hidden>
      <div className="tg-skel-row">
        <div className="tg-skel-avatar" />
        <div className="tg-skel-lines">
          <div className="tg-skel-line tg-skel-line--short" />
          <div className="tg-skel-line tg-skel-line--tiny" />
        </div>
      </div>
      <div className="tg-skel-line" />
      <div className="tg-skel-line" />
      <div className="tg-skel-line tg-skel-line--medium" />
    </div>
  );
}

function buildFeedUrl({ tab, userId, page, channelId, searchQuery }) {
  if (tab === TABS.FOR_YOU) {
    return `/api/telegram/feed/for-you?userId=${encodeURIComponent(userId)}&limit=${PAGE_SIZE}&page=${page}`;
  }
  if (tab === TABS.BY_CHANNEL) {
    return `/api/telegram/feed/by-channel?channelId=${channelId}&limit=${PAGE_SIZE}&page=${page}`;
  }
  return `/api/telegram/feed/discover?q=${encodeURIComponent(searchQuery.trim())}&limit=${PAGE_SIZE}&page=${page}`;
}

export default function TelegramFeed() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(TABS.FOR_YOU);
  const [channelQuery, setChannelQuery] = useState("");
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [activeDiscoverQuery, setActiveDiscoverQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [popularTags, setPopularTags] = useState(FALLBACK_SUGGESTIONS);

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [readyForMore, setReadyForMore] = useState(false);

  const loader = useRef(null);
  const loadingRef = useRef(false);

  const canLoadTab =
    tab === TABS.FOR_YOU ||
    (tab === TABS.BY_CHANNEL && selectedChannel) ||
    (tab === TABS.DISCOVER && activeDiscoverQuery);

  const feedKey = `${tab}-${selectedChannel?.id ?? ""}-${activeDiscoverQuery}-${refreshKey}`;

  const fetchPage = useCallback(
    async (pageToFetch, append) => {
      if (loadingRef.current) return;
      if (tab === TABS.BY_CHANNEL && !selectedChannel) return;
      if (tab === TABS.DISCOVER && !activeDiscoverQuery?.trim()) return;

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        await ensureUserInitialized();
        const userId = getUserId();
        const url = buildFeedUrl({
          tab,
          userId,
          page: pageToFetch,
          channelId: selectedChannel?.id,
          searchQuery: activeDiscoverQuery,
        });

        const res = await apiFetch(url);
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
          setHasMore(false);
          return;
        }

        let addedCount = 0;
        setPosts((prev) => {
          const base = append ? prev : [];
          const ids = new Set(base.map((p) => p.id));
          const fresh = data.filter((p) => !ids.has(p.id));
          addedCount = fresh.length;
          return fresh.length > 0 ? [...base, ...fresh] : base;
        });

        setPage(pageToFetch + 1);
        if (data.length < PAGE_SIZE || (append && addedCount === 0)) {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Telegram feed error:", err);
        setError(err.message || "Failed to load");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setReadyForMore(true);
      }
    },
    [tab, selectedChannel?.id, activeDiscoverQuery]
  );

  // Reset and load the first page when the feed context changes.
  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
    setReadyForMore(false);
    setError(null);
    loadingRef.current = false;

    if (!canLoadTab) return;
    fetchPage(0, false);
  }, [feedKey, canLoadTab, fetchPage]);

  useEffect(() => {
    if (tab !== TABS.DISCOVER) return;
    apiFetch("/api/telegram/tags/popular?limit=12")
      .then((res) => (res.ok ? res.json() : []))
      .then((tags) => {
        if (Array.isArray(tags) && tags.length > 0) setPopularTags(tags);
      })
      .catch(() => {});
  }, [tab]);

  useEffect(() => {
    if (tab !== TABS.BY_CHANNEL) return;
    const timer = setTimeout(async () => {
      setChannelsLoading(true);
      try {
        const q = channelQuery.trim();
        const url = q
          ? `/api/telegram/channels/browse?q=${encodeURIComponent(q)}`
          : "/api/telegram/channels/browse";
        const res = await apiFetch(url);
        if (res.ok) setChannels(await res.json());
      } catch (e) {
        console.error("Channel browse error:", e);
      } finally {
        setChannelsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tab, channelQuery]);

  // Load the next page only when the user scrolls near the bottom of the feed column.
  useEffect(() => {
    if (!readyForMore || !hasMore || loading) return;

    const node = loader.current;
    if (!node) return;

    const scrollRoot = node.closest(".home-feed");

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          fetchPage(page, true);
        }
      },
      {
        root: scrollRoot,
        threshold: 0,
        rootMargin: "0px 0px 120px 0px",
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [readyForMore, hasMore, loading, page, fetchPage, posts.length]);

  const handleDiscoverSearch = (e) => {
    e.preventDefault();
    if (discoverQuery.trim()) setActiveDiscoverQuery(discoverQuery.trim());
  };

  const applySuggestion = (topic) => {
    setDiscoverQuery(topic);
    setActiveDiscoverQuery(topic);
  };

  const showEmpty = !loading && !error && posts.length === 0 && canLoadTab;
  const showInitialSkeleton = loading && posts.length === 0 && !error;

  return (
    <div className="telegram-feed">
      <header className="telegram-feed-hero">
        <div className="telegram-feed-hero-icon" aria-hidden>✈️</div>
        <div>
          <h2>{t("telegramFeed.title", "Special News")}</h2>
          <p>
            {t(
              "telegramFeed.subtitle",
              "Telegram-only feed — topics you care about, across many channels"
            )}
          </p>
        </div>
      </header>

      <nav className="telegram-feed-tabs" role="tablist" aria-label={t("telegramFeed.title", "Special News")}>
        {TAB_META.map(({ id, icon, labelKey, defaultLabel }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`telegram-feed-tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            <span className="telegram-feed-tab-icon" aria-hidden>{icon}</span>
            {t(labelKey, defaultLabel)}
          </button>
        ))}
      </nav>

      <div className="telegram-feed-toolbar">
        {tab === TABS.FOR_YOU && (
          <p className="telegram-feed-tab-hint">
            {t(
              "telegramFeed.forYouHint",
              "We learn topics from posts you read and surface similar content from other channels."
            )}
          </p>
        )}

        {tab === TABS.BY_CHANNEL && (
          <div className="telegram-feed-panel">
            <div className="telegram-search-wrap">
              <span className="telegram-search-icon" aria-hidden>🔎</span>
              <input
                type="search"
                className="telegram-feed-search"
                placeholder={t("telegramFeed.searchChannel", "Search channel name or @username…")}
                value={channelQuery}
                onChange={(e) => setChannelQuery(e.target.value)}
              />
            </div>

            {selectedChannel && (
              <div className="telegram-selected-channel">
                <div>
                  <span className="telegram-selected-label">
                    {t("telegramFeed.watching", "Watching")}
                  </span>
                  <strong>{selectedChannel.displayName || selectedChannel.channelUsername}</strong>
                  <span className="telegram-selected-handle">@{selectedChannel.channelUsername}</span>
                </div>
                <button
                  type="button"
                  className="telegram-clear-channel"
                  onClick={() => setSelectedChannel(null)}
                >
                  {t("clear", "Clear")}
                </button>
              </div>
            )}

            {channelsLoading && (
              <div className="telegram-channel-skeletons" aria-hidden>
                {[1, 2, 3].map((n) => (
                  <div key={n} className="telegram-channel-skel" />
                ))}
              </div>
            )}

            {!channelsLoading && channels.length > 0 && !selectedChannel && (
              <ul className="telegram-channel-list">
                {channels.map((ch) => (
                  <li key={ch.id}>
                    <button
                      type="button"
                      className="telegram-channel-pick"
                      onClick={() => setSelectedChannel(ch)}
                    >
                      <span className="telegram-channel-pick-avatar">
                        {(ch.displayName || ch.channelUsername || "T").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="telegram-channel-pick-body">
                        <span className="telegram-channel-pick-name">
                          {ch.displayName || ch.channelUsername}
                        </span>
                        <span className="telegram-channel-pick-handle">@{ch.channelUsername}</span>
                        {ch.adminDescription && (
                          <span className="telegram-channel-pick-desc">{ch.adminDescription}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!channelsLoading && channels.length === 0 && channelQuery && (
              <p className="telegram-feed-hint">{t("telegramFeed.noChannels", "No channels match your search.")}</p>
            )}

            {!channelsLoading && !selectedChannel && !channelQuery && channels.length === 0 && (
              <p className="telegram-feed-hint">{t("telegramFeed.pickChannel", "Select a channel to view its posts.")}</p>
            )}
          </div>
        )}

        {tab === TABS.DISCOVER && (
          <div className="telegram-feed-panel">
            <form className="telegram-discover-form" onSubmit={handleDiscoverSearch}>
              <div className="telegram-search-wrap telegram-search-wrap--grow">
                <span className="telegram-search-icon" aria-hidden>🔎</span>
                <input
                  type="search"
                  className="telegram-feed-search"
                  placeholder={t(
                    "telegramFeed.discoverPlaceholder",
                    "Search by tag, topic, or keyword…"
                  )}
                  value={discoverQuery}
                  onChange={(e) => setDiscoverQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="telegram-discover-btn" disabled={!discoverQuery.trim()}>
                {t("search", "Search")}
              </button>
            </form>

            <div className="telegram-topic-chips">
              <span className="telegram-topic-label">
                {t("telegramFeed.popularTags", "Popular tags")}:
              </span>
              {popularTags.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={`telegram-topic-chip ${activeDiscoverQuery === topic ? "active" : ""}`}
                  onClick={() => applySuggestion(topic)}
                >
                  #{topic}
                </button>
              ))}
            </div>

            {activeDiscoverQuery && (
              <p className="telegram-discover-active">
                {t("telegramFeed.resultsFor", "Results for")}{" "}
                <strong>&ldquo;{activeDiscoverQuery}&rdquo;</strong>
              </p>
            )}
          </div>
        )}

        {posts.length > 0 && (
          <span className="telegram-post-count">
            {posts.length} {t("telegramFeed.postsLoaded", "posts")}
          </span>
        )}
      </div>

      {error && (
        <div className="telegram-feed-error" role="alert">
          <p>{t("telegramFeed.loadError", "Could not load Telegram posts.")}</p>
          <button type="button" className="telegram-retry-btn" onClick={() => setRefreshKey((k) => k + 1)}>
            {t("retry", "Retry")}
          </button>
        </div>
      )}

      {showInitialSkeleton && (
        <div className="telegram-post-list">
          {[1, 2, 3].map((n) => <PostSkeleton key={n} />)}
        </div>
      )}

      {showEmpty && (
        <div className="telegram-feed-empty">
          <span className="telegram-empty-icon" aria-hidden>📭</span>
          <p>{t("telegramFeed.empty", "No Telegram posts found.")}</p>
          {tab === TABS.FOR_YOU && (
            <p className="telegram-feed-hint">
              {t("telegramFeed.emptyForYou", "Read a few posts — we'll learn your topics and find similar channels.")}
            </p>
          )}
        </div>
      )}

      <div className="telegram-post-list stagger">
        {posts.map((post) => (
          <TelegramPostCard
            key={post.id}
            post={post}
            showChannelProfile={tab === TABS.DISCOVER}
            showMatchBadge={tab === TABS.FOR_YOU || tab === TABS.DISCOVER}
            onTagClick={tab === TABS.DISCOVER ? applySuggestion : undefined}
          />
        ))}
      </div>

      {canLoadTab && posts.length > 0 && (
        <div ref={loader} className="telegram-feed-scroll-status">
          {loading
            ? t("loading", "Loading...")
            : hasMore
            ? t("scrollToLoad", "Scroll to load more")
            : t("noMorePosts", "No more posts")}
        </div>
      )}
    </div>
  );
}
