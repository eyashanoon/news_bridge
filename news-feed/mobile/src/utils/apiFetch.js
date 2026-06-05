import { ensureUserInitialized, getToken, logout } from "./auth";

export async function apiFetch(url, options = {}) {
  await ensureUserInitialized();
  const token = await getToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    console.warn("Unauthorized, clearing token...");
    await logout();
  }
  return res;
}