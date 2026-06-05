// TopicDetails.jsx
import { useEffect, useState, useCallback } from "react";
import TopicPost from "./TopicPost";
import { fetchTopicById, fetchTopicPosts, createTopicPost, requestToPost, getMyAssignments } from "../api/topicsApi";
import { getToken } from "../utils/auth";
import { getSessionFromToken } from "../auth";

export default function TopicDetails({ topicId, goBack }) {
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [assignment, setAssignment] = useState(null); // current editor's assignment for this topic
  const [requesting, setRequesting] = useState(false);

  const token = getToken();
  const isAuthenticated = !!token;
  const session = token ? getSessionFromToken(token) : null;
  // User is an editor only if the JWT type === "EDITOR" AND they have PUBLISH_LIVE_NEWS or EDIT_LIVE_NEWS role
  const isEditor = !!(session && session.type === "EDITOR" && (
    session.roles.includes("PUBLISH_LIVE_NEWS") || session.roles.includes("EDIT_LIVE_NEWS")
  ));

  const loadTopic = useCallback(async () => {
    const data = await fetchTopicById(topicId);
    setTopic(data);
  }, [topicId]);

  const loadPosts = useCallback(async () => {
    const data = await fetchTopicPosts(topicId);
    setPosts(data);
    setLoading(false);
  }, [topicId]);

  const loadAssignment = useCallback(async () => {
    const assignments = await getMyAssignments();
    const found = (assignments || []).find((a) => a.topicId === topicId);
    setAssignment(found || null);
  }, [topicId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTopic(), loadPosts(), loadAssignment()]);
  }, [loadTopic, loadPosts, loadAssignment]);

  const handleRequestToPost = async () => {
    setRequesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestToPost(topicId);
      setAssignment(result);
      setNotice("Your request has been submitted. Waiting for admin approval.");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to request");
    } finally {
      setRequesting(false);
    }
  };

  const handleSubmitPost = async () => {
    if (!newPostText.trim()) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createTopicPost(topicId, {
        text: newPostText.trim(),
        label: "Update",
        lang: "en",
        tags: topic?.tags || [],
      });
      setNewPostText("");
      setNotice("Post published!");
      await loadPosts();
      await loadTopic();
    } catch (err) {
      setError(err.message || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  // Determine editor's posting status
  const canPost = assignment && (assignment.status === "APPROVED" || assignment.status === "ASSIGNED");
  const isRequested = assignment && assignment.status === "REQUESTED";
  const isRejected = assignment && assignment.status === "REJECTED";

  if (loading && !topic) {
    return (
      <div className="space-y-4 p-2">
        <button onClick={goBack} className="text-blue-600 hover:underline text-sm font-medium">
          ← Back to Trending Topics
        </button>
        <p className="text-gray-500">Loading topic details...</p>
      </div>
    );
  }

  if (!topic) return null;

  return (
    <div className="space-y-4 p-2">
      {/* Back */}
      <button
        onClick={goBack}
        className="text-blue-600 hover:underline text-sm font-medium"
      >
        ← Back to Trending Topics
      </button>

      {/* Hero Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        {topic.imageUrl && (
          <img
            src={topic.imageUrl}
            alt={topic.title}
            className="w-full rounded-lg mb-4"
          />
        )}

        <h1 className="text-2xl font-bold text-gray-900">
          {topic.title}
        </h1>

        <div className="text-sm text-gray-500 mt-1">
          {topic.author}
          {topic.createdAt && ` · ${new Date(topic.createdAt).toLocaleDateString()}`}
        </div>

        <p className="text-gray-600 mt-3 leading-relaxed">{topic.description}</p>

        {/* Topic fields display */}
        {topic.fieldNames && topic.fieldNames.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {topic.fieldNames.map((fn, idx) => (
              <span key={idx} className="post-tag" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                📌 {fn}
              </span>
            ))}
          </div>
        )}

        {/* tags */}
        <div className="flex gap-2 mt-3">
          {(topic.tags || []).map((t, idx) => (
            <span key={idx} className="post-tag">#{t}</span>
          ))}
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-3 text-sm text-gray-500">
          <span>📝 {topic.posts || 0} posts</span>
          <span>👥 {topic.contributors || 0} contributors</span>
          <span>🔥 {topic.growth || 0}% trending</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 items-center mt-4">
          <button className="btn btn-primary">
            Follow Topic
          </button>
        </div>
      </div>

      {/* Editor Assignment & Write Update Section (only for editors) */}
      {isEditor && topic.fieldIds && topic.fieldIds.length > 0 && (
        <>
          {/* Editor Assignment Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            {isRejected && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                ❌ You cannot post to this event. Your application was rejected.
              </div>
            )}

            {isRequested && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
                ⏳ Application pending approval. An admin will review your request shortly.
              </div>
            )}

            {canPost && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                ✅ You are authorized to post updates in this event.
              </div>
            )}

            {!assignment && (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Your fields match this event. Would you like to contribute?
                </p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleRequestToPost}
                  disabled={requesting}
                >
                  {requesting ? "Requesting..." : "Apply to Post"}
                </button>
              </div>
            )}
          </div>

          {/* Write new update box (only when approved/assigned) */}
          {canPost && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="font-semibold text-gray-800">Write an update</h2>
              <textarea
                rows={4}
                placeholder="Share your update about this topic..."
                className="form-control mt-2"
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                disabled={submitting}
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
              {notice && <p className="text-green-600 text-sm mt-1">{notice}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmitPost}
                  disabled={submitting || !newPostText.trim()}
                >
                  {submitting ? "Posting..." : "Submit"}
                </button>
                <button
                  className="text-xs text-gray-500"
                  onClick={() => { setNewPostText(""); setError(null); setNotice(null); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Posts feed */}
      {posts.length === 0 ? (
        <div className="text-center text-gray-500 py-4">
          <p>No posts yet in this topic. Be the first to share an update!</p>
        </div>
      ) : (
        <div className="stagger space-y-3">
          {posts.map((post) => (
            <TopicPost key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}