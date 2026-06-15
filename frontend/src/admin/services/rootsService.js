import { api, authConfig } from "./adminApi";

export async function listRoots(token, params = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await api.get(`/roots${suffix}`, authConfig(token));
  return res.data || [];
}

export async function createRoot(token, body) {
  const res = await api.post("/roots", body, authConfig(token));
  return res.data;
}

export async function updateRoot(token, id, body) {
  const res = await api.put(`/roots/${id}`, body, authConfig(token));
  return res.data;
}

export async function updateRootStatus(token, id, status) {
  const res = await api.put(`/roots/${id}/status`, { status }, authConfig(token));
  return res.data;
}

export async function deleteRoot(token, id) {
  await api.delete(`/roots/${id}?hard=true`, authConfig(token));
}

export async function verifyRoot(token, id) {
  const res = await api.post(`/roots/${id}/verify`, {}, authConfig(token));
  return res.data;
}

export async function listEndpoints(token, params = {}) {
  const qs = new URLSearchParams();
  if (params.rootId) qs.set("rootId", params.rootId);
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await api.get(`/endpoints${suffix}`, authConfig(token));
  return res.data || [];
}

export async function createEndpoint(token, body) {
  const res = await api.post("/endpoints", body, authConfig(token));
  return res.data;
}

export async function updateEndpoint(token, id, body) {
  const res = await api.put(`/endpoints/${id}`, body, authConfig(token));
  return res.data;
}

export async function updateEndpointStatus(token, id, status) {
  const res = await api.put(`/endpoints/${id}/status`, { status }, authConfig(token));
  return res.data;
}

export async function deleteEndpoint(token, id) {
  await api.delete(`/endpoints/${id}?hard=true`, authConfig(token));
}
