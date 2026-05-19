import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  StatusBar,
} from "react-native";
import { useTranslation } from "react-i18next";
import { fetchFeedPosts } from "../api/feedApi";
import { colors, darkColors } from "../theme/colors";
import PostCard from "../components/PostCard";
import CategoryBar from "../components/CategoryBar";
import LanguageToggle from "../components/LanguageToggle";
import SideMenu from "../components/SideMenu";
import SavedNewsScreen from "./SavedNewsScreen";
import { ensureUserInitialized } from "../api/auth";
import { useTheme } from "../context/ThemeContext";

export default function FeedScreen() {
  const { t, i18n } = useTranslation();
  const { darkMode, toggleDarkMode } = useTheme();
  const isArabic = i18n.language === "ar";
  const themeColors = darkMode ? darkColors : colors;
  const rtl = isArabic ? "rtl" : "ltr";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState("");
  const [category, setCategory] = useState("General");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  // Track language changes to force full re-mount of feed content
  const [langKey, setLangKey] = useState(i18n.language);
  // Side menu state
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [activePage, setActivePage] = useState("HOME");

  const lastScrollY = useRef(0);
  const [showHeaderBar, setShowHeaderBar] = useState(true);

  // Force key change when language changes — this re-mounts everything
  useEffect(() => {
    const handleLangChange = (lng) => {
      setLangKey(lng);
    };
    i18n.on("languageChanged", handleLangChange);
    return () => {
      i18n.off("languageChanged", handleLangChange);
    };
  }, [i18n]);

  // Initialize auth on mount
  useEffect(() => {
    ensureUserInitialized().then(() => setAuthReady(true)).catch(() => setAuthReady(true));
  }, []);

  async function loadFeed(reset = false) {
    try {
      if (!authReady) await ensureUserInitialized();

      if (reset) {
        setLoading(true);
        setPosts([]);
        setPage(0);
        setHasMore(true);
        setErr("");
      } else {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
      }

      const currentPage = reset ? 0 : page;
      const data = await fetchFeedPosts({ category, page: currentPage, limit: 10 });

      if (reset) {
        setPosts(data);
        setPage(1);
      } else {
        if (data.length === 0) {
          setHasMore(false);
          return;
        }
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id || p.postId));
          const filtered = data.filter((p) => !existingIds.has(p.id || p.postId));
          return [...prev, ...filtered];
        });
        setPage((prev) => prev + 1);
      }

      if (data.length < 10) {
        setHasMore(false);
      }
    } catch (e) {
      console.error("Feed fetch error:", e.message);
      if (reset) setErr(t("errorLoading"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (authReady) loadFeed(true);
  }, [category, authReady]);

  const handleScroll = useCallback((event) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    if (diff > 10 && showHeaderBar) {
      setShowHeaderBar(false);
    } else if (diff < -10 && !showHeaderBar) {
      setShowHeaderBar(true);
    }

    lastScrollY.current = currentY;
  }, [showHeaderBar]);

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={styles.footerText}>{t("loading")}</Text>
        </View>
      );
    }
    if (!hasMore && posts.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>{t("noMorePosts")}</Text>
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>{t("noPostsInCategory")}</Text>
      </View>
    );
  };

  // Entire content tree re-mounts on language change via key={langKey}
  // direction style prop handles RTL/LTR at the layout level
  return (
    <View key={langKey} style={[styles.container, { backgroundColor: themeColors.bg, direction: rtl, writingDirection: rtl }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      {/* Top Header Bar */}
      <View style={[styles.headerBar, { backgroundColor: darkMode ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.72)", borderBottomColor: themeColors.borderLight, direction: rtl, writingDirection: rtl }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setSideMenuVisible(true)}
              style={[styles.menuButton, { borderColor: themeColors.borderLight }]}
            >
              <Text style={[styles.menuButtonText, { color: themeColors.text }]}>≡</Text>
            </TouchableOpacity>
            <View style={[styles.logoContainer, { direction: isArabic ? "rtl" : "ltr" }]}>
              <Text style={[styles.logoText, { color: darkMode ? "#60a5fa" : "#2563eb" }]}>{isArabic ? "جسر" : "News"}</Text>
              <Text style={[styles.logoTextAccent, { color: darkMode ? "#a78bfa" : "#7c3aed" }]}>{isArabic ? "الأخبار" : "Bridge"}</Text>
              <Text style={styles.logoTm}>™</Text>
            </View>
          </View>
          <View style={[styles.headerRight, { flexShrink: 0 }]}>
            <TouchableOpacity onPress={toggleDarkMode} style={[styles.themeToggle, { borderColor: themeColors.borderLight, backgroundColor: themeColors.surface }]}>
              <Text style={styles.themeToggleIcon}>{darkMode ? "☀️" : "🌙"}</Text>
            </TouchableOpacity>
            <LanguageToggle />
          </View>
        </View>
        <Text
          style={[
            styles.pageTitle,
            { color: themeColors.muted },
            isArabic && { textAlign: "right" },
          ]}
        >
          {t("feedTitle")}
        </Text>
      </View>

      {activePage !== "SAVED" && (
        <CategoryBar category={category} setCategory={setCategory} />
      )}

      {loading && posts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Text style={styles.error}>{err}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadFeed(true)}>
            <Text style={styles.retryText}>{t("retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : activePage === "SAVED" ? (
        <SavedNewsScreen onClose={() => setActivePage("HOME")} />
      ) : (
        <>
        <FlatList
          style={styles.listContainer}
          contentContainerStyle={styles.list}
          data={posts}
          keyExtractor={(item, index) =>
            item.id?.toString() || item.postId?.toString() || index.toString()
          }
          renderItem={({ item }) => (
            <PostCard post={item} lang={i18n.language} />
          )}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={() => loadFeed(false)}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
        />
        <SideMenu
          visible={sideMenuVisible}
          onClose={() => setSideMenuVisible(false)}
          activePage={activePage}
          onNavigate={setActivePage}
          onLocationChange={() => loadFeed(true)}
        />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerBar: {
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  menuButtonText: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: -2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  logoText: {
    fontFamily: "Plus Jakarta Sans",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  logoTextAccent: {
    fontFamily: "Plus Jakarta Sans",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  logoTm: {
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10,
    fontWeight: "400",
    color: colors.muted,
    marginLeft: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  themeToggleIcon: {
    fontSize: 18,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 14,
  },
  error: {
    color: "#b91c1c",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 12,
    borderRadius: 12,
    fontWeight: "700",
    marginHorizontal: 20,
    textAlign: "center",
    fontSize: 14,
  },
  retryBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowColor: colors.brand,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
  },
  list: {
    padding: 14,
    paddingBottom: 30,
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  footerText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 13,
  },
  footerEnd: {
    paddingVertical: 24,
    alignItems: "center",
  },
  footerEndText: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 13,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
  },
});