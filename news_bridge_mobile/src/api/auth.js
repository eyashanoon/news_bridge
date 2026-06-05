import { apiClient } from "./apiClient";
import storage from "../utils/storage";

// Persisted storage keys — matching news-feed's auth.js (localStorage)
const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";
const USER_TYPE_KEY = "userType";

// In-memory cache (loaded from persistent storage on first access)
let _token = null;
let _userId = null;
let _userType = null;
let _loaded = false;

// Load from persistent storage on module init (async, called by ensureUserInitialized)
async function loadFromStorage() {
  if (_loaded) return;
  // Load each key from persistent storage (async, reads from SecureStore/AsyncStorage)
  try {
    const [token, userId, userType] = await Promise.all([
      storage.loadKey(TOKEN_KEY),
      storage.loadKey(USER_ID_KEY),
      storage.loadKey(USER_TYPE_KEY),
    ]);
    if (token) _token = token;
    if (userId) _userId = userId;
    if (userType) _userType = userType;
  } catch (err) {
    console.warn("Failed to load auth from storage:", err.message);
  }
  _loaded = true;
  console.log("Auth loadFromStorage: token=", !!_token, "userId=", _userId);
}

// Decode JWT payload
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
  return _token;
}

export function getUserId() {
  return _userId;
}

export function getUserType() {
  return _userType;
}

export async function logout() {
  _token = null;
  _userId = null;
  _userType = null;
  _loaded = false;
  await Promise.all([
    storage.removeItem(TOKEN_KEY),
    storage.removeItem(USER_ID_KEY),
    storage.removeItem(USER_TYPE_KEY),
  ]);
}

export async function ensureUserInitialized() {
  await loadFromStorage();

  // Already initialized in persistent storage
  if (_token && _userId) {
    return { token: _token, userId: _userId };
  }

  console.log("No user token found. Creating primitive user...");

  const res = await apiClient.post("/auth/limited");

  const token = res.data?.token;
  if (!token) throw new Error("Failed to get token from auth response");

  const decoded = decodeJwt(token);
  if (!decoded?.sub) {
    throw new Error("Token is invalid (missing sub)");
  }

  _token = token;
  _userId = decoded.sub;
  _userType = decoded.type || "PRIMITIVE";

  // Persist to storage so the same user is reused across app launches
  await Promise.all([
    storage.setItem(TOKEN_KEY, _token),
    storage.setItem(USER_ID_KEY, _userId),
    storage.setItem(USER_TYPE_KEY, _userType),
  ]);

  console.log("Primitive user created:", _userId);

  return { token: _token, userId: _userId };
}
