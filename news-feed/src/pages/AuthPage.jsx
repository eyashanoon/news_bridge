import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../context/SessionContext";

export default function AuthPage({ mode }) {
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

  const isLogin = authMode === "login";
  const isSignup = authMode === "signup";
  const isVerify = authMode === "verify";
  const isForgot = authMode === "forgot";
  const isReset = authMode === "reset";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { username, password });
      if (res.data?.token) {
        updateToken(res.data.token);
        const parts = res.data.token.split(".");
        const payload = JSON.parse(atob(parts[1]));
        if (payload.type === "EDITOR") {
          nav("/editor/workspace");
        } else {
          nav("/news");
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Authentication failed";
      setError(msg);
      if (msg.includes("not verified")) {
        setAuthMode("verify");
        setMessage("Please enter the verification code sent to your email.");
        try {
          await api.post("/auth/resend-code", { email });
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
      if (res.data?.token) {
        updateToken(res.data.token);
        setMessage("Email verified! You are now logged in.");
        nav("/news");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
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
            <h2>Welcome Back</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <form onSubmit={handleLogin}>
              <input type="text" placeholder="Username or Email" value={username} onChange={e => setUsername(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Signing in..." : "Log In"}
              </button>
            </form>
            <div className="auth-links">
              <button className="link-btn" onClick={() => switchTo("forgot")}>Forgot password?</button>
            </div>
            <div className="auth-switch">
              Don't have an account? <Link to="/auth/signup" onClick={() => switchTo("signup")}>Sign Up</Link>
            </div>
          </>
        )}

        {isSignup && (
          <>
            <h2>Create Account</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <form onSubmit={handleSignup}>
              <input type="text" placeholder="Username *" value={username} onChange={e => setUsername(e.target.value)} required />
              <input type="email" placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password * (min 6 chars)" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required />
              <input type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} />
              <textarea placeholder="Short bio (optional)" value={bio} onChange={e => setBio(e.target.value)} rows={3} />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Creating account..." : "Sign Up"}
              </button>
            </form>
            <div className="auth-switch">
              Already have an account? <Link to="/auth/login" onClick={() => switchTo("login")}>Log In</Link>
            </div>
          </>
        )}

        {isVerify && (
          <>
            <h2>Verify Your Email</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <p style={{ marginBottom: "12px", color: "var(--text-secondary)" }}>
              A 6-digit code was sent to <strong>{email}</strong>. Please enter it below.
            </p>
            <form onSubmit={handleVerify}>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading || code.length < 6}>
                {loading ? "Verifying..." : "Verify Email"}
              </button>
            </form>
            <div className="auth-links">
              <button className="link-btn" onClick={handleResendCode} disabled={loading}>
                Resend code
              </button>
            </div>
            <div className="auth-switch">
              <Link to="/auth/login" onClick={() => switchTo("login")}>Back to Login</Link>
            </div>
          </>
        )}

        {isForgot && (
          <>
            <h2>Reset Password</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <form onSubmit={handleForgotPassword}>
              <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Code"}
              </button>
            </form>
            <div className="auth-switch">
              <Link to="/auth/login" onClick={() => switchTo("login")}>Back to Login</Link>
            </div>
          </>
        )}

        {isReset && (
          <>
            <h2>Enter Reset Code</h2>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice success">{message}</div>}
            <p style={{ marginBottom: "12px", color: "var(--text-secondary)" }}>
              A reset code was sent to <strong>{email}</strong>. Enter it and your new password.
            </p>
            <form onSubmit={handleResetPassword}>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
              />
              <input
                type="password"
                placeholder="New password (min 6 characters)"
                minLength={6}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading || code.length < 6}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
            <div className="auth-links">
              <button className="link-btn" onClick={handleResendCode} disabled={loading}>
                Resend code
              </button>
            </div>
            <div className="auth-switch">
              <Link to="/auth/login" onClick={() => switchTo("login")}>Back to Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}