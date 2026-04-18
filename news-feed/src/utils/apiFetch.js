// src/utils/apiFetch.js
import { ensureUserInitialized, getToken, logout } from "./auth";

export async function apiFetch(url, options = {}) {
  await ensureUserInitialized();

  const token = getToken();

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  // if body is JSON, ensure correct header
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // If token expired/invalid, reset and re-init
  if (res.status === 401 || res.status === 403) {
    console.warn("Unauthorized, clearing token and reinitializing...");
    logout();
  }

  return res;
}