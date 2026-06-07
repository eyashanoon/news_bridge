// src/utils/savedPosts.js
// API + localStorage-backed saved posts management with collections and notes

import { apiFetch } from "./apiFetch";
import { ensureUserInitialized } from "./auth";
import { getUserId } from "./userId";

const SAVED_POSTS_BASE_KEY = "newsbridge_saved_posts";
const COLLECTIONS_BASE_KEY = "newsbridge_collections";
const NOTES_BASE_KEY = "newsbridge_notes";

function getSavedPostsKey() { return `${SAVED_POSTS_BASE_KEY}_${getUserId()}`; }
function getCollectionsKey() { return `${COLLECTIONS_BASE_KEY}_${getUserId()}`; }
function getNotesKey() { return `${NOTES_BASE_KEY}_${getUserId()}`; }

// ─── Saved Posts ────────────────────────────────────────────

export async function savePost(post) {
  await ensureUserInitialized();
  const userId = getUserId();

  // Save to backend
  try {
    await apiFetch(`/api/posts/${post.id}/save?userId=${userId}`, {
      method: "POST",
    });
  } catch (err) {
    console.warn("Backend save failed, saving locally:", err);
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
    localStorage.setItem(getSavedPostsKey(), JSON.stringify(saved));
  }
}

export async function unsavePost(postId) {
  await ensureUserInitialized();
  const userId = getUserId();

  try {
    await apiFetch(`/api/posts/${postId}/unsave?userId=${userId}`, {
      method: "POST",
    });
  } catch (err) {
    console.warn("Backend unsave failed, removing locally:", err);
  }

  const saved = getLocalSavedPosts().filter((p) => p.id !== postId);
  localStorage.setItem(getSavedPostsKey(), JSON.stringify(saved));
}

export function isPostSaved(postId) {
  return getLocalSavedPosts().some((p) => p.id === postId);
}

export function getLocalSavedPosts() {
  try {
    const userId = getUserId();
    if (!userId) return [];
    return JSON.parse(localStorage.getItem(getSavedPostsKey())) || [];
  } catch {
    return [];
  }
}

export async function fetchSavedPostsFromBackend() {
  await ensureUserInitialized();
  const userId = getUserId();
  try {
    const res = await apiFetch(`/api/user/${userId}/saved-posts`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const enriched = data.map((p) => ({
          ...p,
          savedAt: p.savedAt || Date.now(),
          collections: p.collections || [],
          note: p.note || "",
        }));
        localStorage.setItem(getSavedPostsKey(), JSON.stringify(enriched));
        return enriched;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch saved posts from backend:", err);
  }
  return getLocalSavedPosts();
}

// ─── Collections (Folders) ─────────────────────────────────

export function getCollections() {
  try {
    const userId = getUserId();
    if (!userId) return [];
    return JSON.parse(localStorage.getItem(getCollectionsKey())) || [];
  } catch {
    return [];
  }
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
  localStorage.setItem(getCollectionsKey(), JSON.stringify(collections));
  return newCol;
}

export function deleteCollection(collectionId) {
  const collections = getCollections().filter((c) => c.id !== collectionId);
  localStorage.setItem(getCollectionsKey(), JSON.stringify(collections));

  // Remove this collection from all saved posts
  const saved = getLocalSavedPosts().map((p) => ({
    ...p,
    collections: (p.collections || []).filter((cId) => cId !== collectionId),
  }));
  localStorage.setItem(getSavedPostsKey(), JSON.stringify(saved));
}

export function renameCollection(collectionId, newName) {
  const collections = getCollections().map((c) =>
    c.id === collectionId ? { ...c, name: newName } : c
  );
  localStorage.setItem(getCollectionsKey(), JSON.stringify(collections));
}

export function addPostToCollection(postId, collectionId) {
  const saved = getLocalSavedPosts().map((p) => {
    if (p.id !== postId) return p;
    const cols = p.collections || [];
    if (cols.includes(collectionId)) return p;
    return { ...p, collections: [...cols, collectionId] };
  });
  localStorage.setItem(getSavedPostsKey(), JSON.stringify(saved));

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
  localStorage.setItem(getSavedPostsKey(), JSON.stringify(saved));
  updateCollectionCounts();
}

function updateCollectionCounts() {
  const saved = getLocalSavedPosts();
  const collections = getCollections().map((c) => ({
    ...c,
    postCount: saved.filter((p) => (p.collections || []).includes(c.id)).length,
  }));
  localStorage.setItem(getCollectionsKey(), JSON.stringify(collections));
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
  localStorage.setItem(getSavedPostsKey(), JSON.stringify(saved));
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