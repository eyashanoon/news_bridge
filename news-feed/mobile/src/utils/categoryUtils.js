export const CATEGORY_SLUG_TO_NAME = {
  general: "General",
  politics: "Politics",
  sports: "Sports",
  finance: "Finance",
  medical: "Medical",
  tech: "Tech",
  culture: "Culture",
  religion: "Religion",
};

export const CATEGORY_NAME_TO_SLUG = Object.fromEntries(
  Object.entries(CATEGORY_SLUG_TO_NAME).map(([slug, name]) => [name, slug])
);

export const FEED_CATEGORY_KEY = "feed_category";

export function categoryFromSlug(slug) {
  if (!slug) return "General";
  return CATEGORY_SLUG_TO_NAME[String(slug).toLowerCase()] || "General";
}

export function slugFromCategory(category) {
  if (!category) return "general";
  return CATEGORY_NAME_TO_SLUG[category] || String(category).toLowerCase();
}
