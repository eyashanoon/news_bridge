import { api, authConfig } from "./adminApi";

export async function listEditorRequests(token) {
  const res = await api.get("/api/editor-requests", authConfig(token));
  return res.data;
}

export async function approveEditorRequest(token, id) {
  await api.post(`/api/editor-requests/${id}/approve`, {}, authConfig(token));
}

export async function rejectEditorRequest(token, id) {
  await api.post(`/api/editor-requests/${id}/reject`, {}, authConfig(token));
}
