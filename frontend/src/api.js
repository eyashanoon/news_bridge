import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:8080",
  timeout: 15000,
});

export function authConfig(token) {
  if (!token) return {};
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}
