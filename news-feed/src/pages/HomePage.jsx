import { useState } from "react";
import TopBar from "../components/TopBar";
import CategoryBar from "../components/CategoryBar";
import LeftSidebar from "../components/LeftSidebar";
import ChatWidget from "../components/ChatWidget";
import Feed from "../components/Feed";
import TrendingTopics from "../components/TrendingTopics";

export default function HomePage() {
  const [category, setCategory] = useState("General");
  const [activePage, setActivePage] = useState("HOME")
  const [selectedPost, setSelectedPost] = useState(null);;

  return (
    <div className="bg-gray-100 h-screen flex flex-col transition-colors duration-300">

      {activePage === "HOME" && (
        <CategoryBar category={category} setCategory={setCategory} />
      )}

      <div className="grid grid-cols-12 gap-4 w-full max-w-7xl mx-auto flex-1 overflow-hidden mt-2">
        <div className="col-span-3 hidden md:block">
          <LeftSidebar activePage={activePage} setActivePage={setActivePage} />
        </div>

        <div className="col-span-12 md:col-span-6 h-full overflow-y-auto">
          {activePage === "HOME" && <Feed category={category} onAskAI={setSelectedPost} />}
          {activePage === "TRENDING" && <TrendingTopics />}

          {activePage === "SAVED" && (
            <div className="p-4">
              <div className="bg-white rounded-xl shadow p-4">
                <h1 className="text-xl font-bold">💾 Saved News</h1>
                <p className="text-gray-500 mt-2">
                  This page will show saved posts later.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-3 hidden md:block">
          <ChatWidget category={category} selectedPost={selectedPost} />
        </div>
      </div>
    </div>
  );
}
