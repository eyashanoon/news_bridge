import { API_CONFIG } from "../api/config";
import { ensureUserInitialized, getToken, getUserType, logout } from "./auth";

function resolveUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${API_CONFIG.baseURL}${path}`;
}

export async function apiFetch(url, options = {}, retried = false) {
  await ensureUserInitialized();
  const token = await getToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(resolveUrl(url), { ...options, headers });
  if (res.status === 401 && !retried) {
    const userType = await getUserType();
    const wasRegistered = userType === "REGISTERED" || userType === "EDITOR";
    console.warn(wasRegistered ? "Registered session expired." : "Session invalid, reinitializing user...");
    await logout();
    if (wasRegistered) {
      return res;
    }
    await ensureUserInitialized();
    return apiFetch(url, options, true);
  }
  return res;
}
