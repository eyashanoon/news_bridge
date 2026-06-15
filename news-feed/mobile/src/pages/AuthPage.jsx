import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { api } from "../api/api";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform as RNPlatform } from "react-native";

/* ---------- Device fingerprint utilities ---------- */
async function getDeviceFingerprint() {
  try {
    const stored = await AsyncStorage.getItem("nf_device_id");
    if (stored) return stored;
    const fp = "fp_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    await AsyncStorage.setItem("nf_device_id", fp);
    return fp;
  } catch {
    return "fp_fallback_" + Date.now();
  }
}

function getDeviceLabel() {
  const os = RNPlatform.OS;
  const version = RNPlatform.Version;
  return `${os} ${version} (App)`;
}

/* ---------- Password strength checker (mirrors backend logic) ---------- */
function evaluatePasswordStrength(password) {
  const checks = {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    minLength: 8,
  };

  let score = 0;
  score += Math.min(40, password.length * 2);
  if (checks.hasUppercase) score += 10;
  if (checks.hasLowercase) score += 10;
  if (checks.hasDigit) score += 15;
  if (checks.hasSpecial) score += 25;
  score = Math.min(100, score);

  let strength = "weak";
  if (score >= 40) strength = "medium";
  if (score >= 70) strength = "strong";

  const missing = [];
  if (!checks.hasMinLength) missing.push(`At least ${checks.minLength} characters`);
  if (!checks.hasUppercase) missing.push("One uppercase letter");
  if (!checks.hasLowercase) missing.push("One lowercase letter");
  if (!checks.hasDigit) missing.push("One digit");
  if (!checks.hasSpecial) missing.push("One special character");

  return { ...checks, score, strength, missing, valid: missing.length === 0 };
}

/* ---------- PasswordStrengthMeter component ---------- */
function PasswordStrengthMeter({ password, t }) {
  const [result, setResult] = useState(null);
  const [loadingServer, setLoadingServer] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!password) {
      setResult(null);
      return;
    }

    const clientEval = evaluatePasswordStrength(password);
    setResult(clientEval);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoadingServer(true);
        const res = await api.post("/auth/check-password-strength", { password });
        setResult(res.data);
      } catch {
      } finally {
        setLoadingServer(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [password]);

  if (!result) return null;

  const { strength, score, missing, valid } = result;

  const barColor = strength === "strong" ? "#28a745" :
                   strength === "medium" ? "#ffc107" : "#dc3545";
  const barWidth = `${Math.min(100, score)}%`;

  return (
    <View style={meterStyles.container}>
      <View style={meterStyles.track}>
        <View style={[meterStyles.fill, { width: barWidth, backgroundColor: barColor }]} />
      </View>
      <View style={meterStyles.info}>
        <Text style={meterStyles.label}>
          {loadingServer ? t("authChecking") : t("authPasswordStrength", { strength: t(`authStrength${strength.charAt(0).toUpperCase() + strength.slice(1)}`) })}
        </Text>
        <Text style={meterStyles.score}>{score}/100</Text>
      </View>
      {!valid && missing.length > 0 && (
        <View style={meterStyles.requirements}>
          {missing.map((req, i) => (
            <Text key={i} style={meterStyles.reqMissing}>• {req}</Text>
          ))}
        </View>
      )}
      {valid && (
        <Text style={meterStyles.valid}>✓ {t("authAllRequirements")}</Text>
      )}
    </View>
  );
}

const meterStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  track: { height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  info: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  label: { fontSize: 12, color: "#64748b" },
  score: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  requirements: { marginTop: 4 },
  reqMissing: { fontSize: 12, color: "#b91c1c", marginBottom: 1 },
  valid: { fontSize: 12, color: "#166534", marginTop: 4, fontWeight: "500" },
});

