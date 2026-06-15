import axios from "axios";
import { API_CONFIG } from "./config";

export const api = axios.create({
  baseURL: API_CONFIG.baseURL,
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