import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../context/SessionContext";

export default function AuthPage({ mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { updateToken } = useSession();
  const nav = useNavigate();

  const isLogin = mode === "login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/signup";
      const res = await api.post(endpoint, { email, password });
      if (res.data?.token) {
        updateToken(res.data.token);
        
        // Dynamic Role-based navigation
        const parts = res.data.token.split(".");
        const payload = JSON.parse(atob(parts[1]));
        
        if (payload.type === "EDITOR") {
            nav("/editor");
        } else if (payload.type === "REGISTERED") {
            nav("/dashboard");
        } else if (payload.type === "ADMIN") {
            nav("/admin");
        } else {
            nav("/");
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed");
    }
  };

  return (
    <div className="auth-box">
      <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="btn btn-primary">{isLogin ? "Log In" : "Sign Up"}</button>
      </form>
      <div className="auth-switch">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <Link to={isLogin ? "/auth/signup" : "/auth/login"}>
          {isLogin ? "Sign Up" : "Log In"}
        </Link>
      </div>
    </div>
  );
}
