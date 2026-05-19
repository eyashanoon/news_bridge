import { useState, useEffect } from "react";
import CategoryBar from "../components/CategoryBar";
import LeftSidebar from "../components/LeftSidebar";
import ChatWidget from "../components/ChatWidget";
import Feed from "../components/Feed";
import TrendingTopics from "../components/TrendingTopics";
import SavedNews from "../components/SavedNews";
import NewsBrief from "../components/NewsBrief";
import { useTheme } from "../context/ThemeContext";

export default function HomePage() {
  const { currentCategory, setCurrentCategory } = useTheme();
  const [activePage, setActivePage] = useState("HOME")
  const [selectedPost, setSelectedPost] = useState(null);
  const [feedKey, setFeedKey] = useState(0);

  const handleLocationChange = () => {
    setFeedKey(prev => prev + 1);
  };

  // Reset to General theme when navigating away from feed
  useEffect(() => {
    if (activePage !== "HOME") {
      setCurrentCategory("General");
    }
  }, [activePage, setCurrentCategory]);

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
          />
        </div>

        <div className="home-feed">
          {activePage === "HOME" && <Feed key={feedKey} category={currentCategory} onAskAI={setSelectedPost} />}
          {activePage === "TRENDING" && <TrendingTopics />}

          {activePage === "SAVED" && <SavedNews />}
        </div>

        <div className="home-right">
          <NewsBrief />
          <ChatWidget category={currentCategory} selectedPost={selectedPost} />
        </div>
      </div>
    </div>
  );
}