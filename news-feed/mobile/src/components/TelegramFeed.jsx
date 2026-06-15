import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import TelegramPostCard from "./TelegramPostCard";

const TABS = {
  FOR_YOU: "for-you",
  BY_CHANNEL: "by-channel",
  DISCOVER: "discover",
};

const PAGE_SIZE = 20;
const FALLBACK_SUGGESTIONS = ["news", "gaza", "sports", "politics", "tech"];
const ACCENT = "#2563eb";

const TAB_META = [
  { id: TABS.FOR_YOU, icon: "✨", labelKey: "telegramFeed.tabForYou", defaultLabel: "For You" },
  { id: TABS.BY_CHANNEL, icon: "📡", labelKey: "telegramFeed.tabByChannel", defaultLabel: "By Channel" },
  { id: TABS.DISCOVER, icon: "🔍", labelKey: "telegramFeed.tabDiscover", defaultLabel: "Discover" },
];

function buildFeedUrl({ tab, userId, page, channelId, searchQuery }) {
  if (tab === TABS.FOR_YOU) {
    return `/api/telegram/feed/for-you?userId=${encodeURIComponent(userId)}&limit=${PAGE_SIZE}&page=${page}`;
  }
  if (tab === TABS.BY_CHANNEL) {
    return `/api/telegram/feed/by-channel?channelId=${channelId}&limit=${PAGE_SIZE}&page=${page}`;
  }
  return `/api/telegram/feed/discover?q=${encodeURIComponent(searchQuery.trim())}&limit=${PAGE_SIZE}&page=${page}`;
}

function PostSkeleton({ darkMode }) {
  const skel = th(darkMode, dc.subtle, "#e2e8f0");
  return (
    <View style={[skelStyles.card, { backgroundColor: th(darkMode, dc.cardBg, "#fff"), borderColor: th(darkMode, dc.cardBorder, "#e2e8f0") }]}>
      <View style={skelStyles.row}>
        <View style={[skelStyles.avatar, { backgroundColor: skel }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[skelStyles.line, { width: "45%", backgroundColor: skel }]} />
          <View style={[skelStyles.line, { width: "28%", height: 10, backgroundColor: skel }]} />
        </View>
      </View>
      <View style={[skelStyles.line, { backgroundColor: skel }]} />
      <View style={[skelStyles.line, { backgroundColor: skel }]} />
      <View style={[skelStyles.line, { width: "72%", backgroundColor: skel }]} />
    </View>
  );
}

const skelStyles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  line: { height: 12, borderRadius: 4 },
});

