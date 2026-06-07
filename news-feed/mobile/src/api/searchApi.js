import { apiFetch } from "../utils/apiFetch";
import { API_CONFIG } from "./config";

export async function getPostById(postId) {
  try {
    const res = await apiFetch(`${API_CONFIG.baseURL}/api/posts/${postId}`);
    if (!res.ok) throw new Error("Failed to fetch post");
    return await res.json();
  } catch (err) {
    console.error("getPostById error:", err);
    return null;
  }
}

export async function searchPosts({ query, category, sortBy, limit, page, lang, dateFrom, dateTo }) {
  try {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (category) params.set("category", category);
    if (sortBy) params.set("sortBy", sortBy);
    if (limit) params.set("limit", limit);
    if (page !== undefined) params.set("page", page);
    if (lang) params.set("lang", lang);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await apiFetch(`${API_CONFIG.baseURL}/api/posts/search?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to search posts");
    return await res.json();
  } catch (err) {
    console.error("searchPosts error:", err);
    return [];
  }
}