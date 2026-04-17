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
  const [activeTab, setActiveTab] = useState("posts"); // posts | requests | settings
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
    api.get(`/api/events/${id}/publish-requests`, cfg)
      .then((r) => setRequests(r.data))
      .catch(console.error);
  }, [id, session?.token]);

  const loadPosts = useCallback(() => {
    api.get(`/api/live-news`, { ...cfg, params: { eventId: id } })
      .then((r) => setPosts(r.data))
      .catch(console.error);
  }, [id, session?.token]);

  useEffect(() => {
    loadEvent();
    loadRequests();
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

  const handleReviewRequest = async (reqId, approve) => {
    const label = approve ? "approve" : "reject";
    const ok = await ask(`Are you sure you want to ${label} this publish request?`, approve ? "Approve Request" : "Reject Request");
    if (!ok) return;
    try {
      await api.put(`/api/events/publish-requests/${reqId}/${approve ? "approve" : "reject"}`, {}, cfg);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || "Failed");
    }
  };

  const handleDeletePost = async (postId) => {
    const ok = await ask("Delete this live news post permanently?", "Delete Post");
    if (!ok) return;
    try {
      await api.delete(`/api/live-news/${postId}`, cfg);
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete post");
    }
  };

  const handleUpdatePost = async (e, postId) => {
    e.preventDefault();
    try {
      await api.put(`/api/live-news/${postId}`, editingPost, cfg);
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
        <button className="event-back-btn" onClick={() => nav("/admin/events")}>← Back to Events</button>
        {error ? <div className="admin-error">{error}</div> : <p>Loading event...</p>}
      </div>
    );
  }

  return (
    <div className="event-detail-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <button className="event-back-btn" onClick={() => nav("/admin/events")}>
        ← Back to Events
      </button>

      {error && <div className="admin-error">{error}</div>}

      <div className="event-detail-hero">
        <div className="event-detail-hero-left">
          <div className="event-detail-field-badge">{event.field?.name || "No Field"}</div>
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
          <span className="tab-count pending">{requests.filter((r) => r.status === "PENDING").length}</span>
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
                    <form onSubmit={(e) => handleUpdatePost(e, p.id)} className="live-post-edit-form">
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
                        <button className="admin-btn small danger" onClick={() => handleDeletePost(p.id)}>
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
                    {req.status === "PENDING" && (
                      <div className="publish-req-actions">
                        <button className="admin-btn small primary" onClick={() => handleReviewRequest(req.id, true)}>Approve</button>
                        <button className="admin-btn small danger" onClick={() => handleReviewRequest(req.id, false)}>Reject</button>
                      </div>
                    )}
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
              <div className="event-settings-row"><label>Field</label><span>{event.field?.name || "—"}</span></div>
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
