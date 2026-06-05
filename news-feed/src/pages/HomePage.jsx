import { useState, useEffect, useCallback } from "react";
import CategoryBar from "../components/CategoryBar";
import LeftSidebar from "../components/LeftSidebar";
import ChatWidget from "../components/ChatWidget";
import Feed from "../components/Feed";
import TrendingTopics from "../components/TrendingTopics";
import ApplyEditorPage from "../pages/ApplyEditorPage";
import SavedNews from "../components/SavedNews";
import AvatarPage from "../components/AvatarPage";
import NewsBrief from "../components/NewsBrief";
import PostModal from "../components/PostModal";
import { getPostById } from "../api/searchApi";
import { useTheme } from "../context/ThemeContext";

export default function HomePage() {
  const { currentCategory, setCurrentCategory } = useTheme();
  const [activePage, setActivePage] = useState("HOME")
  const [selectedPost, setSelectedPost] = useState(null);
  const [feedKey, setFeedKey] = useState(0);
  const [searchPostModal, setSearchPostModal] = useState(null);
  // AI Presenter popup — wired to LeftSidebar onOpenAvatar (was missing before)
  const [avatarOpen, setAvatarOpen] = useState(false);

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
        <CategoryBar category={currentCategory} setCategory={setCurrentCategory} />
      )}

      <div className="home-grid">
        <div className="home-sidebar">
          <LeftSidebar 
            activePage={activePage} 
            setActivePage={setActivePage} 
            onLocationChange={handleLocationChange}
            onOpenAvatar={() => setAvatarOpen(true)}
            isAvatarOpen={avatarOpen}
          />
        </div>

        <div className="home-feed">
          {activePage === "HOME" && <Feed key={feedKey} category={currentCategory} onAskAI={setSelectedPost} />}
          {activePage === "TRENDING" && <TrendingTopics />}
          {activePage === "SAVED" && <SavedNews />}
          {activePage === "APPLY_EDITOR" && <ApplyEditorPage />}
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

      <AvatarPage open={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </div>
  );
}
