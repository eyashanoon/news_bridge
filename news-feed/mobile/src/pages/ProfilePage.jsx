import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import TopBar from "../components/TopBar";
import { useSession } from "../context/SessionContext";
import { api, authConfig } from "../api/api";
import { getToken } from "../utils/auth";
import { useTheme } from "../context/ThemeContext";
import { categoryTheme } from "../utils/categoryColors";
import { API_CONFIG } from "../api/config";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

const DEFAULT_USER_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='100%25' height='100%25' fill='%232f3b4f'/><circle cx='75' cy='52' r='25' fill='%2394a3b8'/><rect x='30' y='90' width='90' height='40' rx='20' fill='%2364748b'/></svg>";
const DEFAULT_EDITOR_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='100%25' height='100%25' fill='%231f2937'/><circle cx='75' cy='52' r='25' fill='%2334d399'/><rect x='30' y='90' width='90' height='40' rx='20' fill='%2310b981'/></svg>";

function resolveAvatar(src, isEditor = false) {
  if (src && src.trim()) return src;
  return isEditor ? DEFAULT_EDITOR_AVATAR : DEFAULT_USER_AVATAR;
}

export default function ProfilePage({ navigation, route }) {
  const { currentCategory, darkMode } = useTheme();
  const theme = categoryTheme[currentCategory]?.light || categoryTheme.General.light;
  const { session } = useSession();
  const { t, i18n } = useTranslation();
  const username = route?.params?.username || null;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const [editForm, setEditForm] = useState({
    fullName: "",
    bio: "",
    profilePicture: "",
    coverImage: "",
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const isOwnProfile = session && (session.email === profile?.email || session.userId === String(profile?.id));
  const isEditor = profile?.fields !== undefined || profile?.experience !== undefined;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = username ? `/api/profile/${encodeURIComponent(username)}` : "/api/profile";
      const token = session?.token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.get(endpoint, { headers });
      setProfile(res.data);
      setEditForm({
        fullName: res.data.fullName || "",
        bio: res.data.bio || "",
        profilePicture: res.data.profilePicture || "",
        coverImage: res.data.coverImage || "",
      });
    } catch (err) {
      setError(err.response?.data?.message || t("profileLoadError"));
    } finally {
      setLoading(false);
    }
  }, [username, session?.token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const pickAndUploadImage = async (type) => {
    const isAvatar = type === "avatar";
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please grant gallery access to upload images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: isAvatar ? [1, 1] : [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      if (isAvatar) setUploadingAvatar(true); else setUploadingCover(true);

      // Use base64 data URI directly (avoids RN FormData upload bug)
      const dataUri = `data:${file.mimeType || "image/jpeg"};base64,${file.base64}`;
      setEditForm((prev) => ({
        ...prev,
        [isAvatar ? "profilePicture" : "coverImage"]: dataUri,
      }));
    } catch (err) {
      Alert.alert("Upload failed", err.message || "Failed to upload image");
    } finally {
      if (isAvatar) setUploadingAvatar(false); else setUploadingCover(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const token = session?.token;
      const cfg = authConfig(token);
      const res = await api.put("/api/profile", editForm, cfg);
      setProfile(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    }
  };

  const isRtl = i18n.language === "ar";

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
           <Text style={[styles.loadingText, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("profileLoading")}</Text>
        </View>
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={styles.errorContainer}>
           <Text style={[styles.errorTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("profileNotFound")}</Text>
           <Text style={[styles.errorDesc, { color: th(darkMode, dc.textSecondary, "#ef4444") }]}>{error}</Text>
           <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
             <Text style={styles.backBtnText}>{t("goBack")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!profile) return null;

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, "#f8fafc"), direction: isRtl ? "rtl" : "ltr" }]}>
      <TopBar navigation={navigation} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, isEditor ? styles.editorHeader : styles.userHeader]}>
          <View style={[styles.coverBg, { backgroundColor: th(darkMode, dc.subtle, "#e2e8f0") }, editForm.coverImage ? { backgroundColor: "transparent" } : {}]}>
            {editForm.coverImage ? (
              <Image source={{ uri: editForm.coverImage }} style={styles.coverImage} />
            ) : null}
          </View>
          <View style={styles.headerContent}>
            <View style={styles.avatarSection}>
              <Image
                source={{ uri: resolveAvatar(profile.profilePicture, isEditor) }}
                style={[styles.avatar, { borderColor: th(darkMode, dc.surface, "#fff") }]}
              />
              <View style={[styles.badge, isEditor ? styles.editorBadge : styles.userBadge]}>
                 <Text style={styles.badgeText}>{isEditor ? t("editorBadge") : t("memberBadge")}</Text>
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{profile.fullName || profile.username}</Text>
              <Text style={[styles.profileUsername, { color: th(darkMode, dc.muted, "#6e869a") }]}>@{profile.username}</Text>
              {profile.email && <Text style={[styles.profileEmail, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>📧 {profile.email}</Text>}
            </View>
          </View>
        </View>

        {/* Bio */}
        <View style={[styles.card, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
           <Text style={[styles.cardTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("about")}</Text>
           <Text style={[styles.bioText, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{profile.bio || t("noBio")}</Text>
        </View>

        {/* Personal Info */}
        <View style={[styles.card, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
           <Text style={[styles.cardTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("personalInfo")}</Text>
           <View style={styles.detailsGrid}>
             <View style={styles.detailItem}>
               <Text style={[styles.detailLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("fullName")}</Text>
               <Text style={[styles.detailValue, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{profile.fullName || t("notSet")}</Text>
             </View>
             <View style={styles.detailItem}>
               <Text style={[styles.detailLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("username")}</Text>
              <Text style={[styles.detailValue, { color: th(darkMode, dc.textSecondary, "#334155") }]}>@{profile.username}</Text>
            </View>
          </View>
        </View>

        {/* Editor Info */}
        {isEditor && (
          <View style={[styles.card, styles.editorCard, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
             <Text style={[styles.cardTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>📰 {t("editorInfo")}</Text>
             <View style={styles.detailsGrid}>
               <View style={styles.detailItem}>
                 <Text style={[styles.detailLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("experience")}</Text>
                 <Text style={[styles.detailValue, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{profile.experience || t("notSpecified")}</Text>
               </View>
               <View style={styles.detailItem}>
                 <Text style={[styles.detailLabel, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("fields")}</Text>
                 <Text style={[styles.detailValue, { color: th(darkMode, dc.textSecondary, "#334155") }]}>
                   {profile.fields?.length > 0 ? profile.fields.map(f => f.name).join(", ") : t("notSpecified")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Edit Button */}
        {isOwnProfile && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
             <Text style={styles.editBtnText}>✏️ {t("editProfile")}</Text>
          </TouchableOpacity>
        )}

        {error && <Text style={styles.errorMsg}>{error}</Text>}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditing(false)}>
          <View style={[styles.modalContent, { backgroundColor: th(darkMode, dc.surface, "#fff") }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.modalHeader, { borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
               <Text style={[styles.modalTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>✏️ {t("editProfile")}</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={[styles.modalClose, { color: th(darkMode, dc.muted, "#94a3b8") }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {/* Profile Picture */}
               <Text style={[styles.inputLabel, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("profilePicture")}</Text>
              <TouchableOpacity
                style={[styles.imagePickerBtn, { backgroundColor: th(darkMode, dc.subtle, "#f1f5f9"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}
                onPress={() => pickAndUploadImage("avatar")}
                disabled={uploadingAvatar}
              >
                <Text style={[styles.imagePickerBtnText, { color: th(darkMode, dc.textSecondary, "#3b82f6") }]}>
                   {uploadingAvatar ? t("uploading") : "📷 " + t("chooseImage")}
                </Text>
              </TouchableOpacity>
              {editForm.profilePicture ? (
                <View style={styles.previewRow}>
                  <Image source={{ uri: editForm.profilePicture }} style={[styles.previewImage, { backgroundColor: th(darkMode, dc.subtle, "#f1f5f9") }]} />
                  <TouchableOpacity onPress={() => setEditForm((p) => ({ ...p, profilePicture: "" }))}>
                    <Text style={styles.removeBtn}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TextInput
                style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                placeholder="Or paste image URL..."
                placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                value={editForm.profilePicture}
                onChangeText={(v) => setEditForm((p) => ({ ...p, profilePicture: v }))}
              />

              {/* Cover Image */}
               <Text style={[styles.inputLabel, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("coverImage")}</Text>
              <TouchableOpacity
                style={[styles.imagePickerBtn, { backgroundColor: th(darkMode, dc.subtle, "#f1f5f9"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}
                onPress={() => pickAndUploadImage("cover")}
                disabled={uploadingCover}
              >
                <Text style={[styles.imagePickerBtnText, { color: th(darkMode, dc.textSecondary, "#3b82f6") }]}>
                   {uploadingCover ? t("uploading") : "🖼️ " + t("chooseCover")}
                </Text>
              </TouchableOpacity>
              {editForm.coverImage ? (
                <View style={styles.previewRow}>
                  <Image source={{ uri: editForm.coverImage }} style={[styles.previewImage, styles.coverPreview, { backgroundColor: th(darkMode, dc.subtle, "#f1f5f9") }]} />
                  <TouchableOpacity onPress={() => setEditForm((p) => ({ ...p, coverImage: "" }))}>
                    <Text style={styles.removeBtn}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TextInput
                style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                placeholder="Or paste cover image URL..."
                placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                value={editForm.coverImage}
                onChangeText={(v) => setEditForm((p) => ({ ...p, coverImage: v }))}
              />

              {/* Full Name */}
               <Text style={[styles.inputLabel, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("fullName")}</Text>
               <TextInput
                 style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                 placeholder={t("yourFullName")}
                placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                value={editForm.fullName}
                onChangeText={(v) => setEditForm((p) => ({ ...p, fullName: v }))}
              />

              {/* Bio */}
               <Text style={[styles.inputLabel, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("about")}</Text>
               <TextInput
                 style={[styles.input, styles.textarea, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                 placeholder={t("tellUsAboutYourself")}
                placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                value={editForm.bio}
                onChangeText={(v) => setEditForm((p) => ({ ...p, bio: v }))}
                multiline
                numberOfLines={4}
              />

              {error ? <Text style={styles.errorMsg}>{error}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={() => setEditing(false)}>
                   <Text style={[styles.cancelBtnText, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>{t("cancel")}</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
                   <Text style={styles.saveBtnText}>{t("saveChanges")}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  errorDesc: { fontSize: 15, marginBottom: 20, textAlign: "center" },
  backBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  backBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Header
  profileHeader: { position: "relative", paddingBottom: 16 },
  userHeader: {},
  editorHeader: {},
  coverBg: { height: 120 },
  coverImage: { width: "100%", height: 120 },
  headerContent: { flexDirection: "row", paddingHorizontal: 16, marginTop: -40 },
  avatarSection: { alignItems: "center", marginRight: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3 },
  badge: { marginTop: -10, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 },
  editorBadge: { backgroundColor: "#059669" },
  userBadge: { backgroundColor: "#2563eb" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff", textTransform: "uppercase" },
  profileInfo: { flex: 1, paddingTop: 48 },
  profileName: { fontSize: 22, fontWeight: "800" },
  profileUsername: { fontSize: 15, marginTop: 2 },
  profileEmail: { fontSize: 14, marginTop: 4 },

  // Cards
  card: { borderRadius: 12, marginHorizontal: 16, marginTop: 12, padding: 16, borderWidth: 1 },
  editorCard: { borderLeftWidth: 4, borderLeftColor: "#059669" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  bioText: { fontSize: 15, lineHeight: 22 },
  detailsGrid: { gap: 12 },
  detailItem: {},
  detailLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", marginBottom: 2 },
  detailValue: { fontSize: 15 },

  // Edit button
  editBtn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginHorizontal: 16, marginTop: 16 },
  editBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  errorMsg: { fontSize: 14, color: "#ef4444", marginTop: 8, textAlign: "center", marginHorizontal: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { borderRadius: 16, width: "100%", maxHeight: "80%", overflow: "hidden" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalClose: { fontSize: 20, padding: 4 },
  modalScroll: { padding: 16 },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 4 },
  imagePickerBtn: { flexDirection: "row", alignItems: "center", borderRadius: 8, padding: 12, borderWidth: 1, borderStyle: "dashed", marginBottom: 8 },
  imagePickerBtnText: { fontSize: 14, fontWeight: "600", flex: 1 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  previewImage: { width: 60, height: 60, borderRadius: 8 },
  coverPreview: { width: 120, height: 60 },
  removeBtn: { fontSize: 13, fontWeight: "600", color: "#ef4444", padding: 4 },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "600" },
  saveBtn: { flex: 1, backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});