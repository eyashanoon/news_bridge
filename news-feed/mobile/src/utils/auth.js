import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_CONFIG } from "../api/config";
const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";
const USER_TYPE_KEY = "userType";
const ROLES_KEY = "roles";

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export function getTokenSync() {
  // Not available in RN sync way, use async
  return null;
}

export async function setToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getUserId() {
  const stored = await AsyncStorage.getItem(USER_ID_KEY);
  if (stored) return stored;

  const token = await getToken();
  if (!token) return null;

  const decoded = decodeJwt(token);
  if (decoded?.sub) {
    await setUserId(decoded.sub);
    return decoded.sub;
  }
  return null;
}

export async function setUserId(id) {
  await AsyncStorage.setItem(USER_ID_KEY, id);
}

export async function getUserRoles() {
  try {
    const val = await AsyncStorage.getItem(ROLES_KEY);
    return JSON.parse(val) || [];
  } catch {
    return [];
  }
}

export async function getUserType() {
  const token = await getToken();
  if (token) {
    const decoded = decodeJwt(token);
    if (decoded?.type) return decoded.type;
  }
  return (await AsyncStorage.getItem(USER_TYPE_KEY)) || null;
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY, USER_TYPE_KEY, ROLES_KEY]);
}

export async function ensureUserInitialized() {
  let token = await getToken();
  let userId = await getUserId();

  if (token && userId) return { token, userId };

  try {
    const res = await fetch(`${API_CONFIG.baseURL}/auth/limited`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to create primitive user");
    const data = await res.json();
    token = data.token;
    const decoded = decodeJwt(token);
    if (!decoded?.sub) throw new Error("Token is invalid");
    userId = decoded.sub;
    await setToken(token);
    await setUserId(userId);
    await AsyncStorage.setItem(USER_TYPE_KEY, decoded.type || "PRIMITIVE");
    await AsyncStorage.setItem(ROLES_KEY, JSON.stringify(data.roles || []));
    return { token, userId };
  } catch (err) {
    console.error("Failed to initialize user:", err);
    throw err;
  }
}

export async function getSessionFromToken(token) {
  if (!token) return null;
  const payload = decodeJwt(token);
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