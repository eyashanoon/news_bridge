import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import TopBar from "../components/TopBar";
import { useSession } from "../context/SessionContext";
import { api, authConfig } from "../api/api";
import { fetchFieldsHierarchical } from "../api/topicsApi";
import { useTheme } from "../context/ThemeContext";
import { categoryTheme } from "../utils/categoryColors";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

export default function ApplyEditorPage({ navigation }) {
  const { session, setNotice, updateToken } = useSession();
  const { currentCategory, darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const theme = categoryTheme[currentCategory]?.light || categoryTheme.General.light;
  const isRtl = i18n.language === "ar";

  const token = session?.token;
  const email = session?.email;
  const isPrimitive = session?.type === "PRIMITIVE" || (!session?.type && token);
  const isEditor = session?.type === "EDITOR";

  const [myRequests, setMyRequests] = useState([]);
  const [upgrading, setUpgrading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    experience: "",
    motivation: "",
    sampleWork: "",
    references: "",
    phone: "",
    profilePicture: "",
    attachments: "",
  });

  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [selectedGeneralId, setSelectedGeneralId] = useState(null);
  const [generalFields, setGeneralFields] = useState([]);

  // Fetch fields
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchFieldsHierarchical()
      .then((data) => { setGeneralFields(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  // Load requests
  const loadMyRequests = useCallback(() => {
    if (!token) return;
    const cfg = authConfig(token);
    api.get(`/api/editor-requests?email=${encodeURIComponent(email || "")}`, cfg)
      .then((r) => setMyRequests(r.data || []))
      .catch(() => {});
  }, [token, email]);

  useEffect(() => {
    loadMyRequests();
    const interval = setInterval(loadMyRequests, 30000);
    return () => clearInterval(interval);
  }, [loadMyRequests]);

  const sortedRequests = [...myRequests].sort((a, b) => {
    const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dB - dA;
  });
  const latestRequest = sortedRequests[0] || null;

  const hasPendingRequest = latestRequest?.status === "PENDING";
  const hasApprovedRequest = latestRequest?.status === "APPROVED";
  const hasRejectedRequest = latestRequest?.status === "REJECTED";

  const getCooldownInfo = () => {
    if (!hasRejectedRequest || !latestRequest.updatedAt) return null;
    const rejectedTime = new Date(latestRequest.updatedAt).getTime();
    const elapsed = Date.now() - rejectedTime;
    const remainingMs = 3 * 24 * 60 * 60 * 1000 - elapsed;
    if (remainingMs <= 0) return null;
    return {
      days: Math.floor(remainingMs / (24 * 60 * 60 * 1000)),
      hours: Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)),
      mins: Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000)),
    };
  };
  const cooldownInfo = getCooldownInfo();

  const handleUpgrade = async () => {
    if (!hasApprovedRequest) return;
    setUpgrading(true);
    setError("");
    try {
      const cfg = authConfig(token);
      await api.post("/api/editor-requests/activate", { newPassword: "keep-current" }, cfg);
      const loginRes = await api.post("/auth/login", { username: email, password: "keep-current" });
      if (loginRes.data?.token) {
        updateToken(loginRes.data.token);
        setNotice("Congratulations! Your account has been upgraded to Editor.");
      }
    } catch {
      try {
        const loginRes = await api.post("/auth/login", { username: email, password: "keep-current" });
        if (loginRes.data?.token) {
          updateToken(loginRes.data.token);
          setNotice("Congratulations! Your account has been upgraded to Editor.");
        }
      } catch {
        setError("Your application was approved! Please log out and log back in to activate editor access.");
      }
    } finally {
      setUpgrading(false);
    }
  };

  const handleGeneralSelect = (id) => { setSelectedGeneralId(id); setSelectedFieldIds([]); };
  const handleSubFieldToggle = (id) => {
    setSelectedFieldIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };
  const selectedGeneral = generalFields.find((g) => g.id === selectedGeneralId);

  const submit = async () => {
    setError("");
    if (selectedFieldIds.length === 0) { setError("Please select at least one field of interest"); return; }
    if (!form.experience.trim()) { setError("Please describe your experience"); return; }
    if (!form.motivation.trim()) { setError("Please describe your motivation"); return; }
    if (!form.profilePicture.trim()) { setError("Profile picture URL is required"); return; }

    try {
      const attachments = form.attachments.split(",").map((s) => s.trim()).filter(Boolean);
      const cfg = authConfig(token);
      await api.post("/api/editor-requests", {
        experience: form.experience,
        fieldIds: selectedFieldIds,
        references: form.references,
        phone: form.phone,
        profilePicture: form.profilePicture,
        attachments,
      }, cfg);
      setSubmitted(true);
      setNotice("Your editor application has been submitted for review.");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to submit");
    }
  };

  // ─── Not logged in
  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={[styles.statusBox, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
           <Text style={[styles.statusTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>✍️ {t("applyEditorTitle")}</Text>
           <Text style={[styles.statusDesc, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("pleaseSignIn")} {t("signIn")} {t("or")} {t("createAccount")} {t("toApply")}</Text>
        </View>
      </View>
    );
  }

  // ─── Guest account
  if (isPrimitive) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={[styles.statusBox, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
           <Text style={[styles.statusTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>✍️ {t("applyEditorTitle")}</Text>
           <Text style={[styles.noticeCard, { color: th(darkMode, dc.textSecondary, "#92400e"), backgroundColor: th(darkMode, dc.subtle, "#fffbeb") }]}>{t("guestNotice")} {t("createFullAccount")} {t("guestNoticeEnd")}</Text>
        </View>
      </View>
    );
  }

  // ─── Already editor
  if (isEditor) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={[styles.statusBox, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
          <Text style={styles.statusIcon}>🎉</Text>
           <Text style={[styles.statusTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("youAreEditor")}</Text>
           <Text style={[styles.statusDesc, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("editorStatusMessage")}</Text>
        </View>
      </View>
    );
  }

  // ─── Approved, pending upgrade
  if (hasApprovedRequest) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={[styles.statusBox, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
          <Text style={styles.statusIcon}>🎉</Text>
           <Text style={[styles.statusTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("applicationApproved")}</Text>
           <Text style={[styles.statusDesc, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("approvedMessage")}</Text>
           <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} disabled={upgrading}>
             <Text style={styles.upgradeBtnText}>{upgrading ? t("upgrading") : t("upgradeToEditor")}</Text>
           </TouchableOpacity>
           <Text style={[styles.statusNote, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("upgradeNote")}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  // ─── Pending
  if (hasPendingRequest) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={[styles.statusBox, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
          <Text style={styles.statusIcon}>⏳</Text>
           <Text style={[styles.statusTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("applicationPending")}</Text>
           <Text style={[styles.statusDesc, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("pendingMessage")}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  // ─── Rejected with cooldown
  if (hasRejectedRequest && cooldownInfo) {
    return (
      <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
        <TopBar navigation={navigation} />
        <View style={[styles.statusBox, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
          <Text style={styles.statusIcon}>❌</Text>
           <Text style={[styles.statusTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("applicationNotApproved")}</Text>
           <Text style={[styles.statusDesc, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("notApprovedMessage")}</Text>
           <Text style={styles.cooldownLabel}>{t("cooldownActive")}</Text>
          <Text style={styles.cooldownTimer}>
            {cooldownInfo.days > 0 ? `${cooldownInfo.days}d ` : ""}{cooldownInfo.hours}h {cooldownInfo.mins}m
          </Text>
           <Text style={[styles.statusNote, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("youCanApplyAgain")}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  // ─── Form (never applied OR rejected cooldown expired)
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TopBar navigation={navigation} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
         <Text style={[styles.pageTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>✍️ {t("applyEditorTitle")}</Text>
         <Text style={[styles.pageSubtitle, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("applyEditorSubtitle")}</Text>

         {hasRejectedRequest && !cooldownInfo && (
           <View style={[styles.successNotice, { backgroundColor: th(darkMode, dc.subtle, "#f0fdf4"), borderColor: th(darkMode, dc.border, "#bbf7d0") }]}><Text style={[styles.successNoticeText, { color: th(darkMode, dc.textSecondary, "#166534") }]}>{t("cooldownEnded")}</Text></View>
         )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {submitted ? <View style={[styles.successNotice, { backgroundColor: th(darkMode, dc.subtle, "#f0fdf4"), borderColor: th(darkMode, dc.border, "#bbf7d0") }]}><Text style={[styles.successNoticeText, { color: th(darkMode, dc.textSecondary, "#166534") }]}>Your application has been submitted!</Text></View> : null}

        {/* Fields of Interest */}
         <Text style={[styles.label, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("fieldsOfInterest")} <Text style={styles.required}>*</Text></Text>
         <Text style={[styles.labelHint, { color: th(darkMode, dc.muted, "#94a3b8") }]}>({t("fieldsRequired")})</Text>

        {loading ? (
          <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 12 }} />
        ) : generalFields.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
             <Text style={[styles.subLabel, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("chooseGeneralCategory")}</Text>
            <View style={styles.chipRow}>
              {generalFields.map((gf) => (
                <TouchableOpacity key={gf.id} style={[styles.chip, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }, selectedGeneralId === gf.id && { backgroundColor: th(darkMode, dc.subtle, "#eff6ff"), borderColor: "#2563eb" }]} onPress={() => handleGeneralSelect(gf.id)}>
                  <Text style={[styles.chipText, { color: th(darkMode, dc.textSecondary, "#334155") }, selectedGeneralId === gf.id && { color: "#2563eb", fontWeight: "600" }]}>{t(`field_${gf.name}`, { defaultValue: gf.name })}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedGeneral && (
              <View style={{ marginTop: 12 }}>
                 <Text style={[styles.subLabel, { color: th(darkMode, dc.textSecondary, "#334155") }]}>{t("chooseSpecificFields")} <Text style={[styles.hintText, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("maxTwoFields")}</Text></Text>
                <View style={styles.chipRow}>
                  {(selectedGeneral.children || []).map((sf) => {
                    const isSelected = selectedFieldIds.includes(sf.id);
                    const disabled = !isSelected && selectedFieldIds.length >= 2;
                    return (
                      <TouchableOpacity key={sf.id} style={[styles.chip, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }, isSelected && { backgroundColor: th(darkMode, dc.subtle, "#eff6ff"), borderColor: "#2563eb" }, disabled && styles.chipDisabled]} onPress={() => handleSubFieldToggle(sf.id)} disabled={disabled}>
                        <Text style={[styles.chipText, { color: th(darkMode, dc.textSecondary, "#334155") }, isSelected && { color: "#2563eb", fontWeight: "600" }, disabled && { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t(`field_${sf.name}`, { defaultValue: sf.name })} {isSelected ? "✓" : ""}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                 {selectedFieldIds.length > 0 && <Text style={[styles.hintText, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("selectedFields")} {selectedFieldIds.length}/2 {t("specificFields")}</Text>}
              </View>
            )}
          </View>
        ) : (
           <Text style={[styles.emptyText, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("noFieldsAvailable")}</Text>
        )}

        {/* Experience */}
         <Text style={[styles.label, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("experienceLabel")} <Text style={styles.required}>*</Text></Text>
         <TextInput style={[styles.textarea, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]} multiline numberOfLines={4} placeholder={t("experiencePlaceholder")} placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")} value={form.experience} onChangeText={(v) => setForm((p) => ({ ...p, experience: v }))} />

        {/* Motivation */}
         <Text style={[styles.label, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("motivationLabel")} <Text style={styles.required}>*</Text></Text>
         <TextInput style={[styles.textarea, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]} multiline numberOfLines={3} placeholder={t("motivationPlaceholder")} placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")} value={form.motivation} onChangeText={(v) => setForm((p) => ({ ...p, motivation: v }))} />

        {/* Sample Work */}
         <Text style={[styles.label, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("sampleWorkLabel")}</Text>
         <TextInput style={[styles.textarea, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]} multiline numberOfLines={3} placeholder={t("sampleWorkPlaceholder")} placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")} value={form.sampleWork} onChangeText={(v) => setForm((p) => ({ ...p, sampleWork: v }))} />

        {/* References */}
         <Text style={[styles.label, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("referencesLabel")}</Text>
         <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("referencesPlaceholder")} placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")} value={form.references} onChangeText={(v) => setForm((p) => ({ ...p, references: v }))} />

        {/* Phone */}
         <Text style={[styles.label, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("phoneLabel")}</Text>
         <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("phonePlaceholder")} placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")} value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} />

        {/* Profile Picture */}
         <Text style={[styles.label, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("profileImageUrl")} <Text style={styles.required}>*</Text></Text>
        <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder="https://example.com/photo.jpg" placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")} value={form.profilePicture} onChangeText={(v) => setForm((p) => ({ ...p, profilePicture: v }))} />

        {/* Attachments */}
         <Text style={[styles.label, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("attachmentUrls")}</Text>
         <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("attachmentPlaceholder")} placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")} value={form.attachments} onChangeText={(v) => setForm((p) => ({ ...p, attachments: v }))} />

        {/* Submit */}
        <TouchableOpacity style={styles.submitBtn} onPress={submit}>
           <Text style={styles.submitBtnText}>{t("submitApplication")}</Text>
         </TouchableOpacity>
         <Text style={[styles.statusNote, { color: th(darkMode, dc.muted, "#94a3b8") }]}>{t("applicationNote")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  statusBox: { borderRadius: 12, padding: 24, borderWidth: 1, alignItems: "center", margin: 16 },
  statusIcon: { fontSize: 40, marginBottom: 12 },
  statusTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  statusDesc: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  statusNote: { fontSize: 12, marginTop: 12, textAlign: "center" },
  noticeCard: { borderRadius: 10, padding: 14, marginTop: 16, fontSize: 14, lineHeight: 20 },
  successNotice: { borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1 },
  successNoticeText: { fontSize: 14 },
  upgradeBtn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, marginTop: 16, width: "100%", alignItems: "center" },
  upgradeBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cooldownLabel: { fontSize: 14, fontWeight: "700", color: "#ef4444", marginTop: 16 },
  cooldownTimer: { fontSize: 24, fontWeight: "800", color: "#d97706", marginTop: 8 },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  labelHint: { fontSize: 12, marginBottom: 12 },
  required: { color: "#ef4444" },
  subLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  hintText: { fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, borderWidth: 1 },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 13, fontWeight: "500" },
  emptyText: { fontSize: 13, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
  textarea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, minHeight: 90, textAlignVertical: "top" },
  errorText: { fontSize: 14, color: "#ef4444", marginBottom: 12, textAlign: "center" },
  submitBtn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8, marginBottom: 8 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});