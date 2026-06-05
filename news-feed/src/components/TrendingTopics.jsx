// TrendingTopics.jsx
import { useEffect, useState } from "react";
import TopicCard from "./TopicCard";
import TopicDetails from "./TopicDetails";
import { fetchTopics } from "../api/topicsApi";

export default function TrendingTopics() {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);

  const openTopicDetails = (id) => {
    setSelectedTopic(id);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchTopics().then((data) => {
      if (mounted) {
        setTopics(data);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-2">
        <div className="trending-header-card">
          <h1>🔥 Trending Topics</h1>
          <p>Loading trending topics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2">
      <div className="trending-header-card">
        <h1>🔥 Trending Topics</h1>
        <p>Explore what people are talking about right now.</p>
      </div>

    {selectedTopic ? (
        <TopicDetails
            topicId={selectedTopic}
            goBack={() => setSelectedTopic(null)}
        />
        ) : topics.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No trending topics available right now.</p>
          </div>
        ) : (
        <div className="stagger space-y-3">
            {topics.map((topic) => (
            <TopicCard
                key={topic.id}
                topic={topic}
                onViewTopic={openTopicDetails}
            />
            ))}
        </div>
    )}

    </div>
  );
}