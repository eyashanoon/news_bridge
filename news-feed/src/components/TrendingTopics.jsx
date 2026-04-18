// TrendingTopics.jsx
import { useEffect, useState } from "react";
import TopicCard from "./TopicCard";
import TopicDetails from "./TopicDetails";

export default function TrendingTopics() {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const openTopicDetails = (id) => {
    setSelectedTopic(id);
  };

  useEffect(() => {
    // Placeholder trending topics (later replace with API call)
    const fakeTopics = [
      {
        id: 1,
        title: "Israel - Gaza Conflict Updates",
        growth: 84,
        summary:
          "New developments and international reactions are shaping the ongoing situation. Talks of ceasefire and aid delivery are trending heavily.",
        posts: 220,
        contributors: 38,
        tags: ["gaza", "israel", "ceasefire", "aid", "un"],
      },
      {
        id: 2,
        title: "Champions League Quarter Finals",
        growth: 61,
        summary:
          "Major European clubs are facing off in the quarter finals, with surprise performances and key player injuries dominating discussions.",
        posts: 140,
        contributors: 22,
        tags: ["football", "uefa", "championsleague", "sports"],
      },
      {
        id: 3,
        title: "Apple AI Features Announcement",
        growth: 73,
        summary:
          "Apple is rumored to release new AI-powered features across iOS and MacOS. Investors and developers are watching closely.",
        posts: 95,
        contributors: 18,
        tags: ["apple", "ai", "ios", "technology", "macos"],
      },
      {
        id: 4,
        title: "Global Inflation & Currency Changes",
        growth: 55,
        summary:
          "Markets are reacting to inflation reports, interest rate expectations, and currency fluctuations affecting global trade.",
        posts: 170,
        contributors: 30,
        tags: ["inflation", "economy", "finance", "markets"],
      },
      {
        id: 5,
        title: "New Virus Variant Spread",
        growth: 67,
        summary:
          "Health agencies are monitoring a new variant. Travel advisories and vaccination discussions are trending again.",
        posts: 120,
        contributors: 25,
        tags: ["health", "virus", "variant", "medical"],
      },
    ];

    setTopics(fakeTopics);
  }, []);

  return (
    <div className="space-y-4 p-2">
      <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
        <h1 className="text-xl font-bold text-gray-800">🔥 Trending Topics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Explore what people are talking about right now.
        </p>
      </div>
    
    {selectedTopic ? (
        <TopicDetails
            topicId={selectedTopic}
            goBack={() => setSelectedTopic(null)}
        />
        ) : (
        <>
            {topics.map((topic) => (
            <TopicCard
                key={topic.id}
                topic={topic}
                onViewTopic={openTopicDetails}
            />
            ))}
        </>
    )}

    </div>
  );
}