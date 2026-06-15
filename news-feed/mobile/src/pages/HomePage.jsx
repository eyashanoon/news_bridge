import { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TopBar from "../components/TopBar";
import CategoryBar from "../components/CategoryBar";
import Feed from "../components/Feed";
import PostModal from "../components/PostModal";
import { useTheme } from "../context/ThemeContext";
import { categoryTheme } from "../utils/categoryColors";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";
import { categoryFromSlug, slugFromCategory, FEED_CATEGORY_KEY } from "../utils/categoryUtils";

export default function HomePage({ navigation, route }) {
  const { currentCategory, setCurrentCategory, darkMode, feedRefreshKey } = useTheme();
  const { i18n } = useTranslation();
  const [modalPost, setModalPost] = useState(null);
  const [categoryReady, setCategoryReady] = useState(false);
  const isRtl = i18n.language === "ar";

  const theme = categoryTheme[currentCategory]?.light || categoryTheme.General.light;

  // Resolve category from deep link, then persisted storage — same priority as web URL
  useEffect(() => {
    let cancelled = false;
    const resolveCategory = async () => {
      if (route.params?.category) {
        const fromRoute = categoryFromSlug(route.params.category);
        if (!cancelled) {
          setCurrentCategory(fromRoute);
          await AsyncStorage.setItem(FEED_CATEGORY_KEY, JSON.stringify(fromRoute));
          setCategoryReady(true);
        }
        return;
      }
      try {
        const saved = await AsyncStorage.getItem(FEED_CATEGORY_KEY);
        const parsed = saved ? JSON.parse(saved) : "General";
        if (!cancelled) {
          setCurrentCategory(parsed || "General");
          setCategoryReady(true);
        }
      } catch {
        if (!cancelled) {
          setCurrentCategory("General");
          setCategoryReady(true);
        }
      }
    };
    resolveCategory();
    return () => { cancelled = true; };
  }, [route.params?.category, setCurrentCategory]);

  const handleCategoryChange = useCallback(async (cat) => {
    setCurrentCategory(cat);
    await AsyncStorage.setItem(FEED_CATEGORY_KEY, JSON.stringify(cat));
    navigation.setParams({ category: slugFromCategory(cat) });
  }, [navigation, setCurrentCategory]);

  const initialPostId = route?.params?.openPostId;

  if (!categoryReady) {
    return <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg) }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} backgroundColor={th(darkMode, "#0f172a", theme.bg)} />
      <TopBar navigation={navigation} />
      <CategoryBar category={currentCategory} setCategory={handleCategoryChange} />
      <Feed
        key={`${currentCategory}-${feedRefreshKey}`}
        category={currentCategory}
        refreshKey={feedRefreshKey}
        onAskAI={(post) => navigation.navigate("AIAssistant", { selectedPost: post, category: currentCategory })}
        onPostPress={setModalPost}
      />
      <PostModal post={modalPost} visible={!!modalPost} onClose={() => setModalPost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
