// TopicDetails.jsx
import { useEffect, useState, useCallback } from "react";
import TopicPost from "./TopicPost";
import { fetchTopicById, fetchTopicPosts, createTopicPost, requestToPost, getMyAssignments, canRequestToPost } from "../api/topicsApi";
import { getToken } from "../utils/auth";
import { getSessionFromToken } from "../auth";
import { useTranslation } from "react-i18next";

export default function TopicDetails({ topicId, goBack }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const translateField = (name) => {
    return t(`field_${name}`, { defaultValue: name });
  };
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostText, setNewPostText] = useState("");
  const [newPostMediaUrl, setNewPostMediaUrl] = useState("");
  const [newPostMediaType, setNewPostMediaType] = useState("image");
  // Multi-media support: array of {type, url}
  const [newPostMediaItems, setNewPostMediaItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [canRequest, setCanRequest] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const token = getToken();
  const isAuthenticated = !!token;
  const session = token ? getSessionFromToken(token) : null;
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

  useEffect(() => {
    if (isEditor && topicId && !assignment) {
      canRequestToPost(topicId).then((result) => {
        setCanRequest(result);
      });
    } else if (assignment) {
      setCanRequest({ eligible: true, assignmentStatus: assignment.status });
    }
  }, [isEditor, topicId, assignment]);

  const handleRequestToPost = async () => {
    setRequesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestToPost(topicId);
      setAssignment(result);
      setNotice(lang === "ar"
        ? "تم إرسال طلبك. في انتظار موافقة المدير."
        : "Your request has been submitted. Waiting for admin approval.");
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
        title: newPostTitle.trim() || null,
        text: newPostText.trim(),
        label: "Update",
        lang: "en",
        tags: topic?.tags || [],
        mediaUrl: newPostMediaUrl.trim() || null,
        mediaType: newPostMediaUrl.trim() ? newPostMediaType : null,
      });
      setNewPostTitle("");
      setNewPostText("");
      setNewPostMediaUrl("");
      setNewPostMediaType("image");
      setShowEditor(false);
      setNotice(lang === "ar" ? "تم نشر المنشور!" : "Post published!");
      await loadPosts();
      await loadTopic();
    } catch (err) {
      setError(err.message || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = assignment && (assignment.status === "APPROVED" || assignment.status === "ASSIGNED");
  const isRequested = assignment && assignment.status === "REQUESTED";
  const isRejected = assignment && assignment.status === "REJECTED";

  if (loading && !topic) {
    return (
      <div className="topic-details-loading">
        <button onClick={goBack} className="topic-back-btn">
          <span className="topic-back-arrow">←</span>
          {lang === "ar" ? "العودة" : "Back"}
        </button>
        <div className="topic-details-skeleton">
          <div className="skeleton-image" />
          <div className="skeleton-title" />
          <div className="skeleton-text" />
          <div className="skeleton-text short" />
        </div>
      </div>
    );
  }

  if (!topic) return null;

  const topicImage = topic.imageUrl;

  return (
    <div className="topic-details">
      {/* Back button */}
      <button onClick={goBack} className="topic-back-btn">
        <span className="topic-back-arrow">←</span>
        {t("backToTrending")}
      </button>

      {/* Hero Section */}
      <div className="topic-hero">
        {topicImage && (
          <div className="topic-hero-image-wrapper">
            <img src={topicImage} alt={topic.title} className="topic-hero-image" />
            <div className="topic-hero-overlay" />
          </div>
        )}
        <div className="topic-hero-content">
          <h1 className="topic-hero-title">{topic.title}</h1>
          {topic.description && (
            <p className="topic-hero-description">{topic.description}</p>
          )}
          <div className="topic-hero-meta">
            {topic.author && (
              <span className="topic-meta-item">
                <span className="topic-meta-icon">✍️</span>
                {topic.author}
              </span>
            )}
            {topic.createdAt && (
              <span className="topic-meta-item">
                <span className="topic-meta-icon">📅</span>
                {new Date(topic.createdAt).toLocaleDateString(lang === "ar" ? "ar" : "en", {
                  year: "numeric", month: "short", day: "numeric"
                })}
              </span>
            )}
          </div>
          {/* Tags */}
          {(topic.tags || []).length > 0 && (
            <div className="topic-hero-tags">
              {topic.tags.map((tag, idx) => (
                <span key={idx} className="topic-hero-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="topic-stats-bar">
        <div className="topic-stat">
          <span className="topic-stat-icon">📝</span>
          <span className="topic-stat-value">{topic.posts || 0}</span>
          <span className="topic-stat-label">{lang === "ar" ? "منشورات" : "Posts"}</span>
        </div>
        <div className="topic-stat-divider" />
        <div className="topic-stat">
          <span className="topic-stat-icon">👥</span>
          <span className="topic-stat-value">{topic.contributors || 0}</span>
          <span className="topic-stat-label">{lang === "ar" ? "مساهمون" : "Contributors"}</span>
        </div>
        <div className="topic-stat-divider" />
        <div className="topic-stat">
          <span className="topic-stat-icon">🔥</span>
          <span className="topic-stat-value">{topic.growth || 0}%</span>
          <span className="topic-stat-label">{lang === "ar" ? "رائج" : "Trending"}</span>
        </div>
        {/* Fields */}
        {topic.fieldNames && topic.fieldNames.length > 0 && (
          <>
            <div className="topic-stat-divider" />
            <div className="topic-stat topic-stat-fields">
              {topic.fieldNames.map((fn, idx) => (
                <span key={idx} className="topic-field-badge">
                  📌 {translateField(fn)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Status badges / notices */}
      {(isEditor && topic.fieldIds && topic.fieldIds.length > 0) && (
        <div className="topic-editor-section">
          {topic.status === "DRAFT" && (
            <div className="topic-notice topic-notice-draft">
              <span className="topic-notice-icon">📋</span>
              <div>
                <strong>{lang === "ar" ? "وضع مسودة" : "Draft Mode"}</strong>
                <p>{lang === "ar"
                  ? "هذا الموضوع في وضع المسودة. يمكن للمحررين التقدم والموافقة عليه، ولكن النشر متاح فقط بعد نشره من المدير."
                  : "This topic is in DRAFT mode. Editors can apply and be approved, but posting is only possible after an admin publishes it."}</p>
              </div>
            </div>
          )}

          {topic.status === "DRAFT" && !isEditor && (
            <div className="topic-notice topic-notice-draft">
              <span className="topic-notice-icon">⏳</span>
              <div>
                <strong>{lang === "ar" ? "غير منشور بعد" : "Not yet published"}</strong>
                <p>{lang === "ar"
                  ? "هذا الموضوع لم يُنشر بعد. تحقق لاحقاً."
                  : "This topic is not yet published. Check back later."}</p>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="topic-notice topic-notice-error">
              <span className="topic-notice-icon">❌</span>
              <div>
                <strong>{lang === "ar" ? "تم رفض طلبك" : "Application Rejected"}</strong>
                <p>{lang === "ar"
                  ? "لا يمكنك النشر في هذا الموضوع. تم رفض طلبك."
                  : "You cannot post to this event. Your application was rejected."}</p>
              </div>
            </div>
          )}

          {isRequested && (
            <div className="topic-notice topic-notice-warning">
              <span className="topic-notice-icon">⏳</span>
              <div>
                <strong>{lang === "ar" ? "قيد المراجعة" : "Pending Approval"}</strong>
                <p>{lang === "ar"
                  ? "طلبك قيد المراجعة. سيقوم المدير بمراجعته قريباً."
                  : "Your application is pending approval. An admin will review your request shortly."}</p>
              </div>
            </div>
          )}

          {canPost && topic.status === "ACTIVE" && (
            <div className="topic-notice topic-notice-success">
              <span className="topic-notice-icon">✅</span>
              <div>
                <strong>{lang === "ar" ? "مسموح بالنشر" : "Authorized to Post"}</strong>
                <p>{lang === "ar"
                  ? "أنت مخول لنشر التحديثات في هذا الموضوع."
                  : "You are authorized to post updates in this event."}</p>
              </div>
            </div>
          )}

          {canPost && topic.status === "DRAFT" && (
            <div className="topic-notice topic-notice-info">
              <span className="topic-notice-icon">✅</span>
              <div>
                <strong>{lang === "ar" ? "تمت الموافقة" : "Application Approved"}</strong>
                <p>{lang === "ar"
                  ? "تمت الموافقة على طلبك! ومع ذلك، لا يزال هذا الموضوع في وضع المسودة. ستتمكن من النشر بمجرد نشره من المدير."
                  : "Your application has been approved! However, this topic is still in DRAFT mode. You will be able to post once the admin publishes it."}</p>
              </div>
            </div>
          )}

          {!assignment && canRequest?.eligible === false && (
            <div className="topic-notice topic-notice-muted">
              <span className="topic-notice-icon">ℹ️</span>
              <div>
                <p>{lang === "ar"
                  ? "حقول هذا الموضوع لا تتطابق مع حقولك كمحرر، لذلك لا يمكنك التقدم للنشر هنا."
                  : "This topic's fields don't match your editor fields, so you cannot apply to post here."}</p>
              </div>
            </div>
          )}

          {!assignment && canRequest?.eligible === true && (
            <div className="topic-apply-card">
              <div className="topic-apply-content">
                <span className="topic-apply-icon">🤝</span>
                <div>
                  <p className="topic-apply-text">
                    {lang === "ar"
                      ? "حقولك تتطابق مع هذا الموضوع. هل تريد المساهمة؟"
                      : "Your fields match this event. Would you like to contribute?"}
                  </p>
                </div>
              </div>
              <button
                className="topic-apply-btn"
                onClick={handleRequestToPost}
                disabled={requesting}
              >
                {requesting
                  ? (lang === "ar" ? "جاري الإرسال..." : "Requesting...")
                  : (lang === "ar" ? "التقدم للنشر" : "Apply to Post")}
              </button>
            </div>
          )}

          {!assignment && canRequest === null && (
            <div className="topic-notice topic-notice-muted">
              <span className="topic-notice-icon">🔍</span>
              <div>
                <p>{lang === "ar" ? "جاري التحقق من أهليتك..." : "Checking your eligibility..."}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Write new update section */}
      {canPost && topic.status === "ACTIVE" && (
      <div className="topic-write-section">
          {!showEditor ? (
            <button className="topic-write-trigger" onClick={() => setShowEditor(true)}>
              <span className="topic-write-trigger-icon">✍️</span>
              <span>{t("writeUpdate")}</span>
            </button>
          ) : (
            <div className="topic-write-card">
              <div className="topic-write-header">
                <h3>{t("writeUpdate").replace("...", "")}</h3>
                <button
                  className="topic-write-close"
                  onClick={() => {
                    setShowEditor(false);
                    setNewPostTitle("");
                    setNewPostText("");
                    setNewPostMediaUrl("");
                    setNewPostMediaType("image");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                className="topic-write-title-input"
                placeholder={t("postTitleOptional")}
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                disabled={submitting}
              />

              <textarea
                rows={4}
                placeholder={t("shareUpdate")}
                className="topic-write-textarea"
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                disabled={submitting}
              />

              {/* Media Upload */}
              <div className="topic-write-media">
                <p className="topic-write-media-label">
                  {t("attachMedia")}
                </p>
                <div className="topic-write-media-row">
                  <select
                    className="topic-write-media-select"
                    value={newPostMediaType}
                    onChange={(e) => setNewPostMediaType(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="image">🖼 {lang === "ar" ? "صورة" : "Image"}</option>
                    <option value="video">🎬 {lang === "ar" ? "فيديو" : "Video"}</option>
                  </select>
                  <label className="topic-write-media-upload">
                    <input
                      type="file"
                      accept={newPostMediaType === "image" ? "image/*" : "video/*"}
                      className="topic-write-media-input"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setSubmitting(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const endpoint = newPostMediaType === "image" ? "/api/upload/image" : "/api/upload/video";
                          const res = await fetch(endpoint, { method: "POST", body: formData });
                          if (!res.ok) throw new Error("Upload failed");
                          const data = await res.json();
                          if (data.url) setNewPostMediaUrl(data.url);
                        } catch (err) {
                          setError(lang === "ar" ? "فشل رفع الملف: " : "Failed to upload file: " + err.message);
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}
                    />
                    <span className="topic-write-media-upload-btn">
                      {lang === "ar" ? "📂 اختر ملف" : "📂 Choose file"}
                    </span>
                  </label>
                </div>
                {newPostMediaUrl && (
                  <div className="topic-write-media-preview">
                    {newPostMediaType === "image" ? (
                      <img src={newPostMediaUrl} alt="Preview" className="topic-write-media-img" />
                    ) : (
                      <video src={newPostMediaUrl} controls className="topic-write-media-video" />
                    )}
                    <button
                      className="topic-write-media-remove"
                      onClick={() => setNewPostMediaUrl("")}
                    >
                      {lang === "ar" ? "إزالة" : "Remove"}
                    </button>
                  </div>
                )}
              </div>

              {error && <p className="topic-write-error">{error}</p>}
              {notice && <p className="topic-write-success">{notice}</p>}

              <div className="topic-write-actions">
                <button
                  className="topic-write-submit"
                  onClick={handleSubmitPost}
                  disabled={submitting || !newPostText.trim()}
                >
                  {submitting
                    ? (lang === "ar" ? "جاري النشر..." : "Publishing...")
                    : (lang === "ar" ? "نشر" : "Publish")}
                </button>
                <button
                  className="topic-write-cancel"
                  onClick={() => {
                    setShowEditor(false);
                    setNewPostTitle("");
                    setNewPostText("");
                    setNewPostMediaUrl("");
                    setNewPostMediaType("image");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Posts Feed */}
      <div className="topic-posts-section">
        <div className="topic-posts-header">
        <h2 className="topic-posts-title">
          {t("postsSection")}
            <span className="topic-posts-count">{posts.length}</span>
          </h2>
        </div>

        {posts.length === 0 ? (
          <div className="topic-posts-empty">
            <div className="topic-posts-empty-icon">📭</div>
            <p className="topic-posts-empty-title">
              {t("noPostsYet")}
            </p>
            <p className="topic-posts-empty-subtitle">
              {t("beFirstToShare")}
            </p>
          </div>
        ) : (
          <div className="topic-posts-feed">
            {posts.map((post) => (
              <TopicPost
                key={post.id}
                post={post}
                topic={topic}
                onAskAI={(p) => {
                  // Topic posts can't be ingested by post ID, so just call onAskAI directly
                  // The ChatWidget will handle the topic post context
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}