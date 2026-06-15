import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { Modal } from "../../design-system/Modal";
import { EndpointFilterSummary } from "./EndpointFilterSummary";
import { EndpointFilters } from "./EndpointFilters";
import { EndpointGroupView } from "./EndpointGroupView";
import { EndpointTable } from "./EndpointTable";
import { filterEndpoints, groupEndpointsBySegment } from "./endpointUtils";
import {
  bulkEndpointAction,
  createEndpoint,
  createRoot,
  deleteEndpoint,
  getEndpointDeleteImpact,
  listEndpoints,
  listRoots,
  updateEndpoint,
  updateEndpointStatus,
} from "../../services/sourcesService";
import {
  canCreateEndpoints,
  canDeleteEndpoints,
  canManageEndpoints,
  canUpdateEndpoints,
} from "./sourcesPermissions";

const DEFAULT_FILTERS = {
  search: "",
  rootNameSearch: "",
  rootId: "",
  status: "",
  lastCrawl: "",
  groupSegment: 0,
};

export function EndpointsTab({ session }) {
  const token = session.token;
  const [endpoints, setEndpoints] = useState([]);
  const [roots, setRoots] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ url: "", rootId: "", crawlScore: "1", notes: "" });
  const [editRow, setEditRow] = useState(null);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkRootId, setBulkRootId] = useState("");
  const [bulkPriority, setBulkPriority] = useState("1");

  const { askConfirm, askTypedConfirm, Dialog } = useConfirmDialog();
  const canCreate = canCreateEndpoints(session);
  const canUpdate = canUpdateEndpoints(session);
  const canDelete = canDeleteEndpoints(session);
  const canManage = canManageEndpoints(session);

  const rootsById = useMemo(() => Object.fromEntries(roots.map((r) => [r.id, r])), [roots]);

  const loadRoots = useCallback(async () => {
    try {
      setRoots(await listRoots(token));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load roots");
    }
  }, [token]);

  const load = useCallback(async () => {
    try {
      const data = await listEndpoints(token, {
        rootId: filters.rootId || undefined,
        search: filters.search || undefined,
        status: filters.status || undefined,
      });
      setEndpoints(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load endpoints");
    }
  }, [token, filters.rootId, filters.search, filters.status]);

  useEffect(() => { loadRoots(); }, [loadRoots]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => filterEndpoints(endpoints, filters, rootsById),
    [endpoints, filters, rootsById]
  );

  const groups = useMemo(() => {
    if (!filters.groupSegment) return null;
    return groupEndpointsBySegment(filtered, filters.groupSegment, rootsById);
  }, [filtered, filters.groupSegment, rootsById]);

  const extractDomain = (url) => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canCreate) return;
    setError("");
    try {
      await createEndpoint(token, {
        url: form.url,
        rootId: form.rootId ? Number(form.rootId) : null,
        crawlScore: form.crawlScore ? Number(form.crawlScore) : null,
        notes: form.notes || null,
      });
      setForm({ url: "", rootId: "", crawlScore: "1", notes: "" });
      load();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create endpoint";
      if (msg.includes("Root for domain") && !form.rootId) {
        const domain = extractDomain(form.url);
        if (domain && await askConfirm(`Root for '${domain}' does not exist. Add it now?`)) {
          try {
            await createRoot(token, { name: domain, baseUrl: `https://${domain}` });
            await createEndpoint(token, { url: form.url, rootId: null, crawlScore: Number(form.crawlScore) || 1, notes: form.notes });
            setForm({ url: "", rootId: "", crawlScore: "1", notes: "" });
            loadRoots();
            load();
            return;
          } catch (secondErr) {
            setError(secondErr.response?.data?.message || "Failed to auto-create root");
            return;
          }
        }
      }
      setError(msg);
    }
  };

  const handleSaveEdit = async () => {
    if (!editRow || !canUpdate) return;
    setError("");
    try {
      await updateEndpoint(token, editRow.id, {
        url: editRow.url,
        rootId: editRow.rootId ? Number(editRow.rootId) : null,
        crawlScore: editRow.crawlScore != null ? Number(editRow.crawlScore) : null,
        notes: editRow.notes || null,
      });
      setEditRow(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update endpoint");
    }
  };

  const handleStatus = async (row, status) => {
    if (!canUpdate) return;
    try {
      await updateEndpointStatus(token, row.id, status);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (row) => {
    if (!canDelete) return;
    let impact = null;
    try {
      impact = await getEndpointDeleteImpact(token, row.id);
    } catch {
      /* ignore */
    }

    const warnings = [];
    if (impact?.articleCount > 0) warnings.push(`${impact.articleCount} article(s) collected`);
    if (impact?.hasHistoricalCrawlData) warnings.push(`${impact.totalCrawls} crawl run(s) and ${impact.cacheEndpointCount} cache record(s)`);

    const ok = await askConfirm(
      warnings.length
        ? `Delete endpoint '${row.url}'?\n\nWarning: ${warnings.join("; ")}.`
        : `Delete endpoint '${row.url}'?`
    );
    if (!ok) return;

    const preferSoft = impact?.articleCount > 0 || impact?.hasHistoricalCrawlData;
    if (preferSoft) {
      const softOk = await askConfirm("Use soft delete (deactivate) instead of permanent removal?");
      if (softOk) {
        await updateEndpointStatus(token, row.id, "SUSPENDED");
        load();
        return;
      }
    }

    const typedOk = await askTypedConfirm("Permanent hard delete cannot be undone.", "DELETE");
    if (!typedOk) return;

    try {
      await deleteEndpoint(token, row.id, true);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete endpoint");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const toggleSelectAll = (val, subset) => {
    const pool = subset || filtered;
    const ids = pool.map((e) => e.id);
    setSelectedIds((prev) => {
      if (!val) return prev.filter((id) => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

  const runBulk = async () => {
    if (!canManage || !selectedIds.length || !bulkAction) return;
    const ok = await askConfirm(`Apply "${bulkAction}" to ${selectedIds.length} endpoint(s)?`);
    if (!ok) return;

    try {
      const body = {
        endpointIds: selectedIds,
        action: bulkAction,
      };
      if (bulkAction === "ASSIGN_ROOT") body.rootId = Number(bulkRootId);
      if (bulkAction === "CHANGE_PRIORITY") body.crawlPriority = Number(bulkPriority);
      if (bulkAction === "DELETE") {
        const hardOk = await askConfirm("Hard delete selected endpoints?");
        body.hardDelete = hardOk;
      }
      await bulkEndpointAction(token, body);
      setSelectedIds([]);
      setBulkAction("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Bulk action failed");
    }
  };

  return (
    <div className="sources-endpoints-tab">
      {error && <div className="admin-error">{error}</div>}

      {canCreate && (
        <form className="admin-form" onSubmit={handleCreate}>
          <input placeholder="Endpoint URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required />
          <select value={form.rootId} onChange={(e) => setForm({ ...form, rootId: e.target.value })}>
            <option value="">Auto-detect root</option>
            {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input type="number" step="0.1" placeholder="Crawl priority" value={form.crawlScore} onChange={(e) => setForm({ ...form, crawlScore: e.target.value })} />
          <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button className="admin-btn primary" type="submit">Add Endpoint</button>
        </form>
      )}

      <EndpointFilters filters={filters} onChange={setFilters} roots={roots} />

      <EndpointFilterSummary
        totalCount={endpoints.length}
        filteredCount={filtered.length}
        selectedCount={selectedIds.length}
        filters={filters}
        variant="endpoints"
      />

      {canManage && selectedIds.length > 0 && (
        <div className="admin-filters-row endpoint-bulk-bar">
          <span>{selectedIds.length} selected</span>
          <select className="admin-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
            <option value="">Bulk action…</option>
            <option value="ACTIVATE">Activate</option>
            <option value="DEACTIVATE">Deactivate</option>
            <option value="CHANGE_PRIORITY">Change priority</option>
            <option value="ASSIGN_ROOT">Assign to root</option>
            <option value="DELETE">Delete</option>
          </select>
          {bulkAction === "ASSIGN_ROOT" && (
            <select className="admin-select" value={bulkRootId} onChange={(e) => setBulkRootId(e.target.value)}>
              <option value="">Select root</option>
              {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {bulkAction === "CHANGE_PRIORITY" && (
            <input className="admin-select" type="number" step="0.1" value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)} />
          )}
          <button type="button" className="admin-btn small primary" disabled={!bulkAction} onClick={runBulk}>Apply</button>
          <button type="button" className="admin-btn small" onClick={() => setSelectedIds([])}>Clear</button>
        </div>
      )}

      {groups ? (
        <EndpointGroupView
          groups={groups}
          roots={roots}
          selectedIds={selectedIds}
          highlightSegments={filters.groupSegment}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onToggleGroupSelect={toggleGroupSelect}
          onEdit={canUpdate ? (row) => setEditRow({ ...row, rootId: String(row.rootId || "") }) : undefined}
          onStatusChange={canUpdate ? handleStatus : undefined}
          onDelete={canDelete ? handleDelete : undefined}
          selectable={canManage}
          editable={canUpdate || canDelete}
        />
      ) : (
        <div className="endpoint-table-panel">
          <EndpointTable
            endpoints={filtered}
            roots={roots}
            selectedIds={selectedIds}
            highlightSegments={0}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onEdit={canUpdate ? (row) => setEditRow({ ...row, rootId: String(row.rootId || "") }) : undefined}
            onStatusChange={canUpdate ? handleStatus : undefined}
            onDelete={canDelete ? handleDelete : undefined}
            selectable={canManage}
            editable={canUpdate || canDelete}
          />
        </div>
      )}

      <Modal open={!!editRow} onClose={() => setEditRow(null)}>
          <h3>Edit endpoint</h3>
          {editRow && (
          <div className="admin-form" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <input value={editRow.url} onChange={(e) => setEditRow({ ...editRow, url: e.target.value })} />
            <select value={editRow.rootId} onChange={(e) => setEditRow({ ...editRow, rootId: e.target.value })}>
              <option value="">Auto-detect</option>
              {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input type="number" step="0.1" value={editRow.crawlScore ?? 1} onChange={(e) => setEditRow({ ...editRow, crawlScore: e.target.value })} placeholder="Crawl priority" />
            <textarea value={editRow.notes || ""} onChange={(e) => setEditRow({ ...editRow, notes: e.target.value })} placeholder="Notes" rows={3} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="admin-btn primary" onClick={handleSaveEdit}>Save</button>
              <button type="button" className="admin-btn" onClick={() => setEditRow(null)}>Cancel</button>
            </div>
          </div>
          )}
      </Modal>

      {Dialog}
    </div>
  );
}
