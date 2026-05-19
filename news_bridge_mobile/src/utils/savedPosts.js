// src/utils/savedPosts.js (mobile)
// API + localStorage-backed saved posts management with collections and notes
// Exact port of news-feed/src/utils/savedPosts.js

import { apiClient } from "../api/apiClient";
import { ensureUserInitialized, getUserId } from "../api/auth";
import storage from "./storage";

const SAVED_POSTS_CACHE_KEY = "newsbridge_saved_posts";
const COLLECTIONS_CACHE_KEY = "newsbridge_collections";

// ─── Saved Posts ────────────────────────────────────────────

export async function savePost(post) {
  await ensureUserInitialized();
  const userId = getUserId();

  // Save to backend - wrap in try/catch to handle network errors gracefully
  try {
    await apiClient.post(`/api/posts/${post.id}/save?userId=${userId}`);
  } catch (err) {
    console.warn("Backend save failed, saving locally:", err.message);
  }

  // Save to local cache
  const saved = getLocalSavedPosts();
  const exists = saved.some((p) => p.id === post.id);
  if (!exists) {
    saved.unshift({
      ...post,
      savedAt: Date.now(),
      collections: [],
      note: "",
    });
    storage.setJSON(SAVED_POSTS_CACHE_KEY, saved);
  }
}

export async function unsavePost(postId) {
  await ensureUserInitialized();
  const userId = getUserId();

  try {
    await apiClient.post(`/api/posts/${postId}/unsave?userId=${userId}`);
  } catch (err) {
    console.warn("Backend unsave failed, removing locally:", err.message);
  }

  const saved = getLocalSavedPosts().filter((p) => p.id !== postId);
  storage.setJSON(SAVED_POSTS_CACHE_KEY, saved);
}

export function isPostSaved(postId) {
  return getLocalSavedPosts().some((p) => p.id === postId);
}

export function getLocalSavedPosts() {
  const data = storage.getJSON(SAVED_POSTS_CACHE_KEY);
  return Array.isArray(data) ? data : [];
}

export async function fetchSavedPostsFromBackend() {
  await ensureUserInitialized();
  const userId = getUserId();
  try {
    const res = await apiClient.get(`/api/user/${userId}/saved-posts`);
    const data = res.data;
    if (Array.isArray(data) && data.length > 0) {
      const enriched = data.map((p) => ({
        ...p,
        savedAt: p.savedAt || Date.now(),
        collections: p.collections || [],
        note: p.note || "",
      }));
      storage.setJSON(SAVED_POSTS_CACHE_KEY, enriched);
      return enriched;
    }
  } catch (err) {
    console.warn("Failed to fetch saved posts from backend:", err.message);
  }
  return getLocalSavedPosts();
}

// ─── Collections (Folders) ─────────────────────────────────

export function getCollections() {
  const data = storage.getJSON(COLLECTIONS_CACHE_KEY);
  return Array.isArray(data) ? data : [];
}

export function createCollection(name, icon = "📁") {
  const collections = getCollections();
  const newCol = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    icon,
    createdAt: Date.now(),
    postCount: 0,
  };
  collections.push(newCol);
  storage.setJSON(COLLECTIONS_CACHE_KEY, collections);
  return newCol;
}

export function deleteCollection(collectionId) {
  const collections = getCollections().filter((c) => c.id !== collectionId);
  storage.setJSON(COLLECTIONS_CACHE_KEY, collections);

  // Remove this collection from all saved posts
  const saved = getLocalSavedPosts().map((p) => ({
    ...p,
    collections: (p.collections || []).filter((cId) => cId !== collectionId),
  }));
  storage.setJSON(SAVED_POSTS_CACHE_KEY, saved);
}

export function renameCollection(collectionId, newName) {
  const collections = getCollections().map((c) =>
    c.id === collectionId ? { ...c, name: newName } : c
  );
  storage.setJSON(COLLECTIONS_CACHE_KEY, collections);
}

export function addPostToCollection(postId, collectionId) {
  const saved = getLocalSavedPosts().map((p) => {
    if (p.id !== postId) return p;
    const cols = p.collections || [];
    if (cols.includes(collectionId)) return p;
    return { ...p, collections: [...cols, collectionId] };
  });
  storage.setJSON(SAVED_POSTS_CACHE_KEY, saved);

  // Update collection count
  updateCollectionCounts();
}

export function removePostFromCollection(postId, collectionId) {
  const saved = getLocalSavedPosts().map((p) => {
    if (p.id !== postId) return p;
    return {
      ...p,
      collections: (p.collections || []).filter((c) => c !== collectionId),
    };
  });
  storage.setJSON(SAVED_POSTS_CACHE_KEY, saved);
  updateCollectionCounts();
}

function updateCollectionCounts() {
  const saved = getLocalSavedPosts();
  const collections = getCollections().map((c) => ({
    ...c,
    postCount: saved.filter((p) => (p.collections || []).includes(c.id)).length,
  }));
  storage.setJSON(COLLECTIONS_CACHE_KEY, collections);
}

// ─── Notes ──────────────────────────────────────────────────

export function getNote(postId) {
  const saved = getLocalSavedPosts();
  const post = saved.find((p) => p.id === postId);
  return post?.note || "";
}

export function setNote(postId, note) {
  const saved = getLocalSavedPosts().map((p) =>
    p.id === postId ? { ...p, note } : p
  );
  storage.setJSON(SAVED_POSTS_CACHE_KEY, saved);
}

// ─── Sync collections count ────────────────────────────────
export function syncCollectionCounts() {
  updateCollectionCounts();
}

// ─── Tags from saved posts ─────────────────────────────────
export function getUniqueTagsFromSaved() {
  const saved = getLocalSavedPosts();
  const tagSet = new Set();
  saved.forEach((p) => {
    if (p.tags && Array.isArray(p.tags)) {
      p.tags.forEach((t) => tagSet.add(t.toLowerCase()));
    }
    if (p.label) tagSet.add(p.label.toLowerCase());
  });
  return Array.from(tagSet).sort();
}
