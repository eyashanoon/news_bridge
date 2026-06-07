import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Post from "./Post";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { API_CONFIG } from "../api/config";
import { useTranslation } from "react-i18next";

export default function Feed({ category, onAskAI, onPostPress, navigation }) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async (reset = false) => {
    if (loading) return;

    try {
      setLoading(true);
      await ensureUserInitialized();
      const userId = await getUserId();
      const savedLocation = await AsyncStorage.getItem("user_location");

      const currentPage = reset ? 0 : page;
      let url = `${API_CONFIG.baseURL}/api/feed?userId=${userId}&category=${category}&limit=10&page=${currentPage}`;

      if (savedLocation) {
        const loc = JSON.parse(savedLocation);
        if (loc?.lat && loc?.lon) {
          url += `&lat=${loc.lat}&lon=${loc.lon}`;
        }
      }

      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data = await res.json();

      if (data.length === 0) {
        setHasMore(false);
        return;
      }

      if (reset) {
        setPosts(data);
        setPage(1);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filtered = data.filter(p => !existingIds.has(p.id));
          return [...prev, ...filtered];
        });
        setPage(prev => prev + 1);
      }
    } catch (err) {
      console.error("Feed fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [category, page, loading]);

  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
    fetchPosts(true);
  }, [category]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPosts([]);
    setPage(0);
    setHasMore(true);
    await fetchPosts(true);
    setRefreshing(false);
  }, [category]);

  const renderPost = useCallback(({ item }) => (
    <Post post={item} onAskAI={onAskAI} onPress={onPostPress} />
  ), [onAskAI, onPostPress]);

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
      keyExtractor={item => String(item.id)}
      onEndReached={() => hasMore && !loading && fetchPosts()}
      onEndReachedThreshold={0.3}
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
