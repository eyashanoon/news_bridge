import { api, authConfig } from "./adminApi";

export async function listAdmins(token) {
  const res = await api.get("/api/admin/users", authConfig(token));
  return res.data;
}

export async function createAdmin(token, body) {
  const res = await api.post("/api/admin/users", body, authConfig(token));
  return res.data;
}

export async function updateAdminRoles(token, id, roles) {
  const res = await api.put(`/api/admin/users/${id}/roles`, { roles }, authConfig(token));
  return res.data;
}

export async function updateAdminStatus(token, id, status) {
  const res = await api.put(`/api/admin/users/${id}/status`, { status }, authConfig(token));
  return res.data;
}

export async function deleteAdmin(token, id) {
  await api.delete(`/api/admin/users/${id}`, authConfig(token));
}

export async function listPermissionGroups(token) {
  const res = await api.get("/api/admin/management/permission-groups", authConfig(token));
  return res.data;
}

export async function getActivityLogs(token, params = {}) {
  const res = await api.get("/api/admin/management/activity-logs", {
    ...authConfig(token),
    params,
  });
  return res.data;
}

export async function getAdminAnalytics(token, periodDays = 30) {
  const res = await api.get("/api/admin/management/analytics", {
    ...authConfig(token),
    params: { periodDays },
  });
  return res.data;
}