export default function TelegramFeed() {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const isRtl = i18n.language === "ar";

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
  const [visibleIds, setVisibleIds] = useState(new Set());

  const loadingRef = useRef(false);

  const textColor = th(darkMode, dc.text, "#0f172a");
  const mutedColor = th(darkMode, dc.textMuted, "#64748b");
  const cardBg = th(darkMode, dc.cardBg, "#fff");
  const borderColor = th(darkMode, dc.cardBorder, "#e2e8f0");
  const inputBg = th(darkMode, dc.inputBg, "#fff");
  const tabsBg = th(darkMode, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.04)");
  const heroBg = th(darkMode, "rgba(37,99,235,0.15)", "rgba(37,99,235,0.1)");
  const heroBorder = th(darkMode, "rgba(96,165,250,0.2)", "rgba(37,99,235,0.15)");
  const heroIconBg = th(darkMode, "rgba(30,41,59,0.8)", "rgba(255,255,255,0.7)");

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
        const userId = (await getUserId()) || "android-app-anonymous";
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
      }
    },
    [tab, selectedChannel?.id, activeDiscoverQuery]
  );

  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
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

  const handleLoadMore = () => {
    if (!hasMore || loading || loadingRef.current) return;
    fetchPage(page, true);
  };

  const handleDiscoverSearch = () => {
    if (discoverQuery.trim()) setActiveDiscoverQuery(discoverQuery.trim());
  };

  const applySuggestion = (topic) => {
    setDiscoverQuery(topic);
    setActiveDiscoverQuery(topic);
  };

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    setVisibleIds(new Set(viewableItems.map((v) => v.item.id)));
  }).current;

  const showEmpty = !loading && !error && posts.length === 0 && canLoadTab;
  const showInitialSkeleton = loading && posts.length === 0 && !error;

  const searchIconPos = isRtl ? { right: 12 } : { left: 12 };
  const searchInputPad = isRtl
    ? { paddingRight: 36, paddingLeft: 14, textAlign: "right" }
    : { paddingLeft: 36, paddingRight: 14, textAlign: "left" };

  const renderToolbar = () => (
    <View style={styles.toolbar}>
      {tab === TABS.FOR_YOU && (
        <Text style={[styles.hint, { color: mutedColor }]}>
          {t("telegramFeed.forYouHint", "We learn topics from posts you read and surface similar content from other channels.")}
        </Text>
      )}

      {tab === TABS.BY_CHANNEL && (
        <View style={styles.panel}>
          <View style={styles.searchWrap}>
            <Text style={[styles.searchIcon, searchIconPos]}>🔎</Text>
            <TextInput
              style={[styles.searchInput, searchInputPad, { backgroundColor: inputBg, borderColor, color: textColor }]}
              placeholder={t("telegramFeed.searchChannel", "Search channel name or @username…")}
              placeholderTextColor={mutedColor}
              value={channelQuery}
              onChangeText={setChannelQuery}
            />
          </View>

          {selectedChannel ? (
            <View style={[styles.selectedChannel, { backgroundColor: th(darkMode, "rgba(37,99,235,0.12)", "rgba(37,99,235,0.08)"), borderColor: th(darkMode, "rgba(96,165,250,0.3)", "rgba(37,99,235,0.2)") }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedLabel, { color: mutedColor }]}>{t("telegramFeed.watching", "Watching")}</Text>
                <Text style={[styles.selectedName, { color: textColor }]}>
                  {selectedChannel.displayName || selectedChannel.channelUsername}
                  <Text style={{ color: mutedColor, fontSize: 13 }}> @{selectedChannel.channelUsername}</Text>
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.clearBtn, { backgroundColor: cardBg, borderColor }]}
                onPress={() => setSelectedChannel(null)}
              >
                <Text style={{ color: mutedColor, fontSize: 13 }}>{t("clear", "Clear")}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {channelsLoading ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={[styles.channelSkel, { backgroundColor: th(darkMode, dc.subtle, "#e2e8f0") }]} />
              ))}
            </View>
          ) : null}

          {!channelsLoading && channels.length > 0 && !selectedChannel ? (
            <ScrollView style={styles.channelList} nestedScrollEnabled>
              {channels.map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  style={[styles.channelPick, { backgroundColor: cardBg, borderColor }]}
                  onPress={() => setSelectedChannel(ch)}
                >
                  <View style={styles.channelAvatar}>
                    <Text style={styles.channelAvatarText}>
                      {(ch.displayName || ch.channelUsername || "T").slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.channelPickName, { color: textColor }]}>{ch.displayName || ch.channelUsername}</Text>
                    <Text style={[styles.channelPickHandle, { color: mutedColor }]}>@{ch.channelUsername}</Text>
                    {ch.adminDescription ? (
                      <Text style={[styles.channelPickDesc, { color: mutedColor }]} numberOfLines={2}>{ch.adminDescription}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          {!channelsLoading && channels.length === 0 && channelQuery ? (
            <Text style={[styles.hint, { color: mutedColor }]}>{t("telegramFeed.noChannels", "No channels match your search.")}</Text>
          ) : null}

          {!channelsLoading && !selectedChannel && !channelQuery && channels.length === 0 ? (
            <Text style={[styles.hint, { color: mutedColor }]}>{t("telegramFeed.pickChannel", "Select a channel to view its posts.")}</Text>
          ) : null}
        </View>
      )}

      {tab === TABS.DISCOVER && (
        <View style={styles.panel}>
          <View style={[styles.discoverForm, { flexDirection: isRtl ? "row-reverse" : "row" }]}>
            <View style={[styles.searchWrap, { flex: 1 }]}>
              <Text style={[styles.searchIcon, searchIconPos]}>🔎</Text>
              <TextInput
                style={[styles.searchInput, searchInputPad, { backgroundColor: inputBg, borderColor, color: textColor }]}
                placeholder={t("telegramFeed.discoverPlaceholder", "Search by tag, topic, or keyword…")}
                placeholderTextColor={mutedColor}
                value={discoverQuery}
                onChangeText={setDiscoverQuery}
                onSubmitEditing={handleDiscoverSearch}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity
              style={[styles.discoverBtn, { opacity: discoverQuery.trim() ? 1 : 0.45 }]}
              onPress={handleDiscoverSearch}
              disabled={!discoverQuery.trim()}
            >
              <Text style={styles.discoverBtnText}>{t("search", "Search")}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.topicChips, { flexDirection: isRtl ? "row-reverse" : "row" }]}>
            <Text style={[styles.topicLabel, { color: mutedColor }]}>{t("telegramFeed.popularTags", "Popular tags")}:</Text>
            {popularTags.map((topic) => (
              <TouchableOpacity
                key={topic}
                style={[
                  styles.topicChip,
                  { backgroundColor: cardBg, borderColor },
                  activeDiscoverQuery === topic && { borderColor: ACCENT, backgroundColor: th(darkMode, "rgba(37,99,235,0.15)", "rgba(37,99,235,0.08)") },
                ]}
                onPress={() => applySuggestion(topic)}
              >
                <Text style={[styles.topicChipText, { color: activeDiscoverQuery === topic ? ACCENT : textColor }]}>#{topic}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeDiscoverQuery ? (
            <Text style={[styles.hint, { color: mutedColor }]}>
              {t("telegramFeed.resultsFor", "Results for")}{" "}
              <Text style={{ fontWeight: "700", color: textColor }}>&ldquo;{activeDiscoverQuery}&rdquo;</Text>
            </Text>
          ) : null}
        </View>
      )}

      {posts.length > 0 ? (
        <Text style={[styles.postCount, { color: mutedColor, backgroundColor: tabsBg, alignSelf: isRtl ? "flex-start" : "flex-end" }]}>
          {posts.length} {t("telegramFeed.postsLoaded", "posts")}
        </Text>
      ) : null}
    </View>
  );

  const renderHeader = () => (
    <View>
      <View style={[styles.hero, { backgroundColor: heroBg, borderColor: heroBorder }]}>
        <View style={[styles.heroIcon, { backgroundColor: heroIconBg }]}>
          <Text style={{ fontSize: 28 }}>✈️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroTitle, { color: textColor }]}>{t("telegramFeed.title", "Special News")}</Text>
          <Text style={[styles.heroSubtitle, { color: mutedColor }]}>
            {t("telegramFeed.subtitle", "Telegram-only feed — topics you care about, across many channels")}
          </Text>
        </View>
      </View>

      <View style={[styles.tabs, { backgroundColor: tabsBg, flexDirection: isRtl ? "row-reverse" : "row" }]}>
        {TAB_META.map(({ id, icon, labelKey, defaultLabel }) => (
          <TouchableOpacity
            key={id}
            style={[
              styles.tab,
              tab === id && { backgroundColor: th(darkMode, dc.surface, "#fff"), shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
            ]}
            onPress={() => setTab(id)}
          >
            <Text style={{ fontSize: 14 }}>{icon}</Text>
            <Text style={[styles.tabText, { color: tab === id ? textColor : mutedColor }]}>{t(labelKey, defaultLabel)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderToolbar()}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t("telegramFeed.loadError", "Could not load Telegram posts.")}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setRefreshKey((k) => k + 1)}>
            <Text style={styles.retryBtnText}>{t("retry", "Retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showInitialSkeleton ? (
        <View>
          {[1, 2, 3].map((n) => <PostSkeleton key={n} darkMode={darkMode} />)}
        </View>
      ) : null}

      {showEmpty ? (
        <View style={[styles.empty, { borderColor, backgroundColor: th(darkMode, "rgba(255,255,255,0.02)", "rgba(0,0,0,0.02)") }]}>
          <Text style={{ fontSize: 32 }}>📭</Text>
          <Text style={[styles.emptyText, { color: mutedColor }]}>{t("telegramFeed.empty", "No Telegram posts found.")}</Text>
          {tab === TABS.FOR_YOU ? (
            <Text style={[styles.hint, { color: mutedColor, textAlign: "center" }]}>
              {t("telegramFeed.emptyForYou", "Read a few posts — we'll learn your topics and find similar channels.")}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const renderFooter = () => {
    if (!canLoadTab || posts.length === 0) return null;
    return (
      <View style={styles.scrollStatus}>
        {loading ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : (
          <Text style={{ color: mutedColor, fontSize: 14 }}>
            {hasMore ? t("scrollToLoad", "Scroll to load more") : t("noMorePosts", "No more posts")}
          </Text>
        )}
      </View>
    );
  };

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={styles.listContent}
      data={posts}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      renderItem={({ item }) => (
        <TelegramPostCard
          post={item}
          showChannelProfile={tab === TABS.DISCOVER}
          showMatchBadge={tab === TABS.FOR_YOU || tab === TABS.DISCOVER}
          onTagClick={tab === TABS.DISCOVER ? applySuggestion : undefined}
          isVisible={visibleIds.has(item.id)}
        />
      )}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 40 },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  heroIcon: { padding: 10, borderRadius: 12 },
  heroTitle: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  heroSubtitle: { fontSize: 14, lineHeight: 20 },
  tabs: { borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 9 },
  tabText: { fontSize: 13, fontWeight: "600" },
  toolbar: { gap: 10, marginBottom: 14 },
  hint: { fontSize: 14, lineHeight: 20 },
  panel: { gap: 10 },
  searchWrap: { position: "relative", justifyContent: "center" },
  searchIcon: { position: "absolute", fontSize: 14, opacity: 0.5, zIndex: 1 },
  searchInput: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, fontSize: 15 },
  selectedChannel: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  selectedLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  selectedName: { fontSize: 15, fontWeight: "600" },
  clearBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  channelList: { maxHeight: 240 },
  channelPick: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  channelAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  channelAvatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  channelPickName: { fontWeight: "600", fontSize: 15 },
  channelPickHandle: { fontSize: 12 },
  channelPickDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  channelSkel: { height: 56, borderRadius: 10 },
  discoverForm: { gap: 8, alignItems: "stretch" },
  discoverBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  discoverBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  topicChips: { flexWrap: "wrap", alignItems: "center", gap: 6 },
  topicLabel: { fontSize: 12, fontWeight: "500" },
  topicChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  topicChipText: { fontSize: 12 },
  postCount: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  errorBox: { padding: 16, borderRadius: 10, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", alignItems: "center", marginBottom: 14 },
  errorText: { color: "#b91c1c", fontSize: 14, marginBottom: 10 },
  retryBtn: { backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  retryBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  empty: { alignItems: "center", gap: 8, padding: 32, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", marginBottom: 14 },
  emptyText: { fontSize: 15 },
  scrollStatus: { paddingVertical: 20, alignItems: "center" },
});
