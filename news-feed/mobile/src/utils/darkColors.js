// Dark mode color palette — mirrors news-feed web dark mode CSS variables
export const dark = {
  // Backgrounds
  bg: "#0f172a",
  surface: "#1e293b",
  subtle: "#1a2332",
  surfaceHover: "#253449",

  // Text
  text: "#f1f5f9",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",

  // Borders
  border: "#334155",

  // Brand
  brandBg: "rgba(59, 130, 246, 0.2)",
  brandText: "#60a5fa",

  // Accent
  accentBg: "#334155",
  accentText: "#94a3b8",

  // Badge
  badgeBg: "#1e3a5f",
  badgeText: "#60a5fa",

  // Input
  inputBg: "#1a2332",
  inputBorder: "#334155",
  inputText: "#f1f5f9",

  // Card
  cardBg: "#1e293b",
  cardBorder: "#334155",

  // Status
  success: "#10b981",
  error: "#ef4444",
  warning: "#fbbf24",

  // Overlay
  overlay: "rgba(0, 0, 0, 0.7)",
};

// Helper to get themed style based on darkMode flag
export function th(darkMode, darkVal, lightVal) {
  return darkMode ? darkVal : lightVal;
}