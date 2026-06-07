// TopicDetails.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import TopicPost from "./TopicPost";

export default function TopicDetails({ topicId, goBack }) {
  const { t } = useTranslation();
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    setTopic({
      id: topicId,
      title: "Israel - Gaza Conflict and Iran War Ceasefire",
      description:
        "Latest updates about international responses, ceasefire discussions, and regional tensions surrounding the Middle East conflict.",
      image: "https://via.placeholder.com/800x300.png?text=Topic+Hero+Image",
      date: "Apr 9, 2026",
      author: "AI News Updates",
      tags: ["world", "conflict", "ceasefire"],
      status: "ACTIVE",
    });

    setPosts([
      {
        id: 1,
        label: "Breaking",
        text: "Live updates: international actors react as temporary ceasefire holds.",
        likes: 15,
        dislikes: 0,
        userReaction: null,
        tags: ["ceasefire", "global"],
        lang: "en",
      },
      {
        id: 2,
        label: "Analysis",
        text: "Expert commentary on stability prospects after fragile ceasefire.",
        likes: 8,
        dislikes: 1,
        userReaction: null,
        tags: ["expert", "analysis"],
        lang: "en",
      },
      {
        id: 3,
        label: "Update",
        text: "Relief groups report improved corridor access while negotiations continue.",
        likes: 4,
        dislikes: 0,
        userReaction: null,
        tags: ["relief", "diplomacy"],
        lang: "en",
      },
    ]);
  }, [topicId]);

  if (!topic) {
    return null;
  }

  return (
    <div className="topic-details">
      <button onClick={goBack} className="topic-back-btn">
        <span className="topic-back-arrow">←</span>
        {t("backToTrending", { defaultValue: "Back to trending" })}
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        {topic.image && (
          <img
            src={topic.image}
            alt={topic.title}
            className="w-full rounded-lg mb-4"
          />
        )}

        <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>

        <div className="text-sm text-gray-500 mt-1">
          {topic.author} · {topic.date}
        </div>

        <p className="text-gray-600 mt-3 leading-relaxed">{topic.description}</p>

        <div className="flex gap-2 mt-3">
          {topic.tags.map((tag) => (
            <span key={tag} className="post-tag">
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex gap-3 items-center mt-4">
          <button className="btn btn-primary">Follow Topic</button>
          <button className="btn btn-ghost text-sm">Share</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
        <h2 className="font-semibold text-gray-800">Write an update</h2>
        <textarea
          rows={4}
          placeholder="Only verified users can share updates..."
          className="form-control mt-2"
          disabled
        />
        <button className="mt-2 btn btn-sm text-gray-400 cursor-not-allowed">
          Submit
        </button>
      </div>

      <div className="stagger space-y-3 mt-4">
        {posts.map((post) => (
          <TopicPost key={post.id} post={post} topic={topic} />
        ))}
      </div>
    </div>
  );
}