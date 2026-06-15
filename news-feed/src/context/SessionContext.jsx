import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { clearToken, getSessionFromToken, getToken, setToken } from "../auth";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState("");
  const [editorMode, setEditorMode] = useState("registered");

  // Sync session to localStorage so utils/auth.js (ensureUserInitialized) can find it
  const syncToLocalStorage = (token, sessionData) => {
    if (token && sessionData?.userId) {
      localStorage.setItem("token", token);
      localStorage.setItem("userId", String(sessionData.userId));
      localStorage.setItem("userType", sessionData.type || "REGISTERED");
      localStorage.setItem("roles", JSON.stringify(sessionData.roles || []));
      setToken(token);
    }
  };

  const clearLocalStorage = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userType");
    localStorage.removeItem("roles");
  };

  useEffect(() => {
    async function bootstrap() {
      try {
        const existing = getToken();
        if (existing) {
          const parsed = getSessionFromToken(existing);
          if (parsed) {
            setSession(parsed);
            syncToLocalStorage(existing, parsed);
            setNotice("");
            setBooting(false);
            return;
          }
        }
        
        try {
          const response = await api.post("/auth/limited");
          const token = response.data?.token;
          if (token) {
            setToken(token);
            const parsedSession = getSessionFromToken(token);
            setSession(parsedSession);
            syncToLocalStorage(token, parsedSession);
            setNotice("Guest mode enabled.");
          }
        } catch {
          setNotice("Guest mode enabled with limited access.");
        }
      } finally {
        setBooting(false);
      }
    }
    bootstrap();
  }, []);

  const value = useMemo(() => ({
    booting,
    session,
    notice,
    setNotice,
    setSession,
    editorMode,
    setEditorMode,
    updateToken: (token) => {
      setToken(token);
      const parsed = getSessionFromToken(token);
      setSession(parsed);
      syncToLocalStorage(token, parsed);
    },
    logout: () => {
      clearToken();
      setSession(null);
      clearLocalStorage();
    }
  }), [booting, notice, session, editorMode]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return value;
}