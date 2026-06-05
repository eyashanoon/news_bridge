// src/utils/auth.js

const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";
const USER_TYPE_KEY = "userType";
const ROLES_KEY = "roles";
const TOKEN_COOKIE = "nf_token";

// decode JWT payload
function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (err) {
    console.error("Failed to decode JWT:", err);
    return null;
  }
}

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

function getCookieToken() {
  const cookies = parseCookieString(document.cookie || "");
  return cookies[TOKEN_COOKIE] || null;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserId() {
  return localStorage.getItem(USER_ID_KEY);
}

export function getUserRoles() {
  try {
    return JSON.parse(localStorage.getItem(ROLES_KEY)) || [];
  } catch {
    return [];
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_TYPE_KEY);
  localStorage.removeItem(ROLES_KEY);
}

// Sync cookie token to localStorage if available (prefer registered/editor tokens over primitive)
function trySyncFromCookie() {
  const cookieToken = getCookieToken();
  if (!cookieToken) return false;

  const decoded = decodeJwt(cookieToken);
  if (!decoded?.sub) return false;

  const cookieType = decoded.type || "PRIMITIVE";
  const localToken = getToken();
  const localType = localStorage.getItem(USER_TYPE_KEY);

  // If the cookie has a registered/editor session and local has primitive, override
  const isCookieAuth = cookieType === "REGISTERED" || cookieType === "EDITOR";
  const isLocalPrimitive = !localToken || localType === "PRIMITIVE";

  if (!isCookieAuth && localToken) {
    return false; // keep existing primitive token
  }

  if (isLocalPrimitive || isCookieAuth) {
    localStorage.setItem(TOKEN_KEY, cookieToken);
    localStorage.setItem(USER_ID_KEY, decoded.sub);
    localStorage.setItem(USER_TYPE_KEY, cookieType);
    localStorage.setItem(ROLES_KEY, JSON.stringify(decoded.roles || []));
    return true;
  }

  return false;
}

// This ensures a guest/primitive user exists (or uses stored token)
export async function ensureUserInitialized() {
  // First, try to sync from cookie (registered user session)
  trySyncFromCookie();

  let token = getToken();
  let userId = getUserId();

  // already initialized
  if (token && userId) return { token, userId };

  console.log("No user token found. Creating primitive user...");

  const res = await fetch("/auth/limited", {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error("Failed to create primitive user");
  }

  const data = await res.json();

  token = data.token;

  const decoded = decodeJwt(token);
  if (!decoded?.sub) {
    throw new Error("Token is invalid (missing sub)");
  }

  userId = decoded.sub;

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, userId);
  localStorage.setItem(USER_TYPE_KEY, decoded.type || "PRIMITIVE");
  localStorage.setItem(ROLES_KEY, JSON.stringify(data.roles || []));

  console.log("Primitive user created:", userId);

  return { token, userId };
}
