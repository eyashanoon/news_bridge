// TopicDetails.jsx
import { useEffect, useState } from "react";
import TopicPost from "./TopicPost";

export default function TopicDetails({ topicId, goBack }) {
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // placeholder data load
    setTopic({
      id: topicId,
      title: "Israel – Gaza Conflict & Iran War Ceasefire",
      description:
        "Latest updates about international responses, ceasefire discussions, and regional tensions surrounding the Middle East conflict.",
      image: "https://via.placeholder.com/800x300.png?text=Topic+Hero+Image",
      date: "Apr 9, 2026",
      author: "AI News Updates",
      tags: ["world", "conflict", "ceasefire"],
    });

    // placeholder timeline posts
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
        text: "Reports of resumed diplomatic talks with neighboring nations.",
        likes: 21,
        dislikes: 3,
        userReaction: null,
        tags: ["diplomacy", "talks"],
        lang: "en",
      },
    ]);
  }, [topicId]);

  if (!topic) return null;

  return (
    <div className="space-y-6 p-4">
      {/* Back */}
      <button
        onClick={goBack}
        className="text-blue-600 hover:underline text-sm"
      >
        ← Back to Trending Topics
      </button>

      {/* Hero Section */}
      <div className="bg-white p-4 rounded-xl shadow">
        {topic.image && (
          <img
            src={topic.image}
            alt={topic.title}
            className="w-full rounded-lg mb-4"
          />
        )}

        <h1 className="text-3xl font-bold text-gray-800">
          {topic.title}
        </h1>

        <div className="text-sm text-gray-500 mt-1">
          {topic.author} · {topic.date}
        </div>

        <p className="text-gray-700 mt-3">{topic.description}</p>

        {/* tags */}
        <div className="flex gap-2 mt-2">
          {topic.tags.map((t, idx) => (
            <span
              key={idx}
              className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-700"
            >
              #{t}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 items-center mt-4">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Follow Topic
          </button>
          <button className="text-gray-600 hover:underline text-sm">
            Share
          </button>
        </div>
      </div>

      {/* Write new update box */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="font-semibold">Write an update</h2>
        <textarea
          rows={4}
          placeholder="Only verified users can share updates..."
          className="w-full border-gray-300 rounded-md mt-2 p-2"
          disabled
        />
        <button className="mt-2 bg-gray-400 text-white px-3 py-1 rounded-md cursor-not-allowed">
          Submit
        </button>
      </div>

      {/* Posts feed */}
      {posts.map((post) => (
        <TopicPost key={post.id} post={post} />
      ))}
    </div>
  );
}