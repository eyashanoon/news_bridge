import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, ScrollView } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function LeftSidebar({ visible, onClose, navigationRef }) {
  const { setMenuOpen, darkMode } = useTheme();
  const { t } = useTranslation();

  const handleClose = () => {
    setMenuOpen(false);
    onClose?.();
  };

  const navigateTo = (screen) => {
    handleClose();
    navigationRef?.current?.navigate(screen);
  };

  return (
    <>
      {visible && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View />
        </TouchableOpacity>
      )}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: visible ? 0 : -SCREEN_WIDTH * 0.75 }],
            backgroundColor: th(darkMode, dc.surface, "#fff"),
            borderRightColor: th(darkMode, dc.border, "#e2e8f0"),
          },
        ]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <View style={[styles.header, { borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
          <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("Settings")}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={[styles.closeText, { color: th(darkMode, dc.muted, "#64748b") }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body}>
          {/* Navigation */}
          <View style={[styles.section, { borderBottomColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo("NewsFeed")}>
              <Text style={styles.navIcon}>📰</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("feedTitle")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo("TrendingTopics")}>
              <Text style={styles.navIcon}>🔥</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("trending")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo("SavedNews")}>
              <Text style={styles.navIcon}>💾</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("savedNews")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo("AIAssistant")}>
              <Text style={styles.navIcon}>🤖</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("aiAssistant")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo("ApplyEditor")}>
              <Text style={styles.navIcon}>✍️</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("applyEditor")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo("AdvancedSearch")}>
              <Text style={styles.navIcon}>🔍</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("advancedFilters")}</Text>
            </TouchableOpacity>
          </View>

          {/* Profile */}
          <View style={[styles.section, { borderBottomColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
            <TouchableOpacity style={styles.navItem} onPress={() => navigateTo("Profile")}>
              <Text style={styles.navIcon}>👤</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("profileInfo")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem}>
              <Text style={styles.navIcon}>🔔</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("notifications")}</Text>
            </TouchableOpacity>
          </View>

          {/* Auth */}
          <View style={[styles.section, { borderBottomColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigateTo("Auth")}
            >
              <Text style={styles.navIcon}>🔑</Text>
              <Text style={[styles.navText, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("signIn")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 90,
  },
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.75,
    maxWidth: 320,
    backgroundColor: "#fff",
    zIndex: 91,
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    boxShadow: "2px 0 20px rgba(0,0,0,0.08)",
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0b1a2b" },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 18, color: "#64748b" },
  body: { flex: 1, paddingTop: 8 },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  navIcon: { fontSize: 18 },
  navText: { fontSize: 15, fontWeight: "600", color: "#334155" },
});