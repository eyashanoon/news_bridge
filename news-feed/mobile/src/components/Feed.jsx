import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Post from "./Post";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { API_CONFIG } from "../api/config";
import { useTranslation } from "react-i18next";

export default function Feed({ category, onAskAI, onPostPress, refreshKey = 0 }) {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGenRef = useRef(0);
  const [visibleIds, setVisibleIds] = useState(() => new Set());

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const next = new Set(viewableItems.filter((v) => v.isViewable).map((v) => v.item.id));
    setVisibleIds(next);
  }).current;

  const fetchPosts = useCallback(async (pageToFetch, reset = false) => {
    const gen = fetchGenRef.current;

    try {
      setLoading(true);
      await ensureUserInitialized();
      const userId = await getUserId();
      const savedLocation = await AsyncStorage.getItem("user_location");

      let url = `${API_CONFIG.baseURL}/api/feed?userId=${userId}&category=${encodeURIComponent(category)}&limit=10&page=${pageToFetch}&lang=${encodeURIComponent(i18n.resolvedLanguage || i18n.language || "en")}`;

      if (savedLocation) {
        const loc = JSON.parse(savedLocation);
        if (loc?.lat != null && loc?.lon != null) {
          url += `&lat=${loc.lat}&lon=${loc.lon}`;
        }
      }

      const res = await apiFetch(url);
      if (gen !== fetchGenRef.current) return;
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data = await res.json();
      if (gen !== fetchGenRef.current) return;

      if (data.length === 0) {
        setHasMore(false);
        return;
      }

      if (reset) {
        setPosts(data);
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const filtered = data.filter((p) => !existingIds.has(p.id));
          return [...prev, ...filtered];
        });
      }
      setPage(pageToFetch + 1);
    } catch (err) {
      console.error("Feed fetch error:", err);
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  }, [category, i18n.language]);

  useEffect(() => {
    fetchGenRef.current += 1;
    setPosts([]);
    setPage(0);
    setHasMore(true);
    fetchPosts(0, true);
  }, [category, i18n.language, refreshKey, fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchGenRef.current += 1;
    setPosts([]);
    setPage(0);
    setHasMore(true);
    await fetchPosts(0, true);
    setRefreshing(false);
  }, [fetchPosts]);

  const renderPost = useCallback(({ item }) => (
    <Post
      post={item}
      isVisible={visibleIds.has(item.id)}
      onAskAI={onAskAI}
      onPress={onPostPress}
    />
  ), [onAskAI, onPostPress, visibleIds]);

  const renderFooter = () => {
    if (loading) {
      return <ActivityIndicator style={styles.loader} size="small" color="#64748b" />;
    }
    if (!hasMore) {
      return <Text style={styles.endText}>{t("noMorePosts")}</Text>;
    }
    return null;
  };

  return (
    <FlatList
      data={posts}
      renderItem={renderPost}
      keyExtractor={(item) => String(item.id)}
      onEndReached={() => hasMore && !loading && fetchPosts(page, false)}
      onEndReachedThreshold={0.3}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      ListFooterComponent={renderFooter}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  loader: { padding: 24 },
  endText: { textAlign: "center", padding: 24, color: "#6e869a", fontSize: 14, fontWeight: "500" },
});
