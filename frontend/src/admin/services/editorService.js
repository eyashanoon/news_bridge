import { api, authConfig } from "./adminApi";

export async function getEditors(token, params = {}) {
  const res = await api.get("/api/admin/manage/editor-users", authConfig(token));
  const items = Array.isArray(res.data) ? res.data : [];
  return {
    items,
    total: items.length,
    page: 0,
    size: items.length,
    totalPages: 1,
  };
}

export async function getEditorById(token, id) {
  const res = await api.get(`/api/admin/manage/editor-users/${id}`, authConfig(token));
  return res.data;
}

export async function getEditorStats(token) {
  const res = await api.get("/api/admin/analytics/editors/stats", authConfig(token));
  return res.data;
}

export async function getEditorAnalytics(token, periodDays = 30) {
  const res = await api.get("/api/admin/analytics/editors/summary", {
    ...authConfig(token),
    params: { periodDays },
  });
  return res.data;
}

export async function getEditorProfileAnalytics(token, id, periodDays = 30) {
  const res = await api.get(`/api/admin/analytics/editors/${id}`, {
    ...authConfig(token),
    params: { periodDays },
  });
  return res.data;
}

export async function getEditorContent(token, id, params = {}) {
  const res = await api.get(`/api/admin/manage/editor-users/${id}/content`, {
    ...authConfig(token),
    params,
  });
  return res.data;
}

export async function getEditorActivity(token, id) {
  const res = await api.get(`/api/admin/manage/editor-users/${id}/activity`, authConfig(token));
  return res.data;
}

export async function suspendEditor(token, id) {
  const res = await api.put(
    `/api/admin/manage/editor-users/${id}/status`,
    { status: "SUSPENDED" },
    authConfig(token),
  );
  return res.data;
}

export async function activateEditor(token, id) {
  const res = await api.put(
    `/api/admin/manage/editor-users/${id}/status`,
    { status: "ACTIVE" },
    authConfig(token),
  );
  return res.data;
}

export async function promoteEditor(token, id) {
  const res = await api.put(`/api/admin/manage/editor-users/${id}/promote`, {}, authConfig(token));
  return res.data;
}

export async function updateEditorRoles(token, id, roles) {
  const res = await api.put(
    `/api/admin/manage/editor-users/${id}/roles`,
    { roles },
    authConfig(token),
  );
  return res.data;
}

export async function assignCategories(token, id, fieldIds) {
  const res = await api.put(
    `/api/admin/manage/editor-users/${id}/categories`,
    { fieldIds },
    authConfig(token),
  );
  return res.data;
}

export async function deleteEditor(token, id) {
  await api.delete(`/api/admin/manage/editor-users/${id}`, authConfig(token));
}
