import { apiFetch } from "../utils/apiFetch";
import { api, authConfig } from "./api";
import { getToken } from "../utils/auth";
import { API_CONFIG } from "./config";

/**
 * Fetch all active trending topics from the backend.
 */
export async function fetchTopics() {
  try {
    const res = await apiFetch(`${API_CONFIG.baseURL}/api/topics?activeOnly=true`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Failed to fetch topics:", err.message);
  }
  return [];
}

/**
 * Fetch a single topic by ID.
 */
export async function fetchTopicById(topicId) {
  try {
    const res = await apiFetch(`${API_CONFIG.baseURL}/api/topics/${topicId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Failed to fetch topic:", err.message);
  }
  return null;
}

/**
 * Fetch all posts for a given topic.
 */
export async function fetchTopicPosts(topicId) {
  try {
    const res = await apiFetch(`${API_CONFIG.baseURL}/api/topics/${topicId}/posts`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Failed to fetch topic posts:", err.message);
  }
  return [];
}

/**
 * Create a new post in a topic (editor/authenticated users only).
 */
export async function createTopicPost(topicId, { title, text, label, lang, tags, mediaUrl, mediaType }) {
  const token = await getToken();
  if (!token) throw new Error("Authentication required to post in topics");

  const cfg = authConfig(token);
  const res = await api.post(`/api/topics/${topicId}/posts`, {
    title: title || null,
    text,
    label: label || "Update",
    lang: lang || "en",
    tags: tags || [],
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
  }, cfg);

  return res.data;
}

/**
 * Editor requests to post on a topic.
 */
export async function requestToPost(topicId) {
  const token = await getToken();
  if (!token) throw new Error("Authentication required");

  const cfg = authConfig(token);
  const res = await api.post(`/api/topics/${topicId}/request`, {}, cfg);
  return res.data;
}

/**
 * Check if the current editor can request to post in a topic.
 */
export async function canRequestToPost(topicId) {
  const token = await getToken();
  if (!token) return { eligible: false, reason: "Not authenticated" };

  try {
    const cfg = authConfig(token);
    const res = await api.get(`/api/topics/${topicId}/can-request`, cfg);
    return res.data;
  } catch (err) {
    console.warn("Failed to check eligibility:", err.message);
    return { eligible: false, reason: "Check failed" };
  }
}

/**
 * Fetch the current editor's assignments for all topics.
 */
export async function getMyAssignments() {
  const token = await getToken();
  if (!token) return [];

  try {
    const cfg = authConfig(token);
    const res = await api.get("/api/topics/my-assignments", cfg);
    return res.data;
  } catch (err) {
    console.warn("Failed to fetch assignments:", err.message);
    return [];
  }
}

/**
 * Fetch topics for the current editor (ACTIVE + DRAFT topics matching their fields).
 */
export async function getMyTopics() {
  const token = await getToken();
  if (!token) return [];

  try {
    const cfg = authConfig(token);
    const res = await api.get("/api/topics/my-topics", cfg);
    return res.data;
  } catch (err) {
    console.warn("Failed to fetch my topics:", err.message);
    return [];
  }
}

/**
 * Fetch hierarchical fields grouped by general category.
 */
export async function fetchFieldsHierarchical() {
  try {
    const res = await apiFetch(`${API_CONFIG.baseURL}/api/fields?hierarchical=true`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Failed to fetch fields:", err.message);
  }
  return [];
}
