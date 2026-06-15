import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

export default function GuestSignupPrompt({ visible, action, onClose, onGoToLogin }) {
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modal, { backgroundColor: th(darkMode, dc.surface, "#fff") }]} onStartShouldSetResponder={() => true}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { right: isRtl ? undefined : 14, left: isRtl ? 14 : undefined }]}>
            <Text style={[styles.closeText, { color: th(darkMode, dc.muted, "#6e869a") }]}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.icon}>🔒</Text>
          <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("signIn")} {action}</Text>
          <Text style={[styles.text, { color: th(darkMode, dc.muted, "#6e869a") }]}>
            {t("noSavedDescription")}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => onGoToLogin("login")}>
              <Text style={styles.primaryBtnText}>{t("signIn")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: th(darkMode, dc.subtle, "#f5f8fd"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={() => onGoToLogin("signup")}>
              <Text style={[styles.secondaryBtnText, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("signUp")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={onClose}>
              <Text style={[styles.ghostBtnText, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "85%",
    maxWidth: 360,
    alignItems: "center",
    elevation: 8,
    boxShadow: "0 10px 32px rgba(11,26,43,0.15), 0 4px 12px rgba(11,26,43,0.08)",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 14,
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: "#6e869a",
  },
  icon: {
    fontSize: 36,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0b1a2b",
    marginBottom: 8,
    textAlign: "center",
  },
  text: {
    fontSize: 14,
    color: "#6e869a",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  actions: {
    width: "100%",
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryBtn: {
    backgroundColor: "#f5f8fd",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  secondaryBtnText: {
    color: "#0b1a2b",
    fontSize: 15,
    fontWeight: "600",
  },
  ghostBtn: {
    alignItems: "center",
    padding: 10,
  },
  ghostBtnText: {
    color: "#6e869a",
    fontSize: 14,
    fontWeight: "600",
  },
});