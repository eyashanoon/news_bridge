import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { api, authConfig } from "../api";

/* ─── Reusable confirm dialog hook (same pattern as AdminPage) ────────────── */
function useDialog() {
  const [state, setState] = useState({ open: false, title: "", message: "", resolve: null });

  const ask = (message, title = "Confirm") =>
    new Promise((resolve) => setState({ open: true, title, message, resolve }));

  const closeWith = (v) => {
    if (state.resolve) state.resolve(v);
    setState((p) => ({ ...p, open: false, resolve: null }));
  };

  const Dialog = state.open ? (
    <div className="confirm-modal-overlay" role="dialog" aria-modal="true">
      <div className="confirm-modal-card">
        <h3>{state.title}</h3>
        <p>{state.message}</p>
        <div className="confirm-modal-actions">
          <button className="admin-btn small" onClick={() => closeWith(false)}>Cancel</button>
          <button className="admin-btn small danger" onClick={() => closeWith(true)}>Confirm</button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, Dialog };
}

const STATUS_LABELS = { DRAFT: "Draft", EDITOR_VISIBLE: "Open to Editors", PUBLIC: "Public" };
const STATUS_COLORS = { DRAFT: "#64748b", EDITOR_VISIBLE: "#f59e0b", PUBLIC: "#22c55e" };

