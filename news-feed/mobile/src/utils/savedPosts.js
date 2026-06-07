import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./apiFetch";
import { ensureUserInitialized, getToken } from "./auth";
import { getUserId } from "./userId";
import { API_CONFIG } from "../api/config";

const SAVED_POSTS_BASE_KEY = "newsbridge_saved_posts";
const COLLECTIONS_BASE_KEY = "newsbridge_collections";

async function getSavedPostsKey() { return `${SAVED_POSTS_BASE_KEY}_${await getUserId()}`; }
async function getCollectionsKey() { return `${COLLECTIONS_BASE_KEY}_${await getUserId()}`; }

// ─── Saved Posts ────────────────────────────────────────────

export async function savePost(post) {
  await ensureUserInitialized();
  const userId = await getUserId();

  try {
    await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/save?userId=${userId}`, { method: "POST" });
  } catch (err) {
    console.warn("Backend save failed, saving locally:", err);
  }

  const saved = await getLocalSavedPosts();
  const exists = saved.some((p) => p.id === post.id);
  if (!exists) {
    saved.unshift({ ...post, savedAt: Date.now(), collections: [], note: "" });
    await AsyncStorage.setItem(await getSavedPostsKey(), JSON.stringify(saved));
  }
}

export async function unsavePost(postId) {
  await ensureUserInitialized();
  const userId = await getUserId();

  try {
    await apiFetch(`${API_CONFIG.baseURL}/api/posts/${postId}/unsave?userId=${userId}`, { method: "POST" });
  } catch (err) {
    console.warn("Backend unsave failed, removing locally:", err);
  }

  const saved = (await getLocalSavedPosts()).filter((p) => p.id !== postId);
  await AsyncStorage.setItem(await getSavedPostsKey(), JSON.stringify(saved));
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

export async function fetchSavedPostsFromBackend() {
  await ensureUserInitialized();
  const userId = await getUserId();
  try {
    const res = await apiFetch(`${API_CONFIG.baseURL}/api/user/${userId}/saved-posts`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const enriched = data.map((p) => ({
          ...p,
          savedAt: p.savedAt || Date.now(),
          collections: p.collections || [],
          note: p.note || "",
        }));
        await AsyncStorage.setItem(await getSavedPostsKey(), JSON.stringify(enriched));
        return enriched;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch saved posts from backend:", err);
  }
  return await getLocalSavedPosts();
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
  const collections = await getCollections();
  const newCol = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    icon,
    createdAt: Date.now(),
    postCount: 0,
  };
  collections.push(newCol);
  await AsyncStorage.setItem(await getCollectionsKey(), JSON.stringify(collections));
  return newCol;
}

export async function deleteCollection(collectionId) {
  const collections = (await getCollections()).filter((c) => c.id !== collectionId);
  await AsyncStorage.setItem(await getCollectionsKey(), JSON.stringify(collections));

  const saved = (await getLocalSavedPosts()).map((p) => ({
    ...p,
    collections: (p.collections || []).filter((cId) => cId !== collectionId),
  }));
  await AsyncStorage.setItem(await getSavedPostsKey(), JSON.stringify(saved));
}

export async function renameCollection(collectionId, newName) {
  const collections = (await getCollections()).map((c) =>
    c.id === collectionId ? { ...c, name: newName } : c
  );
  await AsyncStorage.setItem(await getCollectionsKey(), JSON.stringify(collections));
}

export async function addPostToCollection(postId, collectionId) {
  const saved = (await getLocalSavedPosts()).map((p) => {
    if (p.id !== postId) return p;
    const cols = p.collections || [];
    if (cols.includes(collectionId)) return p;
    return { ...p, collections: [...cols, collectionId] };
  });
  await AsyncStorage.setItem(await getSavedPostsKey(), JSON.stringify(saved));
  await updateCollectionCounts();
}

export async function removePostFromCollection(postId, collectionId) {
  const saved = (await getLocalSavedPosts()).map((p) => {
    if (p.id !== postId) return p;
    return { ...p, collections: (p.collections || []).filter((c) => c !== collectionId) };
  });
  await AsyncStorage.setItem(await getSavedPostsKey(), JSON.stringify(saved));
  await updateCollectionCounts();
}

async function updateCollectionCounts() {
  const saved = await getLocalSavedPosts();
  const collections = (await getCollections()).map((c) => ({
    ...c,
    postCount: saved.filter((p) => (p.collections || []).includes(c.id)).length,
  }));
  await AsyncStorage.setItem(await getCollectionsKey(), JSON.stringify(collections));
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
  await AsyncStorage.setItem(await getSavedPostsKey(), JSON.stringify(saved));
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