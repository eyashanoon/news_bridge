import { useState, useEffect, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import { api, authConfig } from "../api";
import FeedPage from "./FeedPage";

const STATUS_LABELS = { DRAFT: "Draft", EDITOR_VISIBLE: "Open to Editors", PUBLIC: "Public" };
const STATUS_COLORS = { DRAFT: "#64748b", EDITOR_VISIBLE: "#f59e0b", PUBLIC: "#22c55e" };

export default function EditorPage() {
  const { session, editorMode, setNotice } = useSession();

  if (editorMode === "registered") {
    return <FeedPage />;
  }

  return <EditorDashboard session={session} setNotice={setNotice} />;
}

function EditorDashboard({ session, setNotice }) {
  const [activeSection, setActiveSection] = useState("events");
  const cfg = authConfig(session?.token);

  return (
    <div className="editor-dashboard">
      <div className="editor-dash-header">
        <h1>Editor Workspace</h1>
        <p>You are operating in <strong>EDITOR MODE</strong></p>
      </div>

      <div className="editor-dash-nav">
        <button className={`editor-nav-tab${activeSection === "events" ? " active" : ""}`} onClick={() => setActiveSection("events")}>
          My Field Events
        </button>
        <button className={`editor-nav-tab${activeSection === "publish" ? " active" : ""}`} onClick={() => setActiveSection("publish")}>
          My Publish Requests
        </button>
        <button className={`editor-nav-tab${activeSection === "posts" ? " active" : ""}`} onClick={() => setActiveSection("posts")}>
          Publish Live News
        </button>
      </div>

      <div className="editor-dash-content">
        {activeSection === "events" && <EventsSection cfg={cfg} />}
        {activeSection === "publish" && <MyRequestsSection cfg={cfg} />}
        {activeSection === "posts" && <PublishSection cfg={cfg} setNotice={setNotice} />}
      </div>
    </div>
  );
}

/* ─── Events Section ─────────────────────────────────────────────────────── */
function EventsSection({ cfg }) {
  const [events, setEvents] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    api.get("/api/events/my-field", cfg).then((r) => setEvents(r.data)).catch(console.error);
    api.get("/api/events/my-publish-requests", cfg).then((r) => setMyRequests(r.data)).catch(console.error);
  }, [cfg]);

  useEffect(load, [load]);

  const getMyRequestStatus = (eventId) => {
    const req = myRequests.find((r) => r.eventId === eventId);
    return req ? req.status : null;
  };

  const handleRequestPublish = async (eventId) => {
    setError("");
    try {
      await api.post(`/api/events/${eventId}/publish-requests`, {}, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit request");
    }
  };

  return (
    <div>
      <div className="editor-section-header">
        <h2>Events in Your Field</h2>
        <p>These events are open for editors in your field of expertise. Request permission to publish live news updates.</p>
      </div>
      {error && <div className="admin-error">{error}</div>}
      {events.length === 0 ? (
        <div className="event-empty-state"><p>No events are currently available for your field.</p></div>
      ) : (
        <div className="event-grid">
          {events.map((ev) => {
            const reqStatus = getMyRequestStatus(ev.id);
            const isExpanded = expandedId === ev.id;
            return (
              <div key={ev.id} className={`event-card${isExpanded ? " expanded" : ""}`}>
                <div className="event-card-header">
                  <span className="event-field-badge">{ev.field?.name || "—"}</span>
                  <span className="event-status-badge" style={{ background: STATUS_COLORS[ev.status] + "22", color: STATUS_COLORS[ev.status], border: `1px solid ${STATUS_COLORS[ev.status]}66` }}>
                    {STATUS_LABELS[ev.status] || ev.status}
                  </span>
                </div>
                <h3 className="event-card-title" onClick={() => setExpandedId(isExpanded ? null : ev.id)} style={{ cursor: "pointer" }}>
                  {ev.title}
                </h3>
                {isExpanded && <p className="event-card-desc">{ev.description || "No description."}</p>}
                <div className="event-card-footer">
                  <div className="editor-event-request-area">
                    {reqStatus === null && (
                      <button className="admin-btn small primary" onClick={() => handleRequestPublish(ev.id)}>
                        Request to Publish
                      </button>
                    )}
                    {reqStatus === "PENDING" && (
                      <span className="publish-req-status pending">Request Pending Approval</span>
                    )}
                    {reqStatus === "APPROVED" && (
                      <span className="publish-req-status approved">✓ Approved — You can publish!</span>
                    )}
                    {reqStatus === "REJECTED" && (
                      <span className="publish-req-status rejected">✗ Request Rejected</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── My Requests Section ────────────────────────────────────────────────── */
function MyRequestsSection({ cfg }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    api.get("/api/events/my-publish-requests", cfg).then((r) => setRequests(r.data)).catch(console.error);
  }, [cfg]);

  return (
    <div>
      <div className="editor-section-header">
        <h2>My Publish Requests</h2>
        <p>Track the status of your requests to publish at live events.</p>
      </div>
      {requests.length === 0 ? (
        <div className="event-empty-state"><p>You haven't submitted any publish requests yet.</p></div>
      ) : (
        <div className="publish-requests-list">
          {requests.map((req) => (
            <div key={req.id} className={`publish-req-card ${req.status.toLowerCase()}`}>
              <div className="publish-req-info">
                <strong>{req.eventTitle}</strong>
                <div className="publish-req-meta">
                  Submitted: {new Date(req.requestedAt).toLocaleString()}
                  {req.reviewedAt && ` · Reviewed: ${new Date(req.reviewedAt).toLocaleString()}`}
                </div>
              </div>
              <span className={`publish-req-status ${req.status.toLowerCase()}`}>{req.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Publish Section ────────────────────────────────────────────────────── */
function PublishSection({ cfg, setNotice }) {
  const [approvedEvents, setApprovedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [form, setForm] = useState({ headline: "", content: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recentPosts, setRecentPosts] = useState([]);

  const loadApproved = useCallback(() => {
    api.get("/api/events/my-publish-requests", cfg).then((r) => {
      const approved = r.data.filter((req) => req.status === "APPROVED");
      setApprovedEvents(approved);
      if (approved.length > 0) setSelectedEventId(String(approved[0].eventId));
    }).catch(console.error);
  }, [loadApproved]);

  useEffect(loadApproved, [loadApproved]);

  useEffect(() => {
    if (selectedEventId) {
      api.get("/api/live-news", { ...cfg, params: { eventId: selectedEventId } })
        .then((r) => setRecentPosts(r.data.slice(0, 5)))
        .catch(console.error);
    }
  }, [selectedEventId]);

  const handlePublish = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.post("/api/live-news", { eventId: Number(selectedEventId), ...form }, cfg);
      setForm({ headline: "", content: "" });
      setSuccess("Live news published successfully!");
      setNotice("Live news post published!");
      api.get("/api/live-news", { ...cfg, params: { eventId: selectedEventId } })
        .then((r) => setRecentPosts(r.data.slice(0, 5)))
        .catch(console.error);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to publish news");
    }
  };

  if (approvedEvents.length === 0) {
    return (
      <div>
        <div className="editor-section-header">
          <h2>Publish Live News</h2>
          <p>You need an approved publish request before you can post live news.</p>
        </div>
        <div className="event-empty-state">
          <p>No approved events found. Go to <strong>My Field Events</strong> and request access to an event.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="editor-section-header">
        <h2>Publish Live News</h2>
        <p>You are approved to publish for the selected event. Write your headline and content below.</p>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      <div className="publish-composer">
        <div className="publish-composer-header">
          <label>Publishing to:</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="publish-event-select"
          >
            {approvedEvents.map((req) => (
              <option key={req.eventId} value={req.eventId}>{req.eventTitle}</option>
            ))}
          </select>
        </div>

        <form onSubmit={handlePublish} className="publish-form">
          <input
            className="publish-headline-input"
            placeholder="Breaking: Enter your headline here..."
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
            required
          />
          <textarea
            className="publish-content-input"
            placeholder="Write your live news content. Be accurate and timely..."
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={6}
            required
          />
          <button className="admin-btn primary" type="submit">⚡ Publish Now</button>
        </form>
      </div>

      {recentPosts.length > 0 && (
        <div className="recent-posts-preview">
          <h3>Recent Posts for This Event</h3>
          {recentPosts.map((p) => (
            <div key={p.id} className="live-post-card compact">
              <div className="live-post-headline">{p.headline}</div>
              <div className="live-post-meta">{new Date(p.publishedAt).toLocaleString()} · by {p.authorName || p.authorEmail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}