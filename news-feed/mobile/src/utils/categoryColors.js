export const categoryTheme = {
  General: {
    light: { bg: "#f1f5f9", surface: "#ffffff", subtle: "#f8fafc", accent: "#64748b", accentLight: "#cbd5e1", text: "#334155", border: "#94a3b8", glow: "rgba(100,116,139,0.18)", pillBg: "#64748b", pillText: "#ffffff", accentHover: "#475569" },
    dark: { bg: "#0f172a", surface: "#1e293b", subtle: "#1a2332", accent: "#94a3b8", accentLight: "#334155", text: "#cbd5e1", border: "#334155", glow: "rgba(148,163,184,0.15)", pillBg: "#475569", pillText: "#e2e8f0", accentHover: "#64748b" },
  },
  Politics: {
    light: { bg: "#e0f2fe", surface: "#ffffff", subtle: "#f0f7ff", accent: "#1d4ed8", accentLight: "#bfdbfe", text: "#1e3a8a", border: "#60a5fa", glow: "rgba(29,78,216,0.18)", pillBg: "#1d4ed8", pillText: "#ffffff", accentHover: "#2563eb" },
    dark: { bg: "#0c1a33", surface: "#112240", subtle: "#0f1d3a", accent: "#60a5fa", accentLight: "#1e3a5f", text: "#93c5fd", border: "#1e3a5f", glow: "rgba(96,165,250,0.15)", pillBg: "#1e40af", pillText: "#dbeafe", accentHover: "#3b82f6" },
  },
  Sports: {
    light: { bg: "#ffedd5", surface: "#ffffff", subtle: "#fff7ed", accent: "#c2410c", accentLight: "#fed7aa", text: "#9a3412", border: "#fb923c", glow: "rgba(194,65,12,0.18)", pillBg: "#c2410c", pillText: "#ffffff", accentHover: "#ea580c" },
    dark: { bg: "#1f1206", surface: "#2d1a0a", subtle: "#241508", accent: "#fb923c", accentLight: "#3d2410", text: "#fdba74", border: "#3d2410", glow: "rgba(251,146,60,0.15)", pillBg: "#c2410c", pillText: "#ffedd5", accentHover: "#f97316" },
  },
  Finance: {
    light: { bg: "#dcfce7", surface: "#ffffff", subtle: "#f0fdf4", accent: "#16a34a", accentLight: "#86efac", text: "#166534", border: "#4ade80", glow: "rgba(22,163,74,0.18)", pillBg: "#16a34a", pillText: "#ffffff", accentHover: "#22c55e" },
    dark: { bg: "#072713", surface: "#0d3a1d", subtle: "#0a3017", accent: "#4ade80", accentLight: "#14532d", text: "#86efac", border: "#14532d", glow: "rgba(74,222,128,0.15)", pillBg: "#15803d", pillText: "#dcfce7", accentHover: "#22c55e" },
  },
  Medical: {
    light: { bg: "#fee2e2", surface: "#ffffff", subtle: "#fef2f2", accent: "#b91c1c", accentLight: "#fca5a5", text: "#991b1b", border: "#f87171", glow: "rgba(185,28,28,0.15)", pillBg: "#b91c1c", pillText: "#ffffff", accentHover: "#dc2626" },
    dark: { bg: "#2a0a0a", surface: "#3d1212", subtle: "#330e0e", accent: "#f87171", accentLight: "#450a0a", text: "#fca5a5", border: "#450a0a", glow: "rgba(248,113,113,0.15)", pillBg: "#b91c1c", pillText: "#fee2e2", accentHover: "#ef4444" },
  },
  Tech: {
    light: { bg: "#cffafe", surface: "#ffffff", subtle: "#ecfeff", accent: "#0891b2", accentLight: "#67e8f9", text: "#155e75", border: "#22d3ee", glow: "rgba(8,145,178,0.18)", pillBg: "#0891b2", pillText: "#ffffff", accentHover: "#0ea5e9" },
    dark: { bg: "#06242b", surface: "#0a3440", subtle: "#082c36", accent: "#22d3ee", accentLight: "#164e63", text: "#67e8f9", border: "#164e63", glow: "rgba(34,211,238,0.15)", pillBg: "#0e7490", pillText: "#cffafe", accentHover: "#06b6d4" },
  },
  Culture: {
    light: { bg: "#f3e8ff", surface: "#ffffff", subtle: "#faf5ff", accent: "#7c3aed", accentLight: "#d8b4fe", text: "#6b21a8", border: "#a78bfa", glow: "rgba(124,58,237,0.18)", pillBg: "#7c3aed", pillText: "#ffffff", accentHover: "#8b5cf6" },
    dark: { bg: "#1c0a2b", surface: "#2a1240", subtle: "#220e35", accent: "#a855f7", accentLight: "#3b0764", text: "#d8b4fe", border: "#3b0764", glow: "rgba(168,85,247,0.15)", pillBg: "#7c3aed", pillText: "#f3e8ff", accentHover: "#9333ea" },
  },
  Religion: {
    light: { bg: "#fef3c7", surface: "#ffffff", subtle: "#fffbeb", accent: "#b45309", accentLight: "#fcd34d", text: "#92400e", border: "#fbbf24", glow: "rgba(180,83,9,0.18)", pillBg: "#b45309", pillText: "#ffffff", accentHover: "#d97706" },
    dark: { bg: "#1f1406", surface: "#2d1d0a", subtle: "#26180a", accent: "#fbbf24", accentLight: "#451a03", text: "#fcd34d", border: "#451a03", glow: "rgba(251,191,36,0.15)", pillBg: "#b45309", pillText: "#fef3c7", accentHover: "#f59e0b" },
  },
};

export const categoryColors = Object.fromEntries(
  Object.entries(categoryTheme).map(([key, val]) => [
    key,
    { text: "text-inherit", border: "border-inherit", bg: val.light.bg, accent: val.light.accent },
  ])
);