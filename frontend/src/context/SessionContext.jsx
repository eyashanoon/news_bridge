import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { clearToken, getSessionFromToken, getToken, setToken } from "../auth";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState("");
  const [editorMode, setEditorMode] = useState("registered");

  useEffect(() => {
    async function bootstrap() {
      try {
        const existing = getToken();
        if (existing) {
          const parsed = getSessionFromToken(existing);
          if (parsed) {
            setSession(parsed);
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
            setSession(getSessionFromToken(token));
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
      setSession(getSessionFromToken(token));
    },
    logout: () => {
      clearToken();
      setSession(null);
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
