import { useState, useEffect, useCallback } from "react";
import { api, authConfig } from "../../api";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { hasRole } from "../utils/roles";
import { resolveAvatar } from "../utils/avatars";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function EditorRequests({ session }) {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [viewing, setViewing] = useState(null);
  const cfg = authConfig(session.token);
  const canApprove = hasRole(session, "APPROVE_EDITOR_REQUESTS");
  const { askConfirm, Dialog } = useConfirmDialog();

  const load = useCallback(() => {
    api.get("/api/editor-requests", cfg).then((r) => setRequests(r.data)).catch(console.error);
  }, [session.token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const handleApprove = async (id) => {
    const ok = await askConfirm("Approve this editor application? The applicant will receive an activation email.");
    if (!ok) return;
    try {
      await api.post(`/api/editor-requests/${id}/approve`, {}, cfg);
      setViewing(null);
      load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to approve editor request.");
    }
  };

  const handleReject = async (id) => {
    const ok = await askConfirm("Reject this editor request?");
    if (!ok) return;
    try {
      await api.post(`/api/editor-requests/${id}/reject`, {}, cfg);
      setViewing(null);
      load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to reject editor request.");
    }
  };

  const filtered = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Editor Requests</h2>
        <p>Review and process editor applications — click a row to view full submission details</p>
      </div>
      <div className="admin-tabs">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} className={`admin-tab ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {s} ({s === "ALL" ? requests.length : requests.filter((r) => r.status === s).length})
          </button>
        ))}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-clickable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Photo</th>
              <th>User</th>
              <th>Fields</th>
              <th>Status</th>
              {canApprove && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="admin-table-row-clickable" onClick={() => setViewing(r)}>
                <td>{r.id}</td>
                <td><img className="avatar-circle" src={resolveAvatar(r.profilePicture, "editor")} alt="" /></td>
                <td>
                  <div>{r.userEmail}</div>
                  <div className="admin-cell-muted">User #{r.userId}</div>
                </td>
                <td>{(r.fields || []).map((f) => f.name).join(", ") || "—"}</td>
                <td><span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                {canApprove && (
                  <td className="action-cell" onClick={(e) => e.stopPropagation()}>
                    {r.status === "PENDING" && (
                      <>
                        <button type="button" className="admin-btn small primary" onClick={() => handleApprove(r.id)}>Approve</button>
                        <button type="button" className="admin-btn small danger" onClick={() => handleReject(r.id)}>Reject</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={canApprove ? 6 : 5} className="empty-row">No requests</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewing(null)}>
          <div className="profile-modal-card admin-profile-card editor-request-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Editor Application #{viewing.id}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setViewing(null)}>×</button>
            </div>
            <div className="profile-modal-body">
              <div className="editor-request-detail-layout">
                <img className="profile-avatar-lg" src={resolveAvatar(viewing.profilePicture, "editor")} alt="" />
                <div className="profile-lines">
                  <p><strong>Applicant:</strong> {viewing.userEmail}</p>
                  <p><strong>User ID:</strong> {viewing.userId}</p>
                  <p><strong>Status:</strong> <span className={`status-badge ${viewing.status?.toLowerCase()}`}>{viewing.status}</span></p>
                  <p><strong>Phone:</strong> {viewing.phone || "—"}</p>
                  <p><strong>Submitted:</strong> {formatDate(viewing.createdAt)}</p>
                  <p><strong>Last updated:</strong> {formatDate(viewing.updatedAt)}</p>
                </div>
              </div>

              <div className="editor-request-detail-section">
                <h4>Fields of Interest</h4>
                {(viewing.fields || []).length > 0 ? (
                  <div className="role-tags">
                    {viewing.fields.map((f) => <span key={f.id} className="role-tag">{f.name}</span>)}
                  </div>
                ) : (
                  <p className="admin-empty-hint">No fields selected</p>
                )}
              </div>

              <div className="editor-request-detail-section">
                <h4>Experience / Statement</h4>
                <p className="editor-request-detail-text">{viewing.experience || "—"}</p>
              </div>

              <div className="editor-request-detail-section">
                <h4>References / Prior Work</h4>
                <p className="editor-request-detail-text">{viewing.references || "—"}</p>
              </div>

              {(viewing.attachments || []).length > 0 && (
                <div className="editor-request-detail-section">
                  <h4>Attachments</h4>
                  <div className="profile-attachments">
                    {viewing.attachments.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        Attachment {idx + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {canApprove && viewing.status === "PENDING" && (
                <div className="editor-request-detail-actions">
                  <button type="button" className="admin-btn primary" onClick={() => handleApprove(viewing.id)}>Approve Application</button>
                  <button type="button" className="admin-btn danger" onClick={() => handleReject(viewing.id)}>Reject</button>
                </div>
              )}

              {viewing.status === "APPROVED" && (
                <p className="admin-empty-hint">Applicant was emailed an activation code to verify their editor account.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {Dialog}
    </div>
  );
}
