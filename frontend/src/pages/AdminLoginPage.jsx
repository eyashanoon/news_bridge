import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../context/SessionContext";
import { getSessionFromToken } from "../auth";

export default function AdminLoginPage() {
  const { updateToken, setNotice, session } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });

  const alreadyAdmin = session?.type === "ADMIN";

  useEffect(() => {
    if (alreadyAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [alreadyAdmin, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      // NOTE: Pointing to the new Admin-Only endpoint
      const res = await api.post("/auth/admin/login", form);
      if (!res.data?.token) {
        setNotice("Admin login failed.");
        return;
      }

      const parsedSession = getSessionFromToken(res.data.token);
      if (parsedSession?.type !== "ADMIN") {
        setNotice("Access Denied. Terminal requires an administrator account.");
        return;
      }

      updateToken(res.data.token);
      setNotice("Admin authentication successful.");
      navigate("/admin", { replace: true });
    } catch (err) {
      setNotice(err?.response?.data?.message || "System login failed.");
    }
  };

  if (alreadyAdmin) {
    return null;
  }

  return (
    <section className="cyber-login">
      <div className="cyber-header">
        <h2 className="glow-text">MAINFRAME ACCESS</h2>
        <p>Restricted area. Admin clearance required.</p>
      </div>

      <form className="cyber-panel" onSubmit={submit}>
        <h3>Authenticate</h3>
        <input className="cyber-input" placeholder="Admin Identity (Email)" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
        <input className="cyber-input" placeholder="Cipher (Password)" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
        <button type="submit" className="cyber-button">Initialize Link</button>
      </form>
    </section>
  );
}
