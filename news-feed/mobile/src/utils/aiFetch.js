import { API_CONFIG } from "../api/config";

export const AI_BASE_URL = `http://${API_CONFIG.host}:9000`;

export async function aiFetch(path, options = {}) {
  return fetch(`${AI_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
}
