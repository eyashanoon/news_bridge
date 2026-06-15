import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useSession } from "../context/SessionContext";

/* ---------- Device fingerprint utilities ---------- */
function getDeviceFingerprint() {
  try {
    const stored = localStorage.getItem("nf_device_id");
    if (stored) return stored;
    const fp = "fp_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("nf_device_id", fp);
    return fp;
  } catch {
    return "fp_fallback_" + Date.now();
  }
}

function getDeviceLabel() {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone/i.test(ua);
  const browser = ua.includes("Chrome") ? "Chrome" :
                  ua.includes("Firefox") ? "Firefox" :
                  ua.includes("Safari") ? "Safari" :
                  ua.includes("Edge") ? "Edge" : "Unknown";
  const os = ua.includes("Windows") ? "Windows" :
             ua.includes("Mac") ? "macOS" :
             ua.includes("Linux") ? "Linux" :
             ua.includes("Android") ? "Android" :
             ua.includes("iPhone") ? "iOS" : "Unknown";
  return `${browser} on ${os}${isMobile ? " (Mobile)" : ""}`;
}

/* ---------- Password strength checker (client-side + server fallback) ---------- */
function evaluatePasswordStrength(password) {
  const checks = {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    minLength: 8,
  };

  // Score 0-100
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
  const debounceRef = useRef(null);
  const [loadingServer, setLoadingServer] = useState(false);

  useEffect(() => {
    if (!password) {
      setResult(null);
      return;
    }

    // Immediate client-side evaluation
    const clientEval = evaluatePasswordStrength(password);
    setResult(clientEval);

    // Debounced server-side check
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoadingServer(true);
        const res = await api.post("/auth/check-password-strength", { password });
        setResult(res.data);
      } catch {
        // fall back to client result if server fails
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

  const barColor = strength === "strong" ? "var(--success, #28a745)" :
                   strength === "medium" ? "var(--warning, #ffc107)" : "var(--danger, #dc3545)";

  return (
    <div className="password-strength">
      <div className="strength-bar-track">
        <div
          className="strength-bar-fill"
          style={{ width: `${score}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="strength-info">
        <span className={`strength-label ${strength}`}>
          {loadingServer ? t("authChecking") : t("authPasswordStrength", { strength: t(`authStrength${strength.charAt(0).toUpperCase() + strength.slice(1)}`) })}
        </span>
        <span className="strength-score">{score}/100</span>
      </div>
      {!valid && missing.length > 0 && (
        <ul className="strength-requirements">
          {missing.map((req, i) => (
            <li key={i} className="requirement-missing">{req}</li>
          ))}
        </ul>
      )}
      {valid && (
        <div className="strength-valid">
          ✓ All requirements met
        </div>
      )}
    </div>
  );
}

/* ---------- Main AuthPage component ---------- */
export default function AuthPage({ mode }) {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState(mode || "login");
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
  const nav = useNavigate();

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const deviceLabel = getDeviceLabel();

      const res = await api.post("/auth/login", {
        username,
        password,
        deviceFingerprint,
        deviceLabel,
      });

      const data = res.data;

      if (data.requireMfa) {
        // Need MFA - switch to MFA verification mode
        setMfaEmail(data.email);
        setMfaDeviceFingerprint(data.deviceFingerprint || deviceFingerprint);
        setMfaDeviceLabel(data.deviceLabel || deviceLabel);
        setAuthMode("mfa");
        setMessage("A verification code has been sent to your email. Please enter it below to verify this device.");
      } else if (data.token) {
        updateToken(data.token);
        const parts = data.token.split(".");
        const payload = JSON.parse(atob(parts[1]));
        if (payload.type === "EDITOR") {
          nav("/news");
        } else {
          nav("/news");
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Authentication failed";
      setError(msg);
      if (msg.includes("not verified")) {
        setAuthMode("verify");
        // Extract email from username field if it's an email
        if (username.includes("@")) {
          setEmail(username);
        }
        setMessage("Please enter the verification code sent to your email.");
        try {
          await api.post("/auth/resend-code", { email: username.includes("@") ? username : email });
          setMessage("A new verification code has been sent to your email.");
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Client-side password validation
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
        setAuthMode("verify");
        setMessage("Account created! Please check your email for the verification code.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/verify-email", { email, code });
      // No auto-login - redirect to login page with success message
      setMessage(res.data?.message || "Email verified successfully!");
      setTimeout(() => {
        switchTo("login");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/verify-mfa", {
        email: mfaEmail,
        code,
        deviceFingerprint: mfaDeviceFingerprint,
        deviceLabel: mfaDeviceLabel,
      });
      if (res.data?.token) {
        updateToken(res.data.token);
        const parts = res.data.token.split(".");
        const payload = JSON.parse(atob(parts[1]));
        if (payload.type === "EDITOR") {
          nav("/news");
        } else {
          nav("/news");
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaResend = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/resend-mfa", { email: mfaEmail });
      setMessage(res.data?.message || "A new code has been sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.data?.message || "If the account exists, a reset code has been sent.");
      setAuthMode("reset");
    } catch (err) {
      setError(err.response?.data?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate new password strength
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
      setError(err.response?.data?.message || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/resend-code", { email });
      setMessage(res.data?.message || "A new code has been sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const switchTo = (newMode) => {
    setAuthMode(newMode);
    setError("");
    setMessage("");
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        {isLogin && (
          <>
            <h2>{t("authWelcomeBack")}</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <form onSubmit={handleLogin}>
              <input type="text" placeholder={t("authUsernameOrEmail")} value={username} onChange={e => setUsername(e.target.value)} required />
              <input type="password" placeholder={t("authPassword")} value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? t("authSigningIn") : t("authLogIn")}
              </button>
            </form>
            <div className="auth-links">
              <button className="link-btn" onClick={() => switchTo("forgot")}>{t("authForgotPassword")}</button>
            </div>
            <div className="auth-switch">
              {t("authNoAccount")} <Link to="/auth/signup" onClick={() => switchTo("signup")}>{t("authSignUp")}</Link>
            </div>
          </>
        )}

        {isSignup && (
          <>
            <h2>{t("authCreateAccount")}</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <form onSubmit={handleSignup}>
              <input type="text" placeholder={t("authUsername")} value={username} onChange={e => setUsername(e.target.value)} required />
              <input type="email" placeholder={t("authEmail")} value={email} onChange={e => setEmail(e.target.value)} required />
              <div className="password-field-wrapper">
                <input
                  type="password"
                  placeholder={t("authPasswordPlaceholder")}
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <PasswordStrengthMeter password={password} t={t} />
              </div>
              <input type="text" placeholder={t("authFullName")} value={fullName} onChange={e => setFullName(e.target.value)} />
              <textarea placeholder={t("authBio")} value={bio} onChange={e => setBio(e.target.value)} rows={3} />
              <button type="submit" className="btn btn-primary" disabled={loading || (password.length > 0 && !evaluatePasswordStrength(password).valid)}>
                {loading ? t("authCreatingAccount") : t("authSignUp")}
              </button>
            </form>
            <div className="auth-switch">
              {t("authAlreadyAccount")} <Link to="/auth/login" onClick={() => switchTo("login")}>{t("authLogIn")}</Link>
            </div>
          </>
        )}

        {isVerify && (
          <>
            <h2>{t("authVerifyEmail")}</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <p style={{ marginBottom: "12px", color: "var(--text-secondary)" }}
              dangerouslySetInnerHTML={{ __html: t("authVerifyDesc", "A 6-digit code was sent to <strong>{email}</strong>. Please enter it below.", { email }) }}
            />
            <form onSubmit={handleVerify}>
              <input
                type="text"
                placeholder={t("authEnterCode")}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading || code.length < 6}>
                {loading ? t("authVerifying") : t("authVerifyBtn")}
              </button>
            </form>
            <div className="auth-links">
              <button className="link-btn" onClick={handleResendCode} disabled={loading}>
                {t("authResendCode")}
              </button>
            </div>
            <div className="auth-switch">
              <Link to="/auth/login" onClick={() => switchTo("login")}>{t("authBackToLogin")}</Link>
            </div>
          </>
        )}

        {isMfa && (
          <>
            <h2>{t("authVerifyDevice")}</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <p style={{ marginBottom: "12px", color: "var(--text-secondary)" }}
              dangerouslySetInnerHTML={{ __html: t("authMfaDesc", "A 6-digit verification code was sent to <strong>{email}</strong>. Please enter it below to authorize this device.", { email: mfaEmail }) }}
            />
            <form onSubmit={handleMfaVerify}>
              <input
                type="text"
                placeholder={t("authEnterCode")}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading || code.length < 6}>
                {loading ? t("authVerifying") : t("authVerifyLogin")}
              </button>
            </form>
            <div className="auth-links">
              <button className="link-btn" onClick={handleMfaResend} disabled={loading}>
                {t("authResendCode")}
              </button>
            </div>
            <div className="auth-switch">
              <Link to="/auth/login" onClick={() => switchTo("login")}>{t("authBackToLogin")}</Link>
            </div>
          </>
        )}

        {isForgot && (
          <>
            <h2>{t("authResetPassword")}</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <form onSubmit={handleForgotPassword}>
              <input type="email" placeholder={t("authEnterEmail")} value={email} onChange={e => setEmail(e.target.value)} required />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? t("authSending") : t("authSendResetCode")}
              </button>
            </form>
            <div className="auth-switch">
              <Link to="/auth/login" onClick={() => switchTo("login")}>{t("authBackToLogin")}</Link>
            </div>
          </>
        )}

        {isReset && (
          <>
            <h2>{t("authEnterResetCode")}</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <p style={{ marginBottom: "12px", color: "var(--text-secondary)" }}
              dangerouslySetInnerHTML={{ __html: t("authResetDesc", "A reset code was sent to <strong>{email}</strong>. Enter it and your new password.", { email }) }}
            />
            <form onSubmit={handleResetPassword}>
              <input
                type="text"
                placeholder={t("authEnterCode")}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
              />
              <div className="password-field-wrapper">
                <input
                  type="password"
                  placeholder={t("authNewPassword")}
                  minLength={8}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                <PasswordStrengthMeter password={newPassword} t={t} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading || code.length < 6 || (newPassword.length > 0 && !evaluatePasswordStrength(newPassword).valid)}>
                {loading ? t("authResetting") : t("authResetBtn")}
              </button>
            </form>
            <div className="auth-links">
              <button className="link-btn" onClick={handleResendCode} disabled={loading}>
                {t("authResendCode")}
              </button>
            </div>
            <div className="auth-switch">
              <Link to="/auth/login" onClick={() => switchTo("login")}>{t("authBackToLogin")}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}