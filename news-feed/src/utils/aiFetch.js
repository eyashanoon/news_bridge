// utils/aiFetch.js
export const AI_BASE_URL =
  import.meta.env.VITE_AI_BASE_URL ??
  (import.meta.env.DEV ? "/ai" : "http://localhost:9000");

export async function aiFetch(path, options = {}) {
  return fetch(`${AI_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
}