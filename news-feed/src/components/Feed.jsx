// Feed.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import Post from "./Post";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { useTranslation } from "react-i18next";

export default function Feed({ category, onAskAI }) {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loader = useRef(null);
  const fetchGenRef = useRef(0);

  const fetchPosts = useCallback(async (pageToFetch, reset = false) => {
    const gen = fetchGenRef.current;

    try {
      setLoading(true);

      await ensureUserInitialized();
      const userId = getUserId();
      const savedLocation = localStorage.getItem("user_location");

      let url = `/api/feed?userId=${userId}&category=${encodeURIComponent(category)}&limit=10&page=${pageToFetch}&lang=${encodeURIComponent(i18n.resolvedLanguage || i18n.language || "en")}`;

      if (savedLocation) {
        const loc = JSON.parse(savedLocation);
        if (loc?.lat != null && loc?.lon != null) {
          url += `&lat=${loc.lat}&lon=${loc.lon}`;
        }
      }

      const res = await apiFetch(url);
      if (gen !== fetchGenRef.current) return;

      if (!res.ok) throw new Error("Failed to fetch feed");

      const data = await res.json();
      if (gen !== fetchGenRef.current) return;

      if (data.length === 0) {
        setHasMore(false);
        return;
      }

      setPosts((prev) => {
        const base = reset ? [] : prev;
        const existingIds = new Set(base.map((p) => p.id));
        const filtered = data.filter((p) => !existingIds.has(p.id));
        return [...base, ...filtered];
      });

      setPage(pageToFetch + 1);
    } catch (err) {
      console.error("Feed fetch error:", err);
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  }, [category, i18n.language]);

  useEffect(() => {
    fetchGenRef.current += 1;
    setPosts([]);
    setPage(0);
    setHasMore(true);
    fetchPosts(0, true);
  }, [category, i18n.language, fetchPosts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          fetchPosts(page, false);
        }
      },
      { threshold: 0.2 }
    );

    if (loader.current) observer.observe(loader.current);

    return () => observer.disconnect();
  }, [fetchPosts, loading, hasMore, page]);

  return (
    <div className="flex flex-col gap-4 stagger">
      {posts.map((post) => (
        <Post key={post.id} post={post} onAskAI={onAskAI}/>
      ))}

      <div ref={loader} className="text-center py-6 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
        {loading
          ? t("loading")
          : hasMore
          ? t("scrollToLoad")
          : t("noMorePosts")}
      </div>
    </div>
  );
}
