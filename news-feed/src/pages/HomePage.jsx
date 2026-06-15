import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import CategoryBar from "../components/CategoryBar";
import LeftSidebar from "../components/LeftSidebar";
import ChatWidget from "../components/ChatWidget";
import Feed from "../components/Feed";
import TrendingTopics from "../components/TrendingTopics";
import TopicDetails from "../components/TopicDetails";
import ApplyEditorPage from "../pages/ApplyEditorPage";
import SavedNews from "../components/SavedNews";
import NewsBrief from "../components/NewsBrief";
import TelegramFeed from "../components/TelegramFeed";
import PostModal from "../components/PostModal";
import { getPostById } from "../api/searchApi";
import { useTheme } from "../context/ThemeContext";

export default function HomePage() {
  const { currentCategory, setCurrentCategory } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { topicId, categoryName } = useParams();

  const [selectedPost, setSelectedPost] = useState(null);
  const [feedKey, setFeedKey] = useState(0);
  const [searchPostModal, setSearchPostModal] = useState(null);

  // Map lowercase URL category slugs to proper category names
  const categorySlugToName = useMemo(() => ({
    general: "General",
    politics: "Politics",
    sports: "Sports",
    finance: "Finance",
    medical: "Medical",
    tech: "Tech",
    culture: "Culture",
    religion: "Religion",
  }), []);

  // Resolve category from URL immediately so Feed never flashes the wrong category on reload
  const feedCategory = useMemo(() => {
    if (categoryName) {
      const resolved = categorySlugToName[categoryName.toLowerCase()];
      if (resolved) return resolved;
    }
    return "General";
  }, [categoryName, categorySlugToName]);

  // Derive activePage from the URL path
  const activePage = useMemo(() => {
    const path = location.pathname;
    if (path === "/news") return "HOME";
    if (path === "/news/trending") return "TRENDING";
    if (path === "/news/saved") return "SAVED";
    if (path === "/news/apply-editor") return "APPLY_EDITOR";
    if (path === "/news/telegram") return "TELEGRAM";
    if (path.startsWith("/news/topics/")) return "TOPIC";
    if (path.startsWith("/news/category/")) return "HOME";
    return "HOME";
  }, [location.pathname]);

  // When on a category route, set the category from the URL
  // When at /news (no category param), reset to General
  useEffect(() => {
    if (activePage === "HOME") {
      if (categoryName) {
        const resolved = categorySlugToName[categoryName.toLowerCase()];
        if (resolved && resolved !== currentCategory) {
          setCurrentCategory(resolved);
        }
      } else if (currentCategory !== "General") {
        setCurrentCategory("General");
      }
    }
  }, [location.pathname, categoryName, categorySlugToName, currentCategory, setCurrentCategory]);

  const setActivePage = useCallback((page) => {
    const routes = {
      HOME: "/news",
      TRENDING: "/news/trending",
      SAVED: "/news/saved",
      APPLY_EDITOR: "/news/apply-editor",
      TELEGRAM: "/news/telegram",
    };
    navigate(routes[page] || "/news");
  }, [navigate]);

  const handleLocationChange = () => {
    setFeedKey(prev => prev + 1);
  };

  // Reset to General theme when navigating away from feed
  useEffect(() => {
    if (activePage !== "HOME") {
      setCurrentCategory("General");
    }
  }, [activePage, setCurrentCategory]);

  // Listen for custom event from SearchBar to open post details
  useEffect(() => {
    const handleOpenPost = async (e) => {
      const { postId } = e.detail;
      if (!postId) return;
      try {
        const post = await getPostById(postId);
        if (post) {
          setSearchPostModal(post);
        }
      } catch (err) {
        console.error("Failed to fetch post from search:", err);
      }
    };

    window.addEventListener("open-post-modal", handleOpenPost);
    return () => window.removeEventListener("open-post-modal", handleOpenPost);
  }, []);

  return (
    <div className="home-layout" style={{
      background: "var(--cat-bg, #f0f4f9)",
      backgroundImage: "none",
    }}>
      {activePage === "HOME" && (
        <CategoryBar
          category={feedCategory}
          setCategory={(cat) => {
            // Navigate to the category URL if different from current
            navigate(`/news/category/${cat.toLowerCase()}`);
          }}
        />
      )}

      <div className="home-grid">
        <div className="home-sidebar">
          <LeftSidebar 
            activePage={activePage} 
            setActivePage={setActivePage} 
            onLocationChange={handleLocationChange}
          />
        </div>

        <div className="home-feed">
          <div className="home-feed-inner">
            {activePage === "HOME" && <Feed key={`${feedKey}-${feedCategory}`} category={feedCategory} onAskAI={setSelectedPost} />}
            {activePage === "TRENDING" && <TrendingTopics />}
            {activePage === "TOPIC" && topicId && <TopicDetails topicId={Number(topicId)} goBack={() => navigate("/news/trending")} />}
            {activePage === "SAVED" && <SavedNews />}
            {activePage === "TELEGRAM" && <TelegramFeed category="Telegram" />}
            {activePage === "APPLY_EDITOR" && <ApplyEditorPage />}
          </div>
        </div>

        <div className="home-right">
          <NewsBrief />
          <ChatWidget category={currentCategory} selectedPost={selectedPost} />
        </div>
      </div>

      {/* Post modal opened from search results */}
      {searchPostModal && (
        <PostModal
          post={searchPostModal}
          onClose={() => setSearchPostModal(null)}
        />
      )}

    </div>
  );
}