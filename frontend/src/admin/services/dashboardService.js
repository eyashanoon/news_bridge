import { api, authConfig } from "./adminApi";

export async function getDashboardStats(token) {
  const res = await api.get("/api/admin/dashboard/stats", authConfig(token));
  return res.data;
}
