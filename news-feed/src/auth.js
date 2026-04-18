const TOKEN_COOKIE = "gp_token";

function parseCookieString(cookieString) {
  return cookieString
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const [key, ...rest] = item.split("=");
      acc[key] = rest.join("=");
      return acc;
    }, {});
}

export function getToken() {
  const cookies = parseCookieString(document.cookie || "");
  return cookies[TOKEN_COOKIE] || null;
}

export function setToken(token) {
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${TOKEN_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearToken() {
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function safeBase64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + padding);
}

export function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const decoded = safeBase64UrlDecode(parts[1]);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getSessionFromToken(token) {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  return {
    token,
    userId: payload.sub || payload.userId || null,
    type: payload.type || "UNKNOWN",
    email: payload.email || null,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    createdAt: payload.createdAt || null,
  };
}