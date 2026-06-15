// src/utils/apiFetch.js
import { ensureUserInitialized, getToken, logout } from "./auth";

export async function apiFetch(url, options = {}, retried = false) {
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

  if (res.status === 401 && !retried) {
    console.warn("Session invalid, reinitializing user...");
    logout();
    await ensureUserInitialized();
    return apiFetch(url, options, true);
  }

  if (res.status === 403) {
    console.warn("Forbidden request");
  }

  return res;
}