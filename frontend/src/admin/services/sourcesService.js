import { api, authConfig } from "../../api";

export function listRoots(token, params = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/roots${suffix}`, authConfig(token)).then((r) => r.data);
}

export function createRoot(token, body) {
  return api.post("/roots", body, authConfig(token)).then((r) => r.data);
}

export function updateRoot(token, id, body) {
  return api.put(`/roots/${id}`, body, authConfig(token)).then((r) => r.data);
}

export function updateRootStatus(token, id, status) {
  return api.put(`/roots/${id}/status`, { status }, authConfig(token)).then((r) => r.data);
}

export function deleteRoot(token, id, hard = true) {
  return api.delete(`/roots/${id}?hard=${hard}`, authConfig(token));
}

export function verifyRoot(token, id) {
  return api.post(`/roots/${id}/verify`, {}, authConfig(token)).then((r) => r.data);
}

export function startDiscovery(token, rootId) {
  return api.post(`/roots/${rootId}/discover`, {}, { ...authConfig(token), timeout: 30000 }).then((r) => r.data);
}

export function pollDiscoveryJob(token, rootId, jobId, logOffset = 0) {
  return api
    .get(`/roots/${rootId}/discover/jobs/${jobId}?logOffset=${logOffset}`, { ...authConfig(token), timeout: 30000 })
    .then((r) => r.data);
}

export function assessEndpoint(token, rootId, url) {
  return api.post(`/roots/${rootId}/discover/assess`, { url }, { ...authConfig(token), timeout: 120000 }).then((r) => r.data);
}

export function bulkSaveDiscoveredEndpoints(token, rootId, urls) {
  return api.post(`/roots/${rootId}/endpoints/bulk`, { urls }, authConfig(token)).then((r) => r.data);
}

export function listEndpoints(token, params = {}) {
  const qs = new URLSearchParams();
  if (params.rootId) qs.set("rootId", params.rootId);
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/endpoints${suffix}`, authConfig(token)).then((r) => r.data);
}

export function createEndpoint(token, body) {
  return api.post("/endpoints", body, authConfig(token)).then((r) => r.data);
}

export function updateEndpoint(token, id, body) {
  return api.put(`/endpoints/${id}`, body, authConfig(token)).then((r) => r.data);
}

export function updateEndpointStatus(token, id, status) {
  return api.put(`/endpoints/${id}/status`, { status }, authConfig(token)).then((r) => r.data);
}

export function getEndpointDeleteImpact(token, id) {
  return api.get(`/endpoints/${id}/delete-impact`, authConfig(token)).then((r) => r.data);
}

export function deleteEndpoint(token, id, hard = false) {
  return api.delete(`/endpoints/${id}?hard=${hard}`, authConfig(token));
}

export function bulkEndpointAction(token, body) {
  return api.post("/endpoints/bulk", body, authConfig(token)).then((r) => r.data);
}

export function getEndpointAnalytics(token, rootId) {
  const qs = rootId ? `?rootId=${rootId}` : "";
  return api.get(`/endpoints/analytics${qs}`, authConfig(token)).then((r) => r.data);
}
