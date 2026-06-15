import { useState, useEffect, useCallback } from "react";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { VerificationPopup } from "../VerificationPopup";
import { trustScoreColor } from "../TrustWidgets";
import { useDiscoverySessionOptional } from "./DiscoverySessionManager";
import {
  createRoot,
  deleteRoot,
  listRoots,
  updateRoot,
  updateRootStatus,
  verifyRoot,
} from "../../services/sourcesService";
import { canManageEndpoints } from "./sourcesPermissions";

export function RootsTab({ session, onNavigateDiscovery }) {
  const [roots, setRoots] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ name: "", baseUrl: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState({ name: "", baseUrl: "" });
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState({});
  const [trustResults, setTrustResults] = useState({});
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupRoot, setPopupRoot] = useState(null);
  const [popupTrust, setPopupTrust] = useState(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupError, setPopupError] = useState(null);

  const { askConfirm, askTypedConfirm, Dialog } = useConfirmDialog();
  const discovery = useDiscoverySessionOptional();
  const beginDiscovery = discovery?.beginDiscovery;
  const discoveryLoading = discovery?.loading;
  const discoveringId = discovery?.rootId;
  const canManage = canManageEndpoints(session);
  const token = session.token;

  const load = useCallback(async () => {
    try {
      const data = await listRoots(token, { search: searchText, status: statusFilter });
      setRoots(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load roots");
    }
  }, [token, searchText, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openPopup = (root, trust, loading, err) => {
    setPopupRoot(root);
    setPopupTrust(trust);
    setPopupLoading(loading);
    setPopupError(err);
    setPopupOpen(true);
  };

  const closePopup = () => {
    setPopupOpen(false);
    setPopupLoading(false);
    setPopupError(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setError("");
    try {
      await createRoot(token, form);
      setForm({ name: "", baseUrl: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create root");
    }
  };

  const handleUpdate = async (id) => {
    if (!canManage) return;
    setError("");
    try {
      await updateRoot(token, id, editingForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update root");
    }
  };

  const handleStatus = async (id, status) => {
    if (!canManage) return;
    try {
      await updateRootStatus(token, id, status);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id, name) => {
    if (!canManage) return;
    const ok = await askConfirm(`Delete root '${name}' and ALL linked endpoints/articles?`);
    if (!ok) return;
    const typedOk = await askTypedConfirm("This is a hard delete and cannot be undone.", "DELETE");
    if (!typedOk) return;
    try {
      await deleteRoot(token, id, true);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete root");
    }
  };

  const handleVerify = async (root) => {
    const id = root.id;
    setTrustResults((t) => { const next = { ...t }; delete next[id]; return next; });
    setVerifying((v) => ({ ...v, [id]: true }));
    openPopup(root, null, true, null);

    try {
      const data = await verifyRoot(token, id);
      const result = { ...data, _error: null };
      setTrustResults((t) => ({ ...t, [id]: result }));
      openPopup(root, result, false, null);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Verification failed";
      setTrustResults((t) => ({
        ...t,
        [id]: { found: false, _error: msg },
      }));
      openPopup(root, null, false, msg);
    } finally {
      setVerifying((v) => ({ ...v, [id]: false }));
    }
  };

  const handleDiscover = async (root) => {
    if (!canManage || !beginDiscovery) return;
    await beginDiscovery(root);
    onNavigateDiscovery?.();
  };

  return (
    <div className="sources-roots-tab">
      {error && <div className="admin-error">{error}</div>}

      {canManage && (
        <form className="admin-form" onSubmit={handleCreate}>
          <input placeholder="Root name (e.g., BBC News)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Base URL (https://example.com)" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} required />
          <button className="admin-btn primary" type="submit">Add Root</button>
        </form>
      )}

      <div className="admin-filters-row">
        <input className="admin-search" placeholder="Search by name or URL" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button type="button" className="admin-btn small" onClick={load}>Search</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Base URL</th><th>Status</th>
              <th>Verification</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roots.map((r) => {
              const trust = trustResults[r.id];
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    {editingId === r.id
                      ? <input value={editingForm.name} onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })} />
                      : r.name}
                  </td>
                  <td>
                    {editingId === r.id
                      ? <input value={editingForm.baseUrl} onChange={(e) => setEditingForm({ ...editingForm, baseUrl: e.target.value })} />
                      : r.baseUrl}
                  </td>
                  <td>
                    <span className={`status-badge ${(r.status || "").toLowerCase() === "active" ? "approved" : "rejected"}`}>
                      {r.status || "ACTIVE"}
                    </span>
                  </td>
                  <td className="trust-cell">
                    {trust?._error ? (
                      <div className="trust-error-wrap">
                        <span className="trust-error-msg" title={trust._error}>⚠ Failed</span>
                        <button type="button" className="admin-btn small" onClick={() => handleVerify(r)}>Retry</button>
                      </div>
                    ) : trust?.found ? (() => {
                      const c = trustScoreColor(trust.trustScore);
                      return (
                      <button
                        type="button"
                        className="verify-score-badge"
                        style={{ background: c.bg, borderColor: c.border }}
                        onClick={() => openPopup(r, trust, false, null)}
                        title="View verification report"
                      >
                        <span className="verify-score-pct" style={{ color: c.main }}>{trust.trustScore}%</span>
                        <span className="verify-score-label" style={{ color: c.main }}>trusted</span>
                      </button>
                      );
                    })() : (
                      <button
                        type="button"
                        className="admin-btn small"
                        disabled={!!verifying[r.id]}
                        onClick={() => handleVerify(r)}
                      >
                        {verifying[r.id] ? "Verifying…" : "Verify"}
                      </button>
                    )}
                  </td>
                  <td className="action-cell">
                    {canManage && (editingId === r.id ? (
                      <>
                        <button type="button" className="admin-btn small primary" onClick={() => handleUpdate(r.id)}>Save</button>
                        <button type="button" className="admin-btn small" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="admin-btn small" onClick={() => { setEditingId(r.id); setEditingForm({ name: r.name, baseUrl: r.baseUrl }); }}>Edit</button>
                        <button
                          type="button"
                          className="admin-btn small accent"
                          disabled={discoveryLoading && discoveringId === r.id}
                          onClick={() => handleDiscover(r)}
                        >
                          {discoveryLoading && discoveringId === r.id ? "Discovering…" : "Discover"}
                        </button>
                        <button type="button" className="admin-btn small" onClick={() => handleStatus(r.id, "SUSPENDED")}>Suspend</button>
                        <button type="button" className="admin-btn small" onClick={() => handleStatus(r.id, "ACTIVE")}>Activate</button>
                        <button type="button" className="admin-btn small danger" onClick={() => handleDelete(r.id, r.name)}>Hard Delete</button>
                      </>
                    ))}
                  </td>
                </tr>
              );
            })}
            {roots.length === 0 && <tr><td colSpan={6} className="empty-row">No roots found</td></tr>}
          </tbody>
        </table>
      </div>

      <VerificationPopup
        open={popupOpen}
        onClose={closePopup}
        root={popupRoot}
        trust={popupTrust}
        loading={popupLoading}
        error={popupError}
      />
      {Dialog}
    </div>
  );
}
