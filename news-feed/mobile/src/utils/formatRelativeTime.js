/** Relative time string for feed cards (matches web formatRelativeTime.js). */
export function formatRelativeTime(value, lang = "en") {
  if (!value) return "";
  const publishedAt = new Date(value);
  if (Number.isNaN(publishedAt.getTime())) return "";

  const diffMs = Date.now() - publishedAt.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 7) {
    if (lang === "ar") {
      const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
      return `${publishedAt.getDate()} ${months[publishedAt.getMonth()]} ${publishedAt.getFullYear()}`;
    }
    return publishedAt.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  }
  if (lang === "ar") {
    if (diffDays >= 1) return `منذ ${diffDays} أيام`;
    if (diffHours >= 1) return `منذ ${diffHours} ساعات`;
    if (diffMinutes >= 1) return `منذ ${diffMinutes} دقائق`;
    return "الآن";
  }
  if (diffDays >= 1) return `${diffDays}d ago`;
  if (diffHours >= 1) return `${diffHours}h ago`;
  if (diffMinutes >= 1) return `${diffMinutes}m ago`;
  return "just now";
}