export default function EventDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { session } = useSession();
  const cfg = authConfig(session?.token);

  const [event, setEvent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [posts, setPosts] = useState([]);
  const [editors, setEditors] = useState([]); // topic editor assignments
  const [activeTab, setActiveTab] = useState("posts"); // posts | requests | editors | settings
  const [error, setError] = useState("");
  const [editForm, setEditForm] = useState(null); // null = not editing
  const [fields, setFields] = useState([]);
  const [postSearch, setPostSearch] = useState("");
  const [editingPost, setEditingPost] = useState(null);
  const { ask, Dialog } = useDialog();

  const loadEvent = useCallback(() => {
    api.get(`/api/events/${id}`, cfg)
      .then((r) => { setEvent(r.data); setEditForm(null); })
      .catch(() => setError("Event not found"));
  }, [id, session?.token]);

  const loadRequests = useCallback(() => {
    // Load both the legacy event-scoped publish requests and the
    // newer topic-scoped editor assignments, so the admin sees
    // every application regardless of which API the editor used.
    const legacy = api.get(`/api/events/${id}/publish-requests`, cfg)
      .then((r) => Array.isArray(r.data) ? r.data : [])
      .catch(() => []);

    // Look up the topic ID linked to this event, then load assignments
    // from the topic system. This is the system the new editor flow uses.
    // Same title-fallback strategy as loadPosts (handles events that
    // predate the topicId FK column).
    const eventMeta = api.get(`/api/events/${id}`, cfg)
      .then((r) => r.data || null)
      .catch(() => null);

    const topicAssignments = eventMeta.then((ev) => {
      const fetchById = (tid) => api.get(`/api/topics/${tid}/editors`, cfg)
        .then((r) => Array.isArray(r.data) ? r.data : [])
        .catch(() => []);
      if (ev && ev.topicId) return fetchById(ev.topicId);
      if (ev && ev.title) {
        return api.get(`/api/topics`, cfg)
          .then((r) => {
            const all = Array.isArray(r.data) ? r.data : [];
            const match = all.find((t) => t.title === ev.title);
            return match ? fetchById(match.id) : [];
          })
          .catch(() => []);
      }
      return [];
    }).catch(() => []);

    Promise.all([legacy, topicAssignments]).then(([legacyReqs, topicReqs]) => {
      // Normalize each topic assignment to look like a publish request row
      // so the existing UI can render both lists uniformly.
      const topicAsRequests = topicReqs
        .filter((a) => a && a.status === "REQUESTED")
        .map((a) => ({
          id: `topic-${a.id}`,
          eventId: id,
          eventTitle: a.topicTitle,
          editorId: a.editorId,
          editorEmail: a.editorEmail,
          editorName: a.editorName,
          status: a.status,
          requestedAt: a.createdAt,
          reviewedAt: null,
          reviewedByEmail: null,
          // Bookkeeping for the approve/reject handlers below
          // The backend approve/reject endpoints expect editorId (not assignment row id)
          _topicEditorId: a.editorId,
          _topicId: a.topicId,
        }));
      setRequests([...legacyReqs, ...topicAsRequests]);
    }).catch(console.error);
  }, [id, session?.token]);

  const loadEditors = useCallback(() => {
    // Load all topic editor assignments for this event (REQUESTED, APPROVED, ASSIGNED, etc.)
    // so the admin can see who is currently assigned to post on this topic.
    const eventMeta = api.get(`/api/events/${id}`, cfg)
      .then((r) => r.data || null)
      .catch(() => null);

    const topicEditors = eventMeta.then((ev) => {
      const fetchById = (tid) => api.get(`/api/topics/${tid}/editors`, cfg)
        .then((r) => Array.isArray(r.data) ? r.data : [])
        .catch(() => []);
      if (ev && ev.topicId) return fetchById(ev.topicId);
      if (ev && ev.title) {
        return api.get(`/api/topics`, cfg)
          .then((r) => {
            const all = Array.isArray(r.data) ? r.data : [];
            const match = all.find((t) => t.title === ev.title);
            return match ? fetchById(match.id) : [];
          })
          .catch(() => []);
      }
      return [];
    }).catch(() => []);

    topicEditors
      .then((list) => setEditors(list))
      .catch(() => setEditors([]));
  }, [id, session?.token]);

  const loadPosts = useCallback(() => {
    // Fetch both the legacy live-news posts and the newer topic-scoped
    // posts (so the count and the list reflect every post the editor
    // made, regardless of which pipeline they used).
    const legacy = api.get(`/api/live-news`, { ...cfg, params: { eventId: id } })
      .then((r) => Array.isArray(r.data) ? r.data : [])
      .catch(() => []);

    // Look up the topic ID linked to this event, then load posts from
    // the topic system. The new editor flow writes here.
    const eventMeta = api.get(`/api/events/${id}`, cfg)
      .then((r) => r.data || null)
      .catch(() => null);

    // Resolve a topicId either from the event's FK (preferred) or by
    // matching the event title against the topics table (fallback for
    // events created before the topicId column was added). Either way
    // we end up with the right topic and its posts.
    const topicPosts = eventMeta.then((ev) => {
      if (ev && ev.topicId) {
        return api.get(`/api/topics/${ev.topicId}/posts`, cfg)
          .then((r) => Array.isArray(r.data) ? r.data : [])
          .catch(() => []);
      }
      if (ev && ev.title) {
        // Fallback: find a topic with the same title. The old createTopicFromEvent
        // matched topics to events by title, so the title is a reliable link for
        // events that predate the topicId FK column.
        return api.get(`/api/topics`, cfg)
          .then((r) => {
            const all = Array.isArray(r.data) ? r.data : [];
            const match = all.find((t) => t.title === ev.title);
            if (!match) return [];
            return api.get(`/api/topics/${match.id}/posts`, cfg)
              .then((r2) => Array.isArray(r2.data) ? r2.data : [])
              .catch(() => []);
          })
          .catch(() => []);
      }
      return [];
    }).catch(() => []);

    Promise.all([legacy, topicPosts]).then(([livePosts, tpPosts]) => {
      // Normalize each topic post to look like a live-news post row so
      // the existing UI renders both lists uniformly.
      const topicAsPosts = tpPosts.map((p) => ({
        // The page reads p.id, p.headline, p.content, p.authorEmail,
        // p.authorName, p.authorAvatar, p.publishedAt, p.updatedAt.
        id: `topic-${p.id}`,
        _isTopicPost: true,
        _topicPostId: p.id,
        eventId: id,
        headline: p.title || "",
        content: p.text || "",
        authorEmail: p.authorEmail,
        authorName: p.author,
        authorAvatar: p.authorProfilePicture,
        mediaUrl: p.mediaUrl,
        mediaType: p.mediaType,
        publishedAt: p.createdAt,
        updatedAt: p.createdAt,
      }));
      setPosts([...livePosts, ...topicAsPosts]);
    }).catch(console.error);
  }, [id, session?.token]);

  useEffect(() => {
    loadEvent();
    loadRequests();
    loadEditors();
    loadPosts();
    api.get("/api/fields", cfg).then((r) => setFields(r.data)).catch(console.error);
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    try {
      const r = await api.patch(`/api/events/${id}/status`, { status: newStatus }, cfg);
      setEvent(r.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed");
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const r = await api.put(`/api/events/${id}`, { ...editForm, fieldId: Number(editForm.fieldId) }, cfg);
      setEvent(r.data);
      setEditForm(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    }
  };

  const handleReviewRequest = async (req, approve) => {
    const label = approve ? "approve" : "reject";
    const ok = await ask(`Are you sure you want to ${label} this publish request?`, approve ? "Approve Request" : "Reject Request");
    if (!ok) return;
    try {
      // If this row came from the new topic system, use the topic endpoints.
      if (req && typeof req.id === "string" && req.id.startsWith("topic-")) {
        const editorId = req._topicEditorId;
        const topicId = req._topicId;
        await api.post(`/api/topics/${topicId}/${approve ? "approve" : "reject"}/${editorId}`, {}, cfg);
      } else {
        // Legacy event-scoped publish request
        await api.put(`/api/events/publish-requests/${req.id}/${approve ? "approve" : "reject"}`, {}, cfg);
      }
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || "Failed");
    }
  };

  const handleDeletePost = async (post) => {
    const ok = await ask("Delete this live news post permanently?", "Delete Post");
    if (!ok) return;
    try {
      if (post && post._isTopicPost) {
        // Newer topic-scoped post — use the topic admin endpoint
        await api.delete(`/api/topics/${event.topicId}/posts/${post._topicPostId}`, cfg);
      } else {
        // Legacy event-scoped post
        await api.delete(`/api/live-news/${post.id}`, cfg);
      }
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete post");
    }
  };

  const handleUpdatePost = async (e, post) => {
    e.preventDefault();
    try {
      if (post && post._isTopicPost) {
        // Newer topic-scoped post — the topic update endpoint only takes
        // content/text, not headline/title, so for now just skip edit on
        // topic posts (or extend the backend DTO if headline-edit is needed).
        setError("Editing topic-post text from the admin UI is not yet supported. Use the topic detail API.");
      } else {
        await api.put(`/api/live-news/${post.id}`, editingPost, cfg);
      }
      setEditingPost(null);
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update post");
    }
  };

  const filteredPosts = posts.filter((p) => {
    const q = postSearch.toLowerCase();
    return !q || p.authorEmail?.toLowerCase().includes(q) || p.headline?.toLowerCase().includes(q);
  });

  if (!event) {
    return (
      <div className="event-detail-page">
        <button className="event-back-btn" onClick={() => nav("/admin/topics")}>← Back to Events</button>
        {error ? <div className="admin-error">{error}</div> : <p>Loading event...</p>}
      </div>
    );
  }

  return (
    <div className="event-detail-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <button className="event-back-btn" onClick={() => nav("/admin/topics")}>
        ← Back to Events
      </button>

      {error && <div className="admin-error">{error}</div>}

      <div className="event-detail-hero">
        <div className="event-detail-hero-left">
          <div className="event-detail-field-badges">
            {(() => {
              // Resolve every assigned field (from event.fieldIds) to its
              // name in fields so the hero shows the full set, not just
              // the single primary field. Fall back to event.field if
              // fieldIds is empty.
              const assigned = (event.fieldIds && event.fieldIds.length > 0
                ? event.fieldIds
                    .map((fid) => fields.find((f) => Number(f.id) === Number(fid)))
                    .filter(Boolean)
                : (event.field ? [event.field] : []));
              if (assigned.length === 0) {
                return <span className="event-detail-field-badge">No Field</span>;
              }
              return assigned.map((f) => (
                <span key={f.id} className="event-detail-field-badge">{f.name}</span>
              ));
            })()}
          </div>
          <h1 className="event-detail-title">{event.title}</h1>
          <p className="event-detail-desc">{event.description || "No description."}</p>
          <div className="event-detail-meta">
            <span>Created by <strong>{event.createdByEmail || "—"}</strong></span>
            <span> · {event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}</span>
          </div>
        </div>
        <div className="event-detail-hero-right">
          <span
            className="event-status-badge large"
            style={{ background: STATUS_COLORS[event.status] + "22", color: STATUS_COLORS[event.status], border: `1px solid ${STATUS_COLORS[event.status]}66` }}
          >
            {STATUS_LABELS[event.status] || event.status}
          </span>
          <div className="event-status-actions">
            {event.status !== "DRAFT" && (
              <button className="admin-btn small" onClick={() => handleStatusChange("DRAFT")}>Revert Draft</button>
            )}
            {event.status !== "EDITOR_VISIBLE" && (
              <button className="admin-btn small" onClick={() => handleStatusChange("EDITOR_VISIBLE")}>Open to Editors</button>
            )}
            {event.status !== "PUBLIC" && (
              <button className="admin-btn small primary" onClick={() => handleStatusChange("PUBLIC")}>Go Public</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Nav ───────────────────────────────────────────────────────── */}
      <div className="event-detail-tabs">
        <button
          className={`event-tab-btn${activeTab === "posts" ? " active" : ""}`}
          onClick={() => setActiveTab("posts")}
        >
          Live Posts <span className="tab-count">{posts.length}</span>
        </button>
        <button
          className={`event-tab-btn${activeTab === "requests" ? " active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          Publish Requests{" "}
          {/* Count both legacy "PENDING" and new topic-system "REQUESTED" */}
          <span className="tab-count pending">
            {requests.filter((r) => r.status === "PENDING" || r.status === "REQUESTED").length}
          </span>
        </button>
        <button
          className={`event-tab-btn${activeTab === "editors" ? " active" : ""}`}
          onClick={() => setActiveTab("editors")}
        >
          Editors
          <span className="tab-count">{editors.length}</span>
        </button>
        <button
          className={`event-tab-btn${activeTab === "settings" ? " active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </div>

      {/* ── Tab: Live Posts ───────────────────────────────────────────────── */}
      {activeTab === "posts" && (
        <div className="event-tab-content">
          <div className="event-posts-toolbar">
            <input
              className="event-search-input"
              placeholder="Search by editor or headline..."
              value={postSearch}
              onChange={(e) => setPostSearch(e.target.value)}
            />
          </div>
          {filteredPosts.length === 0 ? (
            <div className="event-empty-state"><p>No live news posts yet for this event.</p></div>
          ) : (
            <div className="live-posts-list">
              {filteredPosts.map((p) => (
                <div key={p.id} className="live-post-card">
                  {editingPost?.id === p.id ? (
                    <form onSubmit={(e) => handleUpdatePost(e, p)} className="live-post-edit-form">
                      <input
                        value={editingPost.headline}
                        onChange={(e) => setEditingPost({ ...editingPost, headline: e.target.value })}
                        required
                        placeholder="Headline"
                      />
                      <textarea
                        value={editingPost.content}
                        onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                        rows={4}
                        required
                        placeholder="Content"
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="admin-btn small primary" type="submit">Save</button>
                        <button className="admin-btn small" type="button" onClick={() => setEditingPost(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="live-post-header">
                        <div className="live-post-author">
                          <img
                            src={p.authorAvatar || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='100%25' height='100%25' fill='%231f2937'/><circle cx='20' cy='15' r='7' fill='%2334d399'/><rect x='8' y='24' width='24' height='10' rx='5' fill='%2310b981'/></svg>"}
                            alt="author"
                            className="live-post-avatar"
                          />
                          <div>
                            <div className="live-post-author-name">{p.authorName || p.authorEmail}</div>
                            <div className="live-post-author-email">{p.authorEmail}</div>
                          </div>
                        </div>
                        <div className="live-post-time">
                          <span>{new Date(p.publishedAt).toLocaleString()}</span>
                          {p.updatedAt !== p.publishedAt && (
                            <span className="live-post-edited"> (edited)</span>
                          )}
                        </div>
                      </div>
                      <h4 className="live-post-headline">{p.headline}</h4>
                      <p className="live-post-content">{p.content}</p>
                      <div className="live-post-actions">
                        <button
                          className="admin-btn small"
                          onClick={() => setEditingPost({ id: p.id, headline: p.headline, content: p.content })}
                        >
                          Edit
                        </button>
                        <button className="admin-btn small danger" onClick={() => handleDeletePost(p)}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Publish Requests ─────────────────────────────────────────── */}
      {activeTab === "requests" && (
        <div className="event-tab-content">
          {requests.length === 0 ? (
            <div className="event-empty-state"><p>No publish requests yet for this event.</p></div>
          ) : (
            <div className="publish-requests-list">
              {requests.map((req) => (
                <div key={req.id} className={`publish-req-card ${req.status.toLowerCase()}`}>
                  <div className="publish-req-info">
                    <div className="publish-req-editor">
                      <strong>{req.editorName || req.editorEmail}</strong>
                      <span className="publish-req-email">{req.editorEmail}</span>
                    </div>
                    <div className="publish-req-meta">
                      Requested: {new Date(req.requestedAt).toLocaleString()}
                      {req.reviewedAt && ` · Reviewed: ${new Date(req.reviewedAt).toLocaleString()} by ${req.reviewedByEmail}`}
                    </div>
                  </div>
                  <div className="publish-req-right">
                    <span className={`publish-req-status ${req.status.toLowerCase()}`}>{req.status}</span>
                    {/* Both legacy "PENDING" and new topic-system "REQUESTED" assignments
                        can still be approved/rejected from this page. */}
                    {(req.status === "PENDING" || req.status === "REQUESTED") && (
                      <div className="publish-req-actions">
                        <button className="admin-btn small primary" onClick={() => handleReviewRequest(req, true)}>Approve</button>
                        <button className="admin-btn small danger" onClick={() => handleReviewRequest(req, false)}>Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Editors ───────────────────────────────────────────────────── */}
      {activeTab === "editors" && (
        <div className="event-tab-content">
          {editors.length === 0 ? (
            <div className="event-empty-state"><p>No editors assigned to this topic yet.</p></div>
          ) : (
            <div className="publish-requests-list">
              {editors.map((e) => (
                <div key={e.id} className={`publish-req-card ${e.status.toLowerCase()}`}>
                  <div className="publish-req-info">
                    <div className="publish-req-editor">
                      <strong>{e.editorName || e.editorEmail}</strong>
                      <span className="publish-req-email">{e.editorEmail}</span>
                    </div>
                    <div className="publish-req-meta">
                      Status: <strong>{e.status}</strong>
                      {e.assignedBy && ` · by ${e.assignedBy}`}
                      {e.createdAt && ` · ${new Date(e.createdAt).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="publish-req-right">
                    <span className={`publish-req-status ${e.status.toLowerCase()}`}>{e.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Settings ─────────────────────────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="event-tab-content">
          {editForm === null ? (
            <div className="event-settings-view">
              <div className="event-settings-row"><label>Title</label><span>{event.title}</span></div>
              <div className="event-settings-row">
                <label>Field{event.fieldIds && event.fieldIds.length > 1 ? "s" : ""}</label>
                <span>
                  {(() => {
                    const assigned = (event.fieldIds && event.fieldIds.length > 0
                      ? event.fieldIds
                          .map((fid) => fields.find((f) => Number(f.id) === Number(fid)))
                          .filter(Boolean)
                      : (event.field ? [event.field] : []));
                    if (assigned.length === 0) return "—";
                    return assigned.map((f) => f.name).join(", ");
                  })()}
                </span>
              </div>
              <div className="event-settings-row"><label>Status</label><span>{STATUS_LABELS[event.status]}</span></div>
              <div className="event-settings-row"><label>Description</label><span>{event.description || "—"}</span></div>
              <div className="event-settings-row"><label>Created by</label><span>{event.createdByEmail || "—"}</span></div>
              <div className="event-settings-row"><label>Created at</label><span>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}</span></div>
              <button
                className="admin-btn primary"
                style={{ marginTop: 16 }}
                onClick={() => setEditForm({ title: event.title, description: event.description || "", fieldId: event.field?.id || "", status: event.status })}
              >
                Edit Event
              </button>
            </div>
          ) : (
            <form className="admin-form" onSubmit={handleSaveEdit}>
              <label>Title</label>
              <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
              <label>Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", resize: "vertical" }}
              />
              <label>Field</label>
              <select
                value={editForm.fieldId}
                onChange={(e) => setEditForm({ ...editForm, fieldId: e.target.value })}
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }}
              >
                <option value="">— Select Field —</option>
                {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <label>Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }}
              >
                <option value="DRAFT">Draft</option>
                <option value="EDITOR_VISIBLE">Open to Editors</option>
                <option value="PUBLIC">Public</option>
              </select>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="admin-btn primary" type="submit">Save Changes</button>
                <button className="admin-btn" type="button" onClick={() => setEditForm(null)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {Dialog}
    </div>
  );
}
