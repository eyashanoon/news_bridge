/** Format numeric chart labels — one decimal for floats, plain integer otherwise. */
export function formatChartValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export function formatChartAxisLabel(raw, labelKey, maxLen = 10) {
  const value = String(raw ?? "");
  if (!value) return "";

  const looksLikeDate = labelKey === "date" || /^\d{4}-\d{2}-\d{2}/.test(value);
  if (looksLikeDate) {
    try {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      }
    } catch {
      // fall through to truncation
    }
  }

  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

export function computeAxisLabelStep(count, expanded = false) {
  const maxLabels = expanded ? 10 : 6;
  if (count <= maxLabels) return 1;
  return Math.ceil(count / maxLabels);
}

export function shouldShowAxisLabel(index, count, step) {
  if (count <= 1) return true;
  return index % step === 0 || index === count - 1;
}
