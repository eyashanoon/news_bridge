// languageUtils.js — Detect whether text is Arabic by content analysis

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Check if the given text contains Arabic script characters.
 * Returns true if any Arabic Unicode characters are found.
 */
export function isArabicText(text) {
  if (!text) return false;
  return ARABIC_REGEX.test(text);
}

/**
 * Determine the effective language of a post or comment.
 * Uses the `lang` field if available and reliable, otherwise falls back
 * to content-based detection.
 *
 * @param {Object} item - Post or comment object with optional `lang` field
 * @param {string} item.lang - Language field from the backend (may be missing or wrong)
 * @param {string} item.text - Text content (for posts)
 * @param {string} item.content - Text content (for comments)
 * @returns {string} "ar" or "en" based on best detection
 */
export function detectItemLanguage(item) {
  // If backend explicitly set a language, trust it
  if (item && item.lang) {
    // Normalize: if it's "ar" or "ara" or "AR" etc.
    const lang = item.lang.toLowerCase().slice(0, 2);
    if (lang === "ar") return "ar";
    if (lang === "en") return "en";
  }

  // Fall back to content-based detection
  const content = (item && (item.text || item.content || item.title || "")) || "";
  return isArabicText(content) ? "ar" : "en";
}