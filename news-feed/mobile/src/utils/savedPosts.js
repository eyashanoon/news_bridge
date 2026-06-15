import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./apiFetch";
import { ensureUserInitialized } from "./auth";
import { getUserId } from "./userId";

const SAVED_POSTS_BASE_KEY = "newsbridge_saved_posts";
const COLLECTIONS_BASE_KEY = "newsbridge_collections";

async function getSavedPostsKey() { return `${SAVED_POSTS_BASE_KEY}_${await getUserId()}`; }
async function getCollectionsKey() { return `${COLLECTIONS_BASE_KEY}_${await getUserId()}`; }

function enrichPost(p) {
  return {
    ...p,
    savedAt: p.savedAt || Date.now(),
    collections: p.collections || [],
    note: p.note || "",
  };
}

async function persistSavedPosts(posts) {
  await AsyncStorage.setItem(await getSavedPostsKey(), JSON.stringify(posts));
}

async function persistCollections(collections) {
  await AsyncStorage.setItem(await getCollectionsKey(), JSON.stringify(collections));
}

async function syncSavedPostMetadata(postId, { note, collections } = {}) {
  const userId = await getUserId();
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
  const userId = await getUserId();

  try {
    await apiFetch(`/api/posts/${post.id}/save?userId=${userId}`, { method: "POST" });
  } catch (err) {
    console.warn("Backend save failed, saving locally:", err);
  }

  const saved = await getLocalSavedPosts();
  const exists = saved.some((p) => p.id === post.id);
  if (!exists) {
    saved.unshift(enrichPost({ ...post, savedAt: Date.now() }));
    await persistSavedPosts(saved);
  }
}

export async function unsavePost(postId) {
  await ensureUserInitialized();
  const userId = await getUserId();

  try {
    await apiFetch(`/api/posts/${postId}/unsave?userId=${userId}`, { method: "POST" });
  } catch (err) {
    console.warn("Backend unsave failed, removing locally:", err);
  }

  const saved = (await getLocalSavedPosts()).filter((p) => p.id !== postId);
  await persistSavedPosts(saved);
}

export async function isPostSaved(postId) {
  const saved = await getLocalSavedPosts();
  return saved.some((p) => p.id === postId);
}

export async function getLocalSavedPosts() {
  try {
    const userId = await getUserId();
    if (!userId) return [];
    const key = await getSavedPostsKey();
    const data = await AsyncStorage.getItem(key);
    return JSON.parse(data) || [];
  } catch {
    return [];
  }
}

export async function fetchCollectionsFromBackend() {
  await ensureUserInitialized();
  const userId = await getUserId();
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
  const userId = await getUserId();
  try {
    const postsRes = await apiFetch(`/api/user/${userId}/saved-posts`);
    await fetchCollectionsFromBackend();
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

export async function getCollections() {
  try {
    const userId = await getUserId();
    if (!userId) return [];
    const key = await getCollectionsKey();
    const data = await AsyncStorage.getItem(key);
    return JSON.parse(data) || [];
  } catch {
    return [];
  }
}

export async function createCollection(name, icon = "📁") {
  const userId = await getUserId();
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

  const collections = await getCollections();
  collections.push(newCol);
  await persistCollections(collections);
  return newCol;
}

export async function deleteCollection(collectionId) {
  const userId = await getUserId();
  try {
    await apiFetch(`/api/user/${userId}/saved-collections/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("Failed to delete collection on backend:", err);
  }

  const collections = (await getCollections()).filter((c) => c.id !== collectionId);
  await persistCollections(collections);

  const saved = (await getLocalSavedPosts()).map((p) => ({
    ...p,
    collections: (p.collections || []).filter((cId) => cId !== collectionId),
  }));
  await persistSavedPosts(saved);
}

export async function renameCollection(collectionId, newName) {
  const userId = await getUserId();
  try {
    await apiFetch(`/api/user/${userId}/saved-collections/${encodeURIComponent(collectionId)}`, {
      method: "PUT",
      body: JSON.stringify({ name: newName }),
    });
  } catch (err) {
    console.warn("Failed to rename collection on backend:", err);
  }

  const collections = (await getCollections()).map((c) =>
    c.id === collectionId ? { ...c, name: newName } : c
  );
  await persistCollections(collections);
}

export async function addPostToCollection(postId, collectionId) {
  const saved = (await getLocalSavedPosts()).map((p) => {
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
  const saved = (await getLocalSavedPosts()).map((p) => {
    if (p.id !== postId) return p;
    return { ...p, collections: (p.collections || []).filter((c) => c !== collectionId) };
  });
  await persistSavedPosts(saved);

  const post = saved.find((p) => p.id === postId);
  if (post) {
    await syncSavedPostMetadata(postId, { collections: post.collections || [] });
  }
  await updateCollectionCounts();
}

async function updateCollectionCounts() {
  const saved = await getLocalSavedPosts();
  const collections = (await getCollections()).map((c) => ({
    ...c,
    postCount: saved.filter((p) => (p.collections || []).includes(c.id)).length,
  }));
  await persistCollections(collections);
}

// ─── Notes ──────────────────────────────────────────────────

export async function getNote(postId) {
  const saved = await getLocalSavedPosts();
  const post = saved.find((p) => p.id === postId);
  return post?.note || "";
}

export async function setNote(postId, note) {
  const saved = (await getLocalSavedPosts()).map((p) =>
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
export async function getUniqueTagsFromSaved() {
  const saved = await getLocalSavedPosts();
  const tagSet = new Set();
  saved.forEach((p) => {
    if (p.tags && Array.isArray(p.tags)) {
      p.tags.forEach((t) => tagSet.add(t.toLowerCase()));
    }
    if (p.label) tagSet.add(p.label.toLowerCase());
  });
  return Array.from(tagSet).sort();
}
