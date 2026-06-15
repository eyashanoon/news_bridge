import { api, authConfig } from "./adminApi";

const articleBase = "/api/admin/crawler";
const telegramBase = "/api/admin/telegram-crawler";

export async function getArticleCrawlerStatus(token) {
  const res = await api.get(`${articleBase}/status`, authConfig(token));
  return res.data;
}

export async function getArticleCrawlerHealth(token) {
  const res = await api.get(`${articleBase}/health`, authConfig(token));
  return res.data;
}

export async function getArticleCrawlerLogs(token, params = {}) {
  const qs = params.since
    ? `?since=${encodeURIComponent(params.since)}`
    : `?limit=${params.limit ?? 200}`;
  const res = await api.get(`${articleBase}/logs${qs}`, authConfig(token));
  return res.data;
}

export async function getTelegramCrawlerStatus(token) {
  const res = await api.get(`${telegramBase}/status`, authConfig(token));
  return res.data;
}

export async function getTelegramCrawlerHealth(token) {
  const res = await api.get(`${telegramBase}/health`, authConfig(token));
  return res.data;
}

export async function getTelegramCrawlerLogs(token, params = {}) {
  const qs = params.since
    ? `?since=${encodeURIComponent(params.since)}`
    : `?limit=${params.limit ?? 200}`;
  const res = await api.get(`${telegramBase}/logs${qs}`, authConfig(token));
  return res.data;
}
