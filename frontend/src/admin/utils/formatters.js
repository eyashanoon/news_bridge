export function formatDate(value, fallback = "-") {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value, fallback = "-") {
  if (!value) return fallback;
  return new Date(value).toLocaleString();
}

export function formatCollectedAt(value, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()} ${pad(date.getMonth() + 1)} ${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
