import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import TopBar from "../components/TopBar";
import TopicCard from "../components/TopicCard";
import { fetchTopics, getMyTopics } from "../api/topicsApi";
import { useTheme } from "../context/ThemeContext";
import { categoryTheme } from "../utils/categoryColors";
import { getSessionFromToken } from "../utils/auth";
import { getToken } from "../utils/auth";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

export default function TrendingTopicsPage({ navigation }) {
  const { currentCategory, darkMode } = useTheme();
  const { t } = useTranslation();
  const theme = categoryTheme[currentCategory]?.light || categoryTheme.General.light;
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const token = getToken();
    const session = token ? getSessionFromToken(token) : null;
    const isEditor = !!(session && session.type === "EDITOR" && (
      session.roles?.includes("PUBLISH_LIVE_NEWS") || session.roles?.includes("EDIT_LIVE_NEWS")
    ));

    const load = isEditor ? getMyTopics() : fetchTopics();
    load.then((data) => {
      if (mounted) {
        setTopics(data);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, []);

  const openTopicDetails = (id) => {
    navigation.navigate("TopicDetails", { topicId: id });
  };

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg) }]}>
      <TopBar navigation={navigation} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>🔥 {t("trendingTopicsTitle")}</Text>
          <Text style={[styles.headerDesc, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("trendingTopicsDesc")}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>{t("topicsLoading")}</Text>
          </View>
        ) : topics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t("noTrendingTopics")}</Text>
          </View>
        ) : (
          topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onViewTopic={openTopicDetails}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0b1a2b",
    marginBottom: 6,
  },
  headerDesc: {
    fontSize: 15,
    color: "#6e869a",
    lineHeight: 22,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#6e869a",
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#94a3b8",
  },
});