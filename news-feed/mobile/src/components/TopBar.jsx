import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

function SettingsModal({ visible, onClose, navigation }) {
  const { darkMode, toggleDarkMode } = useTheme();
  const { session, logout } = useSession();
  const { t, i18n } = useTranslation();
  const switchLang = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
  };

  const handleLogout = async () => {
    await logout();
    onClose();
    navigation?.navigate("Auth");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.settingsDropdown, { backgroundColor: th(darkMode, dc.surface, "#fff") }]}>
          <Text style={[styles.settingsTitle, { color: th(darkMode, dc.text, "#0b1a2b"), borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>{t("Settings")}</Text>

          {/* Dark Mode */}
          <TouchableOpacity style={styles.settingsRow} onPress={toggleDarkMode}>
            <Text style={styles.settingsIcon}>{darkMode ? "☀️" : "🌙"}</Text>
            <Text style={[styles.settingsLabel, { color: th(darkMode, dc.textSecondary, "#334155") }]}>
              {darkMode ? t("switchToLight") : t("switchToDark")}
            </Text>
            <View style={[styles.toggle, darkMode && styles.toggleActive]}>
              <View style={[styles.toggleKnob, darkMode && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>

          {/* Language */}
          <TouchableOpacity style={styles.settingsRow} onPress={switchLang}>
            <Text style={styles.settingsIcon}>🌐</Text>
            <Text style={[styles.settingsLabel, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("language")}</Text>
            <Text style={[styles.settingsValue, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{i18n.language === "en" ? "English" : "العربية"}</Text>
          </TouchableOpacity>

          {/* Sign Out */}
          {(session?.type === "REGISTERED" || session?.type === "EDITOR") && (
            <TouchableOpacity style={[styles.settingsRow, styles.logoutRow]} onPress={handleLogout}>
              <Text style={styles.settingsIcon}>🚪</Text>
              <Text style={[styles.settingsLabel, { color: "#ef4444" }]}>{t("signOut")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function TopBar({ navigation }) {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const { session } = useSession();
  const { setMenuOpen, darkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const isLimited = session?.type === "PRIMITIVE" || !session?.type;
  const isRegistered = session?.type === "REGISTERED";
  const isEditor = session?.type === "EDITOR";
  const userTypeLabel = isLimited ? t("guest") : isRegistered ? t("registered") : isEditor ? t("editor") : "";

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top + 10, height: insets.top + 40, paddingBottom: insets.bottom + 10, backgroundColor: th(darkMode, dc.bg, "rgba(255,255,255,0.92)"), borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
        <View style={styles.inner}>
          {/* Hamburger + Logo */}
          <View style={styles.left}>
            <TouchableOpacity onPress={() => setMenuOpen(true)} style={[styles.menuBtn, { backgroundColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
              <Text style={[styles.menuIcon, { color: th(darkMode, dc.textSecondary, "#334155") }]}>☰</Text>
            </TouchableOpacity>
            <Text style={[styles.logo, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("appName")}</Text>
          </View>

          {/* User Type Badge - tap to open profile if signed in, or login if guest */}
          <TouchableOpacity onPress={() => navigation?.navigate(isLimited ? "Auth" : "Profile")} style={[styles.badge, { backgroundColor: isEditor ? "#059669" : "#2563eb" }]}>
            <Text style={styles.badgeText}>{userTypeLabel}</Text>
          </TouchableOpacity>

          {/* Gear Settings */}
          <TouchableOpacity onPress={() => setSettingsVisible(true)} style={[styles.gearBtn, { backgroundColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
            <Text style={styles.gearIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        navigation={navigation}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 16,
    justifyContent: "flex-end",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 38,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  menuIcon: { fontSize: 20, color: "#334155" },
  logo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0b1a2b",
    letterSpacing: -0.02,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.05,
    color: "#fff",
  },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  gearIcon: { fontSize: 18 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 100,
    paddingRight: 16,
  },
  settingsDropdown: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    width: 220,
    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
    elevation: 8,
    gap: 4,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0b1a2b",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 10,
  },
  settingsIcon: { fontSize: 18 },
  settingsLabel: { fontSize: 14, fontWeight: "600", color: "#334155", flex: 1 },
  settingsValue: { fontSize: 13, color: "#94a3b8" },
  logoutRow: { marginTop: 4 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#cbd5e1",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: "#2563eb" },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    elevation: 2,
  },
  toggleKnobActive: { alignSelf: "flex-end" },
});