// src/utils/auth.js

const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";
const USER_TYPE_KEY = "userType";
const ROLES_KEY = "roles";

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

// This ensures a guest/primitive user exists (or uses stored token)
export async function ensureUserInitialized() {
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