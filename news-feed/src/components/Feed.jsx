// Feed.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import Post from "./Post";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";

export default function Feed({ category, onAskAI }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);  
  const [hasMore, setHasMore] = useState(true);

  const loader = useRef(null);

  const fetchPosts = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);

      await ensureUserInitialized();
      const userId = getUserId();
      const savedLocation = localStorage.getItem('user_location');
      
      let url = `/api/feed?userId=${userId}&category=${category}&limit=10&page=${page}`;
      
      if (savedLocation) {
        const loc = JSON.parse(savedLocation);
        url += `&lat=${loc.lat}&lon=${loc.lon}`;
      }

      const res = await apiFetch(url);

      if (!res.ok) throw new Error("Failed to fetch feed");

      const data = await res.json();

      if (data.length === 0) {
        setHasMore(false);
        return;
      }

      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const filtered = data.filter((p) => !existingIds.has(p.id));
        return [...prev, ...filtered];
      });

      setPage((prev) => prev + 1);
    } catch (err) {
      console.error("Feed fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [category, page, loading, hasMore]);

  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
  }, [category]);

  useEffect(() => {
    fetchPosts();
  }, [category]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchPosts();
        }
      },
      { threshold: 0.2 }
    );

    if (loader.current) observer.observe(loader.current);

    return () => observer.disconnect();
  }, [fetchPosts]);

  return (
    <div className="space-y-4 p-2">
      {posts.map((post) => (
        <Post key={post.id} post={post} onAskAI={onAskAI}/>
      ))}

      <div ref={loader} className="text-center p-4">
        {loading
          ? "Loading..."
          : hasMore
          ? "Scroll to load more"
          : "No more posts"}
      </div>
    </div>
  );
}