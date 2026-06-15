const DEFAULT_EDITOR_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%25' height='100%25' fill='%231f2937'/><circle cx='60' cy='44' r='21' fill='%2334d399'/><rect x='24' y='72' width='72' height='32' rx='16' fill='%2310b981'/></svg>";

const DEFAULT_ADMIN_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%25' height='100%25' fill='%230f172a'/><circle cx='60' cy='44' r='21' fill='%2338bdf8'/><rect x='24' y='72' width='72' height='32' rx='16' fill='%232563eb'/></svg>";

const DEFAULT_USER_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%25' height='100%25' fill='%232f3b4f'/><circle cx='60' cy='44' r='21' fill='%2394a3b8'/><rect x='24' y='72' width='72' height='32' rx='16' fill='%2364748b'/></svg>";

export function resolveAvatar(src, type = "user") {
  if (src && src.trim()) return src;
  if (type === "admin") return DEFAULT_ADMIN_AVATAR;
  if (type === "editor") return DEFAULT_EDITOR_AVATAR;
  return DEFAULT_USER_AVATAR;
}

export function displayNameFromEmail(email) {
  if (!email) return "Unknown";
  return email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
