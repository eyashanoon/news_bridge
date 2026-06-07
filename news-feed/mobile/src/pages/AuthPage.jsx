import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { api } from "../api/api";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

export default function AuthPage({ navigation, route }) {
  const { darkMode } = useTheme();
  const { t } = useTranslation();
  const initialMode = route?.params?.mode || "login";
  const [authMode, setAuthMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { updateToken } = useSession();

  const isLogin = authMode === "login";
  const isSignup = authMode === "signup";
  const isVerify = authMode === "verify";
  const isForgot = authMode === "forgot";
  const isReset = authMode === "reset";

  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/login", { username, password });
      if (res.data?.token) {
        await updateToken(res.data.token);
        navigation?.navigate("NewsFeed");
      }
    } catch (err) {
      let msg = "Authentication failed";
      if (err.response?.data?.message) msg = err.response.data.message;
      else if (err.code === "ERR_NETWORK") msg = "Cannot connect to server. Make sure the backend is running.";
      else if (err.message) msg = err.message;
      setError(msg);
      if (msg.includes("not verified")) {
        setAuthMode("verify");
        setMessage("Please enter the verification code sent to your email.");
      }
    } finally { setLoading(false); }
  };

  const handleSignup = async () => {
    setLoading(true); setError("");
    try {
      const payload = { username, email, password };
      if (fullName) payload.fullName = fullName;
      if (bio) payload.bio = bio;
      const res = await api.post("/auth/signup", payload);
      if (res.data?.email) {
        setAuthMode("verify");
        setMessage("Account created! Please check your email for the verification code.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/verify-email", { email, code });
      if (res.data?.token) {
        await updateToken(res.data.token);
        setMessage("Email verified! You are now logged in.");
        navigation?.navigate("NewsFeed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.data?.message || "If the account exists, a reset code has been sent.");
      setAuthMode("reset");
    } catch (err) {
      let msg = "Request failed";
      if (err.response?.data?.message) msg = err.response.data.message;
      else if (err.code === "ERR_NETWORK") msg = "Cannot connect to server.";
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/reset-password", { email, code, newPassword });
      setMessage(res.data?.message || "Password reset successfully! You can now log in.");
      setAuthMode("login");
    } catch (err) {
      let msg = "Password reset failed";
      if (err.response?.data?.message) msg = err.response.data.message;
      else if (err.code === "ERR_NETWORK") msg = "Cannot connect to server.";
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleResendCode = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/resend-code", { email });
      setMessage(res.data?.message || "A new code has been sent.");
    } catch (err) {
      let msg = "Failed to resend code";
      if (err.response?.data?.message) msg = err.response.data.message;
      else if (err.code === "ERR_NETWORK") msg = "Cannot connect to server.";
      setError(msg);
    } finally { setLoading(false); }
  };

  const switchTo = (mode) => { setAuthMode(mode); setError(""); setMessage(""); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.container, { backgroundColor: th(darkMode, dc.bg, "#f0f2f5") }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.box, { backgroundColor: th(darkMode, dc.surface, "#fff") }]}>
          {isLogin && (
            <>
              <Text style={styles.title}>{t("authLoginTitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authEmailPlaceholder")} value={username} onChangeText={setUsername} autoCapitalize="none" />
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authPasswordPlaceholder")} value={password} onChangeText={setPassword} secureTextEntry />
              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authLoginButton")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation?.navigate("NewsFeed")} style={styles.guestButton}>
                <Text style={styles.guestButtonText}>👤 {t("feedTitle")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("signup")}><Text style={styles.switchText}>{t("authNoAccount")} {t("authSignupButton")}</Text></TouchableOpacity>
            </>
          )}

          {isSignup && (
            <>
              <Text style={styles.title}>{t("authSignupTitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("username") + " *"} value={username} onChangeText={setUsername} autoCapitalize="none" />
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authEmailPlaceholder") + " *"} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authPasswordPlaceholder") + " * (min 6)"} value={password} onChangeText={setPassword} secureTextEntry />
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("fullName")} value={fullName} onChangeText={setFullName} />
              <TextInput style={[styles.input, styles.textArea, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("noBio")} value={bio} onChangeText={setBio} multiline numberOfLines={3} />
              <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authSignupButton")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation?.navigate("NewsFeed")} style={styles.guestButton}>
                <Text style={styles.guestButtonText}>👤 {t("feedTitle")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("login")}><Text style={styles.switchText}>{t("authHaveAccount")} {t("authLoginButton")}</Text></TouchableOpacity>
            </>
          )}

          {isVerify && (
            <>
              <Text style={styles.title}>{t("authSignupTitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <Text style={styles.infoText}>{t("authSignupSuccess")}</Text>
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authPasswordPlaceholder")} value={code} onChangeText={ct => setCode(ct.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
              <TouchableOpacity style={[styles.button, code.length < 6 && styles.buttonDisabled]} onPress={handleVerify} disabled={loading || code.length < 6}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authLoginButton")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleResendCode} disabled={loading}><Text style={styles.link}>{t("retry")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("login")}><Text style={styles.switchText}>{t("goBack")}</Text></TouchableOpacity>
            </>
          )}

          {isForgot && (
            <>
              <Text style={styles.title}>{t("authPasswordPlaceholder")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authEmailPlaceholder")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TouchableOpacity style={styles.button} onPress={handleForgotPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authLoginButton")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("login")}><Text style={styles.switchText}>{t("goBack")}</Text></TouchableOpacity>
            </>
          )}

          {isReset && (
            <>
              <Text style={styles.title}>{t("authPasswordPlaceholder")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <Text style={styles.infoText}>{t("authLoginSuccess")}</Text>
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authPasswordPlaceholder")} value={code} onChangeText={ct => setCode(ct.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
              <TextInput style={[styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authPasswordPlaceholder")} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
              <TouchableOpacity style={[styles.button, code.length < 6 && styles.buttonDisabled]} onPress={handleResetPassword} disabled={loading || code.length < 6}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authPasswordPlaceholder")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleResendCode} disabled={loading}><Text style={styles.link}>{t("retry")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("login")}><Text style={styles.switchText}>{t("goBack")}</Text></TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f9" },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  box: { backgroundColor: "#fff", borderRadius: 16, padding: 28, elevation: 4, boxShadow: "0 10px 32px rgba(11,26,43,0.1), 0 4px 12px rgba(11,26,43,0.06)", alignSelf: "center", maxWidth: 440, width: "100%" },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 16, textAlign: "center", color: "#0b1a2b", letterSpacing: -0.02 },  // dark mode via inline
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, backgroundColor: "#fff", color: "#0b1a2b" },  // dynamic inline bg/text
  textArea: { height: 80, textAlignVertical: "top" },
  button: { backgroundColor: "#2563eb", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4, marginBottom: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", color: "#b91c1c", padding: 12, borderRadius: 12, marginBottom: 12, textAlign: "center", fontSize: 14, fontWeight: "500" },
  success: { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", color: "#166534", padding: 12, borderRadius: 12, marginBottom: 12, textAlign: "center", fontSize: 14, fontWeight: "500" },
  guestButton: { borderWidth: 1.5, borderColor: "#cbd5e1", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4, marginBottom: 4, backgroundColor: "#f8fafc" },  // dynamic inline
  guestButtonText: { color: "#334155", fontSize: 15, fontWeight: "600" },
  link: { color: "#2563eb", textAlign: "center", marginTop: 8, fontSize: 14, fontWeight: "600" },
  switchText: { color: "#6e869a", textAlign: "center", marginTop: 16, fontSize: 14 },
  infoText: { color: "#3d5468", marginBottom: 12, fontSize: 14, textAlign: "center" },
  bold: { fontWeight: "700" },
});
