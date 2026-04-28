// utils/aiFetch.js
export async function aiFetch(path, options = {}) {
  const AI_BASE_URL = "http://localhost:9000";

  return fetch(`${AI_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
}