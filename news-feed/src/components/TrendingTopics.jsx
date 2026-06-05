// TrendingTopics.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TopicCard from "./TopicCard";
import { fetchTopics, getMyTopics } from "../api/topicsApi";
import { getToken } from "../utils/auth";
import { getSessionFromToken } from "../auth";

export default function TrendingTopics() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const session = token ? getSessionFromToken(token) : null;
  const isEditor = !!(session && session.type === "EDITOR" && (
    session.roles.includes("PUBLISH_LIVE_NEWS") || session.roles.includes("EDIT_LIVE_NEWS")
  ));

  const openTopicDetails = (id) => {
    navigate(`/news/topics/${id}`);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    // Editors see ACTIVE + DRAFT topics via my-topics; regular users see only ACTIVE via fetchTopics
    if (isEditor) {
      getMyTopics().then((data) => {
        if (mounted) {
          setTopics(data);
          setLoading(false);
        }
      }).catch(() => {
        if (mounted) setLoading(false);
      });
    } else {
      fetchTopics().then((data) => {
        if (mounted) {
          setTopics(data);
          setLoading(false);
        }
      }).catch(() => {
        if (mounted) setLoading(false);
      });
    }
    return () => { mounted = false; };
  }, [isEditor]);

  if (loading) {
    return (
      <div className="space-y-4 p-2">
        <div className="trending-header-card">
          <h1>🔥 Trending Topics</h1>
          <p>{t("topicsLoading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2">
      <div className="trending-header-card">
        <h1>🔥 {t("trendingTopicsTitle")}</h1>
        <p>{t("trendingTopicsDesc")}</p>
      </div>

    {topics.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>{t("noTopicsAvailable")}</p>
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