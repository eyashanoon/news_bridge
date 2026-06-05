// src/api/searchApi.js
import { apiFetch } from "../utils/apiFetch";
import { getUserId } from "../utils/userId";
import { ensureUserInitialized } from "../utils/auth";

/**
 * Search posts with advanced filters.
 * Uses the dedicated backend search endpoint that searches ALL posts in the DB
 * regardless of tagsExtracted or seen status.
 */
export async function searchPosts({
  query = "",
  category = "",
  lang = "",
  dateFrom = "",
  dateTo = "",
  sortBy = "relevance",
  page = 0,
  limit = 10,
} = {}) {
  // Build URL with all params
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (category) params.set("category", category);
  if (lang) params.set("lang", lang);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  params.set("sortBy", sortBy);
  params.set("page", String(page));
  params.set("limit", String(limit));

  // Try server-side search first (endpoint that searches ALL posts)
  try {
    const res = await apiFetch(`/api/posts/search?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      let results = Array.isArray(data) ? data : data.content || data.posts || [];
      if (results.length > 0) {
        // Apply client-side date filtering and sorting if the server doesn't support them
        results = applyClientFilters(results, { query, category, lang, dateFrom, dateTo, sortBy });
        return results;
      }
    }
  } catch (err) {
    console.warn("Server search error:", err.message);
  }

  // Fallback: fetch extensive set of posts and search client-side
  return clientSideSearch({ query, category, lang, dateFrom, dateTo, sortBy, page, limit });
}

/**
 * Get a single post by ID from the dedicated search endpoint.
 */
export async function getPostById(postId) {
  if (!postId) return null;
  try {
    const res = await apiFetch(`/api/posts/search/${postId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Failed to fetch post by ID:", err.message);
  }

  // Fallback: try the general posts endpoint
  try {
    const res = await apiFetch(`/api/posts/${postId}`);
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }

  return null;
}

/**
 * Apply client-side date/range/sort filters on server results.
 */
function applyClientFilters(posts, { query, category, lang, dateFrom, dateTo, sortBy }) {
  let results = [...posts];

  // Category filter (if server didn't apply it)
  if (category) {
    results = results.filter(
      (p) => p.label === category || p.category === category
    );
  }

  // Language filter (if server didn't apply it)
  if (lang) {
    results = results.filter((p) => p.lang === lang);
  }

  // Date filters (server may not support these)
  if (dateFrom) {
    const from = new Date(dateFrom).getTime();
    if (!isNaN(from)) {
      results = results.filter((p) => {
        const d = new Date(p.articleCreatedAt || p.createdAt).getTime();
        return !isNaN(d) && d >= from;
      });
    }
  }

  if (dateTo) {
    const to = new Date(dateTo).getTime();
    if (!isNaN(to)) {
      const toEnd = to + 86400000;
      results = results.filter((p) => {
        const d = new Date(p.articleCreatedAt || p.createdAt).getTime();
        return !isNaN(d) && d <= toEnd;
      });
    }
  }

  // Sorting
  if (sortBy === "date") {
    results.sort((a, b) => {
      const da = new Date(a.articleCreatedAt || a.createdAt || 0).getTime();
      const db = new Date(b.articleCreatedAt || b.createdAt || 0).getTime();
      return db - da;
    });
  } else if (sortBy === "popularity") {
    results.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else if (sortBy === "relevance" && query) {
    const q = query.toLowerCase();
    results.sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      const titleA = (a.title || "").toLowerCase();
      const titleB = (b.title || "").toLowerCase();
      if (titleA.includes(q)) scoreA += 10;
      if (titleB.includes(q)) scoreB += 10;
      if (titleA.startsWith(q)) scoreA += 5;
      if (titleB.startsWith(q)) scoreB += 5;
      if ((a.text || "").toLowerCase().includes(q)) scoreA += 3;
      if ((b.text || "").toLowerCase().includes(q)) scoreB += 3;
      return scoreB - scoreA;
    });
  }

  return results;
}

/**
 * Client-side fallback search - fetches multiple pages and categories.
 */
async function clientSideSearch({
  query = "",
  category = "",
  lang = "",
  dateFrom = "",
  dateTo = "",
  sortBy = "relevance",
  page = 0,
  limit = 10,
} = {}) {
  try {
    const allPosts = await fetchAllPostsForSearch();
    if (allPosts.length === 0) return [];

    let results = [...allPosts];

    // Category filter
    if (category) {
      results = results.filter((p) => p.label === category || p.category === category);
    }

    // Text search
    const q = query.toLowerCase().trim();
    if (q) {
      results = results.filter((p) => {
        if (p.title && p.title.toLowerCase().includes(q)) return true;
        if (p.text && p.text.toLowerCase().includes(q)) return true;
        if (p.tags && Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase().includes(q))) return true;
        if (p.label && p.label.toLowerCase().includes(q)) return true;
        if (p.source && p.source.toLowerCase().includes(q)) return true;
        if (p.summary && p.summary.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    // Language filter
    if (lang) {
      results = results.filter((p) => p.lang === lang);
    }

    // Date filters
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      if (!isNaN(from)) {
        results = results.filter((p) => {
          const d = new Date(p.articleCreatedAt || p.createdAt).getTime();
          return !isNaN(d) && d >= from;
        });
      }
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      if (!isNaN(to)) {
        const toEnd = to + 86400000;
        results = results.filter((p) => {
          const d = new Date(p.articleCreatedAt || p.createdAt).getTime();
          return !isNaN(d) && d <= toEnd;
        });
      }
    }

    // Sort
    if (sortBy === "date") {
      results.sort((a, b) => {
        const da = new Date(a.articleCreatedAt || a.createdAt || 0).getTime();
        const db = new Date(b.articleCreatedAt || b.createdAt || 0).getTime();
        return db - da;
      });
    } else if (sortBy === "popularity") {
      results.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (q) {
      results.sort((a, b) => {
        let sa = 0, sb = 0;
        const ta = (a.title || "").toLowerCase();
        const tb = (b.title || "").toLowerCase();
        if (ta.includes(q)) sa += 10;
        if (tb.includes(q)) sb += 10;
        if (ta.startsWith(q)) sa += 5;
        if (tb.startsWith(q)) sb += 5;
        if ((a.text || "").toLowerCase().includes(q)) sa += 3;
        if ((b.text || "").toLowerCase().includes(q)) sb += 3;
        return sb - sa;
      });
    }

    const start = page * limit;
    return results.slice(start, start + limit);
  } catch (err) {
    console.error("Client search error:", err.message);
    return [];
  }
}

// Cache key and TTL
const CACHE_KEY = "search_posts_cache_v2";
const CACHE_TTL = 5 * 60 * 1000;

function getCachedPosts() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { posts, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL || !Array.isArray(posts)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return posts;
  } catch {
    return null;
  }
}

function setCachedPosts(posts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ posts, timestamp: Date.now() }));
  } catch {
    // Ignore storage limits
  }
}

