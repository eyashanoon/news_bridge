// ThemeContext.jsx — Category theming + dark mode toggle
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { categoryTheme } from "../utils/categoryColors";

const THEME_KEY = "newsbridge_theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  const [currentCategory, setCurrentCategory] = useState("General");

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  // Apply category CSS variables to :root
  useEffect(() => {
    const mode = darkMode ? "dark" : "light";
    const theme = categoryTheme[currentCategory]?.[mode] || categoryTheme.General[mode];

    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(`--cat-${key}`, value);
    });

    // Also set the body background directly for full coverage
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;
  }, [darkMode, currentCategory]);

  // Apply dark class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const value = useMemo(
    () => ({ darkMode, toggleDarkMode, currentCategory, setCurrentCategory }),
    [darkMode, toggleDarkMode, currentCategory]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}