import { apiClient } from "./apiClient";

// In-memory storage (React Native doesn't have localStorage)
let _token = null;
let _userId = null;
let _userType = null;

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

export function logout() {
  _token = null;
  _userId = null;
  _userType = null;
}

export async function ensureUserInitialized() {
  // Already initialized in memory
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

  console.log("Primitive user created:", _userId);

  return { token: _token, userId: _userId };
}