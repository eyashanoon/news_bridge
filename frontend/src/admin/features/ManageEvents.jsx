import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, authConfig } from "../../api";
import ChannelOnboardingModal from "../../components/ChannelOnboardingModal";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { hasRole } from "../utils/roles";
import { resolveAvatar, displayNameFromEmail } from "../utils/avatars";
import {
  ADMIN_ROLES,
  REGISTERED_ROLE_OPTIONS,
  EDITOR_ROLE_OPTIONS,
  USER_STATUSES,
} from "../constants/roles";

export function ManageEvents({ session }) {
  const [events, setEvents] = useState([]);
  const [fieldsData, setFieldsData] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", fieldIds: [], status: "DRAFT" });
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useConfirmDialog();
  const nav = useNavigate();
  const cfg = authConfig(session.token);

  const load = useCallback(() => {
    api.get("/api/events", cfg).then((r) => setEvents(r.data)).catch(console.error);
    api.get("/api/fields", cfg).then((r) => setFieldsData(r.data)).catch(console.error);
  }, [session.token]);

  useEffect(load, [load]);

  const toggleField = (fieldId) => {
    setForm((prev) => {
      const ids = prev.fieldIds;
      return {
        ...prev,
        fieldIds: ids.includes(fieldId)
          ? ids.filter((id) => id !== fieldId)
          : [...ids, fieldId],
      };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const numericFieldIds = form.fieldIds.map(Number);
      await api.post("/api/events", {
        ...form,
        fieldIds: numericFieldIds,
        fieldId: numericFieldIds.length > 0 ? numericFieldIds[0] : null,
      }, cfg);
      setForm({ title: "", description: "", fieldIds: [], status: "DRAFT" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create event");
    }
  };

  const handleStatusChange = async (ev, newStatus) => {
    try {
      // Send fieldIds when changing to EDITOR_VISIBLE or PUBLIC so the topic gets all fields
      const body = { status: newStatus };
      if (ev.fieldIds && ev.fieldIds.length > 0) {
        body.fieldIds = ev.fieldIds;
      }
      await api.patch(`/api/events/${ev.id}/status`, body, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this event and all its live news? This cannot be undone.", "Delete Event");
    if (!ok) return;
    try {
      await api.delete(`/api/events/${id}`, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete event");
    }
  };

  const handleDeleteAllTopics = async () => {
    // First, preview how many topics exist on the backend so the admin
    // knows what they're about to wipe. The topics table is normally
    // auto-populated from events, so this is safe — new events will
    // re-create the topics on the next status change.
    let count = 0;
    try {
      const preview = await api.get(`/api/topics`, cfg);
      count = Array.isArray(preview.data) ? preview.data.length : 0;
    } catch (e) {
      // If preview fails, still let the user proceed with a generic message
    }
    const msg = count > 0
      ? `This will delete ALL ${count} trending topic(s) and their posts. The admin events list will remain, and topics will be re-created automatically the next time you save a PUBLIC or EDITOR_VISIBLE event. This cannot be undone.`
      : `There are no topics to delete.`;
    const ok = await askConfirm(msg, "Delete All Topics");
    if (!ok) return;
    try {
      const res = await api.delete(`/api/topics/all?confirm=true`, cfg);
      setError("");
      // Refresh the event list since the underlying topic data changed
      load();
      alert(res.data?.message || "All topics deleted successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete all topics");
    }
  };

  const STATUS_LABELS = { DRAFT: "Draft", EDITOR_VISIBLE: "Open to Editors", PUBLIC: "Public" };
  const STATUS_COLORS = { DRAFT: "#64748b", EDITOR_VISIBLE: "#f59e0b", PUBLIC: "#22c55e" };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Live Event Management</h2>
        <p>Create and manage live news events. Click an event to view its details, manage publish requests, and live posts.</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="action-cell" style={{ flexWrap: "wrap", gap: 8 }}>
        <button className="admin-btn primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Event"}
        </button>
        <button
          className="admin-btn danger"
          onClick={handleDeleteAllTopics}
          title="Wipe every trending topic (and their posts). Topics are auto-recreated when you save a PUBLIC or EDITOR_VISIBLE event."
          style={{ background: "linear-gradient(135deg,#7f1d1d,#991b1b)", borderColor: "#7f1d1d" }}
        >
          🗑 Delete All Topics
        </button>
      </div>

      {showCreate && (
        <form className="admin-form" onSubmit={handleCreate}>
          <input
            placeholder="Event title (e.g. Russia-Ukraine Conflict 2026)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Brief description of the event..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
          <label style={{ fontSize: "0.82rem", color: "#94a3b8", fontWeight: 600 }}>Fields (select one or more):</label>
          <div className="role-picker">
            {fieldsData.map((f) => (
              <label key={f.id} className={`role-chip ${form.fieldIds.includes(String(f.id)) ? "selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={form.fieldIds.includes(String(f.id))}
                  onChange={() => toggleField(String(f.id))}
                />
                {f.name}
              </label>
            ))}
          </div>
          <select
            className="admin-select"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="DRAFT">Draft (admin-only)</option>
            <option value="EDITOR_VISIBLE">Open to Editors</option>
            <option value="PUBLIC">Public (all users)</option>
          </select>
          <button className="admin-btn primary" type="submit">Create Event</button>
        </form>
      )}

      <div className="event-grid">
        {events.map((ev) => {
          // Resolve every assigned field (from ev.fieldIds) to its name in
          // fieldsData so the card shows the full set, not just the single
          // primary field. Fall back to ev.field if fieldIds is empty.
          const assignedFields = (ev.fieldIds && ev.fieldIds.length > 0
            ? ev.fieldIds
                .map((fid) => fieldsData.find((f) => String(f.id) === String(fid)))
                .filter(Boolean)
            : (ev.field ? [ev.field] : []));
          return (
          <div key={ev.id} className="event-card" onClick={() => nav(`/admin/topics/${ev.id}`)}>
            <div className="event-card-header">
              <div className="event-field-badges">
                {assignedFields.length > 0
                  ? assignedFields.map((f) => (
                      <span key={f.id} className="event-field-badge">{f.name}</span>
                    ))
                  : <span className="event-field-badge">No Field</span>}
              </div>
              <span className="event-status-badge" style={{ background: STATUS_COLORS[ev.status] + "22", color: STATUS_COLORS[ev.status], border: `1px solid ${STATUS_COLORS[ev.status]}66` }}>
                {STATUS_LABELS[ev.status] || ev.status}
              </span>
            </div>
            <h3 className="event-card-title">{ev.title}</h3>
            <p className="event-card-desc">{ev.description || "No description provided."}</p>
            <div className="event-card-footer">
              <span className="event-card-meta">Created: {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : "-"}</span>
              <div className="event-card-actions" onClick={(e) => e.stopPropagation()}>
                {ev.status !== "EDITOR_VISIBLE" && (
                  <button className="admin-btn small" onClick={() => handleStatusChange(ev, "EDITOR_VISIBLE")}>Open Editors</button>
                )}
                {ev.status !== "PUBLIC" && (
                  <button className="admin-btn small primary" onClick={() => handleStatusChange(ev, "PUBLIC")}>Go Public</button>
                )}
                {ev.status !== "DRAFT" && (
                  <button className="admin-btn small" onClick={() => handleStatusChange(ev, "DRAFT")}>Revert Draft</button>
                )}
                <button className="admin-btn small danger" onClick={() => handleDelete(ev.id)}>Delete</button>
              </div>
            </div>
          </div>
          );
        })}
        {events.length === 0 && (
          <div className="event-empty-state">
            <p>No events yet. Create the first live news event to get started.</p>
          </div>
        )}
      </div>
      {Dialog}
    </div>
  );
}
