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

export function ManageFields({ session }) {
  const [fields, setFields] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", parentId: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", parentId: "" });
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useConfirmDialog();
  const cfg = authConfig(session.token);

  // Load flat fields for parent dropdown; also load hierarchical for display
  const load = useCallback(() => {
    api.get("/api/fields", cfg).then((r) => setFields(r.data)).catch(console.error);
  }, [session.token]);

  useEffect(load, [load]);

  // Get only general fields (no parent) for the parent dropdown
  const generalFields = fields.filter((f) => !f.parentId);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { name: form.name, description: form.description };
      if (form.parentId) body.parentId = Number(form.parentId);
      await api.post("/api/fields", body, cfg);
      setForm({ name: "", description: "", parentId: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create field");
    }
  };

  const handleUpdate = async (id) => {
    try {
      const body = { name: editForm.name, description: editForm.description };
      if (editForm.parentId) body.parentId = Number(editForm.parentId);
      else body.parentId = null;
      await api.put(`/api/fields/${id}`, body, cfg);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update field");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this category field? This will also remove all sub-fields under it.");
    if (!ok) return;
    try {
      await api.delete(`/api/fields/${id}`, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete field");
    }
  };

  const getParentName = (parentId) => {
    if (!parentId) return "";
    const p = fields.find((f) => f.id === parentId);
    return p ? p.name : "";
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Manage Category Fields</h2>
        <p>Create general categories and specific sub-fields. Editors can pick up to 2 specific sub-fields under one general category.</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <button className="admin-btn primary" onClick={() => setShowCreate(!showCreate)}>
        {showCreate ? "Cancel" : "+ New Field"}
      </button>

      {showCreate && (
        <form className="admin-form" onSubmit={handleCreate}>
          <input placeholder="Field name (e.g. Football, Artificial Intelligence)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="admin-select" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">— General Category (no parent) —</option>
            {generalFields.map((gf) => (
              <option key={gf.id} value={gf.id}>{gf.name}</option>
            ))}
          </select>
          <p className="admin-form-hint">Select a parent to create a sub-field, or leave empty for a general category.</p>
          <button className="admin-btn primary" type="submit">Create Field</button>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>ID</th><th>Name</th><th>Parent</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id} className={!f.parentId ? "admin-fields-row--parent" : undefined}>
                <td>{f.id}</td>
                <td style={{ fontWeight: !f.parentId ? 600 : 400, paddingLeft: !f.parentId ? "12px" : "24px" }}>
                  {editingId === f.id
                    ? <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    : <>{!f.parentId ? "📁 " : "• "}{f.name}</>}
                </td>
                <td className="admin-fields-parent-cell">
                  {editingId === f.id ? (
                    <select className="admin-select" value={editForm.parentId} onChange={(e) => setEditForm({ ...editForm, parentId: e.target.value })}>
                      <option value="">— General —</option>
                      {generalFields.filter((gf) => gf.id !== f.id).map((gf) => (
                        <option key={gf.id} value={gf.id}>{gf.name}</option>
                      ))}
                    </select>
                  ) : (
                    getParentName(f.parentId) || <span className="admin-fields-general-label">General</span>
                  )}
                </td>
                <td>
                  {editingId === f.id
                    ? <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                    : f.description || "-"}
                </td>
                <td className="action-cell">
                  {editingId === f.id ? (
                    <>
                      <button className="admin-btn small primary" onClick={() => handleUpdate(f.id)}>Save</button>
                      <button className="admin-btn small" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="admin-btn small" onClick={() => { setEditingId(f.id); setEditForm({ name: f.name, description: f.description || "", parentId: f.parentId || "" }); }}>Edit</button>
                      <button className="admin-btn small danger" onClick={() => handleDelete(f.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {fields.length === 0 && <tr><td colSpan="5" className="empty-row">No fields configured</td></tr>}
          </tbody>
        </table>
      </div>
      {Dialog}
    </div>
  );
}