/**
 * Fetch ALL posts from the server by paginating through the feed API.
 */
async function fetchAllPostsForSearch() {
  const cached = getCachedPosts();
  if (cached) return cached;

  await ensureUserInitialized();
  const userId = getUserId();

  const locParams = (() => {
    try {
      const loc = JSON.parse(localStorage.getItem("user_location") || "null");
      if (loc) return `&lat=${loc.lat}&lon=${loc.lon}`;
    } catch {}
    return "";
  })();

  const allPosts = [];
  const seen = new Set();
  const MAX_PAGES = 20;
  const PAGE_SIZE = 50;

  // Fetch multiple pages of general feed
  for (let p = 0; p < MAX_PAGES; p++) {
    try {
      const res = await apiFetch(`/api/feed?userId=${userId}&limit=${PAGE_SIZE}&page=${p}${locParams}`);
      if (!res.ok) break;
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) break;
      for (const post of posts) {
        if (!seen.has(post.id)) {
          seen.add(post.id);
          allPosts.push(post);
        }
      }
      if (posts.length < PAGE_SIZE) break;
    } catch {
      break;
    }
  }

  // Also fetch by each category to get more breadth
  const categories = ["General", "Politics", "Sports", "Finance", "Medical", "Tech", "Culture", "Religion"];
  for (const cat of categories) {
    try {
      const res = await apiFetch(`/api/feed?userId=${userId}&category=${cat}&limit=50&page=0${locParams}`);
      if (!res.ok) continue;
      const posts = await res.json();
      if (!Array.isArray(posts)) continue;
      for (const post of posts) {
        if (!seen.has(post.id)) {
          seen.add(post.id);
          allPosts.push(post);
        }
      }
    } catch {
      // skip
    }
  }

  if (allPosts.length > 0) setCachedPosts(allPosts);
  return allPosts;
}

/**
 * Get search suggestions based on partial query.
 */
export async function getSearchSuggestions(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await apiFetch(`/api/posts/search/suggestions?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}