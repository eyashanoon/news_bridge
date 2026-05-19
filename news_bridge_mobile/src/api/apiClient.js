import axios from "axios";

const BASE_URL = "http://10.0.2.2:8080";
// if using real phone: use your PC IP like http://192.168.1.20:8080

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Request interceptor: attach auth token if available (without calling ensureUserInitialized
// to avoid circular dependency - ensureUserInitialized uses apiClient internally)
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const { getToken } = await import("./auth");
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn("Auth interceptor failed:", err.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401/403 by clearing token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn("Unauthorized, clearing token...");
      try {
        const { logout } = await import("./auth");
        logout();
      } catch {}
    }
    return Promise.reject(error);
  }
);