import { api, authConfig } from "./adminApi";

function cfg(token) {
  return authConfig(token);
}

export async function getTelegramKpis(token) {
  const res = await api.get("/api/admin/telegram/dashboard/kpis", cfg(token));
  return res.data;
}

export async function getChannelCountries(token) {
  const res = await api.get("/api/admin/telegram/channels/countries", cfg(token));
  return res.data;
}

export async function searchAdminChannels(token, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const res = await api.get(`/api/admin/telegram/channels?${q}`, cfg(token));
  return res.data;
}

export async function getChannelDetail(token, id) {
  const res = await api.get(`/api/admin/telegram/channels/${id}/detail`, cfg(token));
  return res.data;
}

export async function getChannelStatistics(token, id) {
  const res = await api.get(`/api/admin/telegram/channels/${id}/statistics`, cfg(token));
  return res.data;
}

export async function getChannelPerformance(token, id) {
  const res = await api.get(`/api/admin/telegram/channels/${id}/performance`, cfg(token));
  return res.data;
}

export async function getChannelUserInterest(token, id) {
  const res = await api.get(`/api/admin/telegram/channels/${id}/user-interest`, cfg(token));
  return res.data;
}

export async function refreshChannelProfile(token, id) {
  await api.post(`/api/admin/telegram/channels/${id}/refresh-profile`, {}, cfg(token));
}

export async function searchAdminPosts(token, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const res = await api.get(`/api/admin/telegram/posts?${q}`, cfg(token));
  return res.data;
}

export async function getPostDetail(token, id) {
  const res = await api.get(`/api/admin/telegram/posts/${id}/detail`, cfg(token));
  return res.data;
}

export async function retagPost(token, id) {
  await api.post(`/api/admin/telegram/posts/${id}/retag`, {}, cfg(token));
}

export async function getTelegramAnalytics(token, periodDays = 30) {
  const res = await api.get(`/api/admin/telegram/analytics/overview?periodDays=${periodDays}`, cfg(token));
  return res.data;
}

export async function getTelegramUserAnalytics(token) {
  const res = await api.get("/api/admin/telegram/user-analytics/overview", cfg(token));
  return res.data;
}

export async function getRecommendationInsights(token) {
  const res = await api.get("/api/admin/telegram/recommendations/insights", cfg(token));
  return res.data;
}

export async function getCrawlerDashboard(token) {
  const res = await api.get("/api/admin/telegram/operations/crawler-dashboard", cfg(token));
  return res.data;
}

export async function listTelegramChannels(token) {
  const res = await api.get("/api/telegram/channels", cfg(token));
  return res.data;
}

export async function searchTelegramChannels(token, query) {
  const res = await api.get(
    `/api/admin/telegram-crawler/search?q=${encodeURIComponent(query)}`,
    cfg(token)
  );
  return res.data;
}

export async function createTelegramChannel(token, body) {
  const res = await api.post("/api/telegram/channels", body, cfg(token));
  return res.data;
}

export async function updateTelegramChannelStatus(token, id, status) {
  const res = await api.patch(`/api/telegram/channels/${id}/status`, { status }, cfg(token));
  return res.data;
}

export async function deleteTelegramChannel(token, id) {
  await api.delete(`/api/telegram/channels/${id}`, cfg(token));
}

export async function updateTelegramPostContent(token, postId, content) {
  await api.put(`/api/telegram/posts/${postId}/content`, { content }, cfg(token));
}

export async function deleteTelegramPost(token, postId) {
  await api.delete(`/api/telegram/posts/${postId}`, cfg(token));
}

export function downloadReport(token, path) {
  return api.get(path, { ...cfg(token), responseType: "blob" });
}
