export function expandedPlotHeight(fallback = 200) {
  if (typeof window === "undefined") return fallback;
  return Math.min(380, Math.round(window.innerHeight * 0.38));
}

export function expandedDonutSize(fallback = 160) {
  if (typeof window === "undefined") return fallback;
  return Math.min(280, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.28));
}
