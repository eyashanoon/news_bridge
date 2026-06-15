import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSessionFromToken, getToken, setToken } from "../utils/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_CONFIG } from "../api/config";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState("");

  const syncToStorage = async (token, sessionData) => {
    if (token && sessionData?.userId) {
      await setToken(token);
      await AsyncStorage.setItem("userId", sessionData.userId);
      await AsyncStorage.setItem("userType", sessionData.type || "PRIMITIVE");
      await AsyncStorage.setItem("roles", JSON.stringify(sessionData.roles || []));
    }
  };

  const clearStorage = async () => {
    await AsyncStorage.multiRemove(["token", "userId", "userType", "roles"]);
  };

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const existing = await getToken();
        if (existing) {
          const parsed = await getSessionFromToken(existing);
          if (parsed) {
            if (!cancelled) {
              setSession(parsed);
              await syncToStorage(existing, parsed);
              setNotice("");
            }
            return;
          }
        }
        
        // Use direct fetch with timeout - axios can hang on Android when network is unreachable
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(`${API_CONFIG.baseURL}/auth/limited`, {
            method: "POST",
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (response.ok) {
            const data = await response.json();
            if (data?.token && !cancelled) {
              await setToken(data.token);
              const parsedSession = await getSessionFromToken(data.token);
              setSession(parsedSession);
              await syncToStorage(data.token, parsedSession);
              setNotice("Guest mode enabled.");
            }
          } else {
            if (!cancelled) setNotice("Guest mode enabled with limited access.");
          }
        } catch {
          clearTimeout(timeout);
          if (!cancelled) setNotice("Guest mode enabled with limited access.");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({
    booting,
    session,
    notice,
    setNotice,
    setSession,
    updateToken: async (token) => {
      await setToken(token);
      const parsed = await getSessionFromToken(token);
      setSession(parsed);
      await syncToStorage(token, parsed);
    },
    logout: async () => {
      await clearStorage();
      setSession(null);
    }
  }), [booting, notice, session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
