import { api, authConfig } from "./adminApi";

export async function listRegisteredUsers(token) {
  const res = await api.get("/api/admin/manage/registered-users", authConfig(token));
  return res.data;
}

export async function listRegisteredUsersPaged(token, params = {}) {
  const res = await api.get("/api/admin/manage/search/registered-users", {
    ...authConfig(token),
    params,
  });
  return res.data;
}

export async function searchFrontendUsers(token, params = {}) {
  const res = await api.get("/api/admin/manage/search/frontend-users", {
    ...authConfig(token),
    params: { sort: "name", sortDir: "asc", size: 10, ...params },
  });
  return res.data;
}

export async function listAllFrontendUsersPaged(token, params = {}) {
  const res = await api.get("/api/admin/manage/search/frontend-users", {
    ...authConfig(token),
    params,
  });
  return res.data;
}

export async function listEditorUsers(token) {
  const res = await api.get("/api/admin/manage/editor-users", authConfig(token));
  return res.data;
}

export async function listEditorUsersPaged(token, params = {}) {
  const res = await api.get("/api/admin/manage/search/editor-users", {
    ...authConfig(token),
    params,
  });
  return res.data;
}

export async function updateRegisteredRoles(token, id, roles) {
  const res = await api.put(`/api/admin/manage/registered-users/${id}/roles`, { roles }, authConfig(token));
  return res.data;
}

export async function updateEditorRoles(token, id, roles) {
  const res = await api.put(`/api/admin/manage/editor-users/${id}/roles`, { roles }, authConfig(token));
  return res.data;
}

export async function updateRegisteredStatus(token, id, status) {
  const res = await api.put(`/api/admin/manage/registered-users/${id}/status`, { status }, authConfig(token));
  return res.data;
}

export async function updateEditorStatus(token, id, status) {
  const res = await api.put(`/api/admin/manage/editor-users/${id}/status`, { status }, authConfig(token));
  return res.data;
}

export async function deleteRegisteredUser(token, id) {
  await api.delete(`/api/admin/manage/registered-users/${id}`, authConfig(token));
}

export async function deleteEditorUser(token, id) {
  await api.delete(`/api/admin/manage/editor-users/${id}`, authConfig(token));
}

export async function getUserGrowthAnalytics(token, periodDays = 30) {
  const res = await api.get("/api/admin/analytics/users/growth", {
    ...authConfig(token),
    params: { periodDays },
  });
  return res.data;
}

export async function getUserActivityAnalytics(token, periodDays = 30) {
  const res = await api.get("/api/admin/analytics/users/activity", {
    ...authConfig(token),
    params: { periodDays },
  });
  return res.data;
}

export async function getUserSummaryAnalytics(token) {
  const res = await api.get("/api/admin/analytics/users/summary", authConfig(token));
  return res.data;
}

export async function getUserPreferencesAnalytics(token) {
  const res = await api.get("/api/admin/analytics/user-preferences", authConfig(token));
  return res.data;
}

export async function getUserInteractionsAnalytics(token, periodDays = 30) {
  const res = await api.get("/api/admin/analytics/user-interactions", {
    ...authConfig(token),
    params: { periodDays },
  });
  return res.data;
}

export async function getUserBehaviorProfile(token, userId, periodDays = 30) {
  const res = await api.get(`/api/admin/analytics/user-preferences/${userId}/profile`, {
    ...authConfig(token),
    params: { periodDays },
  });
  return res.data;
}

export async function getEditorAnalytics(token, periodDays = 30) {
  const res = await api.get("/api/admin/analytics/editors/summary", {
    ...authConfig(token),
    params: { periodDays },
  });
  return res.data;
}
