import { api, authConfig } from "./adminApi";

export async function listRoots(token) {
  const res = await api.get("/roots", authConfig(token));
  return res.data || [];
}

export async function listEndpoints(token, params = {}) {
  const qs = new URLSearchParams();
  if (params.rootId) qs.set("rootId", params.rootId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await api.get(`/endpoints${suffix}`, authConfig(token));
  return res.data || [];
}

export async function listArticlesForAdmin(token, params = {}) {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 0));
  qs.set("size", String(params.size ?? 20));
  if (params.search) qs.set("search", params.search);
  if (params.rootId) qs.set("rootId", params.rootId);
  if (params.endpointId) qs.set("endpointId", params.endpointId);
  const res = await api.get(`/articles/admin?${qs.toString()}`, authConfig(token));
  return res.data;
}

export async function getArticleBlocks(token, id) {
  const res = await api.get(`/articles/${id}/blocks`, authConfig(token));
  return res.data;
}

export async function deleteArticle(token, id) {
  await api.delete(`/articles/${id}`, authConfig(token));
}

export async function deleteArticleBlock(token, articleId, blockId) {
  await api.delete(`/articles/${articleId}/blocks/${blockId}`, authConfig(token));
}