/* ---------- Main AuthPage component ---------- */
export default function AuthPage({ navigation, route }) {
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
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

  // MFA state
  const [mfaEmail, setMfaEmail] = useState("");
  const [mfaDeviceFingerprint, setMfaDeviceFingerprint] = useState("");
  const [mfaDeviceLabel, setMfaDeviceLabel] = useState("");

  const isLogin = authMode === "login";
  const isSignup = authMode === "signup";
  const isVerify = authMode === "verify";
  const isMfa = authMode === "mfa";
  const isForgot = authMode === "forgot";
  const isReset = authMode === "reset";

  const inputStyle = [styles.input, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }];

  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const deviceLabel = getDeviceLabel();

      const res = await api.post("/auth/login", {
        username,
        password,
        deviceFingerprint,
        deviceLabel,
      });

      const data = res.data;

      if (data.requireMfa) {
        setMfaEmail(data.email);
        setMfaDeviceFingerprint(data.deviceFingerprint || deviceFingerprint);
        setMfaDeviceLabel(data.deviceLabel || deviceLabel);
        setAuthMode("mfa");
        setMessage("A verification code has been sent to your email. Please enter it below to verify this device.");
      } else if (data.token) {
        await updateToken(data.token);
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
        if (username.includes("@")) setEmail(username);
        setMessage("Please enter the verification code sent to your email.");
        try {
          await api.post("/auth/resend-code", { email: username.includes("@") ? username : email });
          setMessage("A new verification code has been sent to your email.");
        } catch {}
      }
    } finally { setLoading(false); }
  };

  const handleSignup = async () => {
    setLoading(true); setError("");

    const pwCheck = evaluatePasswordStrength(password);
    if (!pwCheck.valid) {
      setError("Password does not meet requirements: " + pwCheck.missing.join(", "));
      setLoading(false);
      return;
    }

    try {
      const payload = { username, email, password };
      if (fullName) payload.fullName = fullName;
      if (bio) payload.bio = bio;
      const res = await api.post("/auth/signup", payload);
      if (res.data?.email) {
        setEmail(res.data.email);
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
      setMessage(res.data?.message || "Email verified successfully!");
      setTimeout(() => { switchTo("login"); }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally { setLoading(false); }
  };

  const handleMfaVerify = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/verify-mfa", {
        email: mfaEmail,
        code,
        deviceFingerprint: mfaDeviceFingerprint,
        deviceLabel: mfaDeviceLabel,
      });
      if (res.data?.token) {
        await updateToken(res.data.token);
        navigation?.navigate("NewsFeed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally { setLoading(false); }
  };

  const handleMfaResend = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/resend-mfa", { email: mfaEmail });
      setMessage(res.data?.message || "A new code has been sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code");
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

    const pwCheck = evaluatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      setError("Password does not meet requirements: " + pwCheck.missing.join(", "));
      setLoading(false);
      return;
    }

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

  const isRtl = i18n.language === "ar";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.container, { backgroundColor: th(darkMode, dc.bg, "#f0f2f5"), direction: isRtl ? "rtl" : "ltr" }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.box, { backgroundColor: th(darkMode, dc.surface, "#fff") }]}>
          {isLogin && (
            <>
              <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("authLoginTitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <TextInput style={inputStyle} placeholder={t("authEmailPlaceholder")} placeholderTextColor="#94a3b8" value={username} onChangeText={setUsername} autoCapitalize="none" />
              <TextInput style={inputStyle} placeholder={t("authPasswordPlaceholder")} placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />
              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authLoginButton")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("forgot")} style={styles.linkButton}>
                <Text style={styles.link}>{t("authForgotPassword")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation?.navigate("NewsFeed")} style={styles.guestButton}>
                <Text style={styles.guestButtonText}>👤 {t("feedTitle")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("signup")}><Text style={styles.switchText}>{t("authNoAccount")} <Text style={styles.switchBold}>{t("authSignupButton")}</Text></Text></TouchableOpacity>
            </>
          )}

          {isSignup && (
            <>
              <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("authSignupTitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <TextInput style={inputStyle} placeholder={t("authUsername")} placeholderTextColor="#94a3b8" value={username} onChangeText={setUsername} autoCapitalize="none" />
              <TextInput style={inputStyle} placeholder={t("authEmail")} placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <View style={styles.passwordWrapper}>
                <TextInput style={inputStyle} placeholder={t("authPasswordPlaceholder")} placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />
                <PasswordStrengthMeter password={password} t={t} />
              </View>
              <TextInput style={inputStyle} placeholder={t("authFullName")} placeholderTextColor="#94a3b8" value={fullName} onChangeText={setFullName} />
              <TextInput style={[styles.input, styles.textArea, { backgroundColor: th(darkMode, dc.subtle, "#fff"), color: th(darkMode, dc.text, "#0b1a2b") }]} placeholder={t("authBio")} placeholderTextColor="#94a3b8" value={bio} onChangeText={setBio} multiline numberOfLines={3} />
              <TouchableOpacity style={[styles.button, (password.length > 0 && !evaluatePasswordStrength(password).valid) && styles.buttonDisabled]} onPress={handleSignup} disabled={loading || (password.length > 0 && !evaluatePasswordStrength(password).valid)}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authSignupButton")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation?.navigate("NewsFeed")} style={styles.guestButton}>
                <Text style={styles.guestButtonText}>👤 {t("feedTitle")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("login")}><Text style={styles.switchText}>{t("authHaveAccount")} <Text style={styles.switchBold}>{t("authLoginButton")}</Text></Text></TouchableOpacity>
            </>
          )}

          {isVerify && (
            <>
              <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("authVerifyTitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <Text style={styles.infoText}>{t("authVerifyDesc", "A 6-digit code was sent to {email}. Please enter it below.", { email })}</Text>
              <TextInput style={inputStyle} placeholder={t("authEnterCode")} placeholderTextColor="#94a3b8" value={code} onChangeText={ct => setCode(ct.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
              <TouchableOpacity style={[styles.button, code.length < 6 && styles.buttonDisabled]} onPress={handleVerify} disabled={loading || code.length < 6}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authVerifyButton")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleResendCode} disabled={loading}><Text style={styles.link}>{t("authResendCode")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("login")}><Text style={styles.switchText}>{t("goBack")}</Text></TouchableOpacity>
            </>
          )}

          {isMfa && (
            <>
              <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("authVerifyDevice")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <Text style={styles.infoText}>{t("authMfaDesc", "A 6-digit verification code was sent to {email}. Please enter it below to authorize this device.", { email: mfaEmail })}</Text>
              <TextInput style={inputStyle} placeholder={t("authEnterCode")} placeholderTextColor="#94a3b8" value={code} onChangeText={ct => setCode(ct.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
              <TouchableOpacity style={[styles.button, code.length < 6 && styles.buttonDisabled]} onPress={handleMfaVerify} disabled={loading || code.length < 6}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authVerifyLogin")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMfaResend} disabled={loading}><Text style={styles.link}>{t("authResendCode")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("login")}><Text style={styles.switchText}>{t("goBack")}</Text></TouchableOpacity>
            </>
          )}

          {isForgot && (
            <>
              <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("authForgotPassword")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <TextInput style={inputStyle} placeholder={t("authEnterEmail")} placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TouchableOpacity style={styles.button} onPress={handleForgotPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authSendResetCode")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTo("login")}><Text style={styles.switchText}>{t("goBack")}</Text></TouchableOpacity>
            </>
          )}

          {isReset && (
            <>
              <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("authResetTitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <Text style={styles.infoText}>{t("authResetDesc", "A reset code was sent to {email}. Enter it and your new password.", { email })}</Text>
              <TextInput style={inputStyle} placeholder={t("authEnterCode")} placeholderTextColor="#94a3b8" value={code} onChangeText={ct => setCode(ct.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
              <View style={styles.passwordWrapper}>
                <TextInput style={inputStyle} placeholder={t("authNewPassword")} placeholderTextColor="#94a3b8" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                <PasswordStrengthMeter password={newPassword} t={t} />
              </View>
              <TouchableOpacity style={[styles.button, (code.length < 6 || (newPassword.length > 0 && !evaluatePasswordStrength(newPassword).valid)) && styles.buttonDisabled]} onPress={handleResetPassword} disabled={loading || code.length < 6 || (newPassword.length > 0 && !evaluatePasswordStrength(newPassword).valid)}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("authResetButton")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleResendCode} disabled={loading}><Text style={styles.link}>{t("authResendCode")}</Text></TouchableOpacity>
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
  box: { backgroundColor: "#fff", borderRadius: 16, padding: 28, elevation: 4, shadowColor: "#0b1a2b", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, alignSelf: "center", maxWidth: 440, width: "100%" },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 16, textAlign: "center", letterSpacing: -0.02 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, backgroundColor: "#fff", color: "#0b1a2b" },
  textArea: { height: 80, textAlignVertical: "top" },
  passwordWrapper: { marginBottom: 4 },
  button: { backgroundColor: "#2563eb", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4, marginBottom: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", color: "#b91c1c", padding: 12, borderRadius: 12, marginBottom: 12, textAlign: "center", fontSize: 14, fontWeight: "500" },
  success: { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", color: "#166534", padding: 12, borderRadius: 12, marginBottom: 12, textAlign: "center", fontSize: 14, fontWeight: "500" },
  guestButton: { borderWidth: 1.5, borderColor: "#cbd5e1", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4, marginBottom: 4, backgroundColor: "#f8fafc" },
  guestButtonText: { color: "#334155", fontSize: 15, fontWeight: "600" },
  linkButton: { alignItems: "center", marginTop: 4, marginBottom: 4 },
  link: { color: "#2563eb", textAlign: "center", marginTop: 8, fontSize: 14, fontWeight: "600" },
  switchText: { color: "#6e869a", textAlign: "center", marginTop: 16, fontSize: 14 },
  switchBold: { color: "#2563eb", fontWeight: "600" },
  infoText: { color: "#3d5468", marginBottom: 12, fontSize: 14, textAlign: "center" },
});