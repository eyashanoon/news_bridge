// src/utils/savedPosts.js
// API-backed saved posts with local cache for offline/fast reads

import { apiFetch } from "./apiFetch";
import { ensureUserInitialized } from "./auth";
import { getUserId } from "./userId";

const SAVED_POSTS_BASE_KEY = "newsbridge_saved_posts";
const COLLECTIONS_BASE_KEY = "newsbridge_collections";

function getSavedPostsKey() { return `${SAVED_POSTS_BASE_KEY}_${getUserId()}`; }
function getCollectionsKey() { return `${COLLECTIONS_BASE_KEY}_${getUserId()}`; }

function enrichPost(p) {
  return {
    ...p,
    savedAt: p.savedAt || Date.now(),
    collections: p.collections || [],
    note: p.note || "",
  };
}

async function persistSavedPosts(posts) {
  localStorage.setItem(getSavedPostsKey(), JSON.stringify(posts));
}

async function persistCollections(collections) {
  localStorage.setItem(getCollectionsKey(), JSON.stringify(collections));
}

async function syncSavedPostMetadata(postId, { note, collections } = {}) {
  const userId = getUserId();
  const body = {};
  if (note !== undefined) body.note = note;
  if (collections !== undefined) body.collections = collections;
  if (Object.keys(body).length === 0) return;

  try {
    await apiFetch(`/api/user/${userId}/saved-posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn("Failed to sync saved post metadata:", err);
  }
}

// ─── Saved Posts ────────────────────────────────────────────

export async function savePost(post) {
  await ensureUserInitialized();
  const userId = getUserId();

  try {
    await apiFetch(`/api/posts/${post.id}/save?userId=${userId}`, {
      method: "POST",
    });
  } catch (err) {
    console.warn("Backend save failed, saving locally:", err);
  }

  const saved = getLocalSavedPosts();
  const exists = saved.some((p) => p.id === post.id);
  if (!exists) {
    saved.unshift(enrichPost({ ...post, savedAt: Date.now() }));
    await persistSavedPosts(saved);
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
  await persistSavedPosts(saved);
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

export async function fetchCollectionsFromBackend() {
  await ensureUserInitialized();
  const userId = getUserId();
  try {
    const res = await apiFetch(`/api/user/${userId}/saved-collections`);
    if (res.ok) {
      const data = await res.json();
      const collections = Array.isArray(data) ? data : [];
      await persistCollections(collections);
      return collections;
    }
  } catch (err) {
    console.warn("Failed to fetch collections from backend:", err);
  }
  return getCollections();
}

export async function fetchSavedPostsFromBackend() {
  await ensureUserInitialized();
  const userId = getUserId();
  try {
    const [postsRes] = await Promise.all([
      apiFetch(`/api/user/${userId}/saved-posts`),
      fetchCollectionsFromBackend(),
    ]);
    if (postsRes.ok) {
      const data = await postsRes.json();
      const enriched = (Array.isArray(data) ? data : []).map(enrichPost);
      await persistSavedPosts(enriched);
      return enriched;
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

export async function createCollection(name, icon = "📁") {
  const userId = getUserId();
  const newCol = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    icon,
    createdAt: Date.now(),
    postCount: 0,
  };

  try {
    await apiFetch(`/api/user/${userId}/saved-collections`, {
      method: "POST",
      body: JSON.stringify(newCol),
    });
  } catch (err) {
    console.warn("Failed to create collection on backend:", err);
  }

  const collections = getCollections();
  collections.push(newCol);
  await persistCollections(collections);
  return newCol;
}

export async function deleteCollection(collectionId) {
  const userId = getUserId();
  try {
    await apiFetch(`/api/user/${userId}/saved-collections/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("Failed to delete collection on backend:", err);
  }

  const collections = getCollections().filter((c) => c.id !== collectionId);
  await persistCollections(collections);

  const saved = getLocalSavedPosts().map((p) => ({
    ...p,
    collections: (p.collections || []).filter((cId) => cId !== collectionId),
  }));
  await persistSavedPosts(saved);
}

export async function renameCollection(collectionId, newName) {
  const userId = getUserId();
  try {
    await apiFetch(`/api/user/${userId}/saved-collections/${encodeURIComponent(collectionId)}`, {
      method: "PUT",
      body: JSON.stringify({ name: newName }),
    });
  } catch (err) {
    console.warn("Failed to rename collection on backend:", err);
  }

  const collections = getCollections().map((c) =>
    c.id === collectionId ? { ...c, name: newName } : c
  );
  await persistCollections(collections);
}

export async function addPostToCollection(postId, collectionId) {
  const saved = getLocalSavedPosts().map((p) => {
    if (p.id !== postId) return p;
    const cols = p.collections || [];
    if (cols.includes(collectionId)) return p;
    return { ...p, collections: [...cols, collectionId] };
  });
  await persistSavedPosts(saved);

  const post = saved.find((p) => p.id === postId);
  if (post) {
    await syncSavedPostMetadata(postId, { collections: post.collections || [] });
  }
  await updateCollectionCounts();
}

export async function removePostFromCollection(postId, collectionId) {
  const saved = getLocalSavedPosts().map((p) => {
    if (p.id !== postId) return p;
    return {
      ...p,
      collections: (p.collections || []).filter((c) => c !== collectionId),
    };
  });
  await persistSavedPosts(saved);

  const post = saved.find((p) => p.id === postId);
  if (post) {
    await syncSavedPostMetadata(postId, { collections: post.collections || [] });
  }
  await updateCollectionCounts();
}

async function updateCollectionCounts() {
  const saved = getLocalSavedPosts();
  const collections = getCollections().map((c) => ({
    ...c,
    postCount: saved.filter((p) => (p.collections || []).includes(c.id)).length,
  }));
  await persistCollections(collections);
}

// ─── Notes ──────────────────────────────────────────────────

export function getNote(postId) {
  const saved = getLocalSavedPosts();
  const post = saved.find((p) => p.id === postId);
  return post?.note || "";
}

export async function setNote(postId, note) {
  const saved = getLocalSavedPosts().map((p) =>
    p.id === postId ? { ...p, note } : p
  );
  await persistSavedPosts(saved);
  await syncSavedPostMetadata(postId, { note });
}

// ─── Sync collections count ────────────────────────────────
export async function syncCollectionCounts() {
  await updateCollectionCounts();
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
