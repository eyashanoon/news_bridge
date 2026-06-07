import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { categoryTheme } from "../utils/categoryColors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "newsbridge_theme";
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false);
  const [currentCategory, setCurrentCategory] = useState("General");
  const [menuOpen, setMenuOpen] = useState(false);

  // Restore persisted theme on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === "dark") setDarkMode(true);
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ darkMode, toggleDarkMode, currentCategory, setCurrentCategory, menuOpen, setMenuOpen }),
    [darkMode, toggleDarkMode, currentCategory, menuOpen]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}