import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { AdminChartCard } from "../../design-system/AdminChartCard";
import { StatCard } from "../../design-system/StatCard";
import { BarChart, LineChart } from "../../analytics";
import { DataTable } from "../../data-display/DataTable";
import { FilterBar } from "../../data-display/FilterBar";
import { SearchInput } from "../../data-display/SearchInput";
import { TablePagination } from "../../data-display/TablePagination";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { resolveAvatar, displayNameFromEmail } from "../../utils/avatars";
import { EDITOR_ROLE_OPTIONS, USER_STATUSES } from "../../constants/roles";
import { ACTIVITY_LEVELS } from "../../constants/permissionGroups";
import {
  listEditorUsersPaged,
  updateEditorRoles,
  updateEditorStatus,
  deleteEditorUser,
  getEditorAnalytics,
} from "../../services/usersService";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function activityTone(level) {
  if (level === "HIGH") return "approved";
  if (level === "MEDIUM") return "pending";
  if (level === "LOW") return "default";
  return "rejected";
}

export function EditorsTab({ session, onError }) {
  const [data, setData] = useState({ items: [], total: 0, page: 0, size: 20, totalPages: 1 });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [sort, setSort] = useState("contributions");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [periodDays, setPeriodDays] = useState(30);
  const debouncedSearch = useDebouncedValue(search, 300);
  const [editingId, setEditingId] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [viewingUser, setViewingUser] = useState(null);
  const { askConfirm, Dialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listEditorUsersPaged(session.token, {
        search: debouncedSearch || undefined,
        status: status || undefined,
        activityLevel: activityLevel || undefined,
        sort,
        sortDir,
        page,
        size: 20,
      });
      setData(result);
      onError?.("");
    } catch (err) {
      onError?.(err.response?.data?.message || "Failed to load editors");
    } finally {
      setLoading(false);
    }
  }, [session.token, debouncedSearch, status, activityLevel, sort, sortDir, page, onError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setAnalyticsLoading(true);
    getEditorAnalytics(session.token, periodDays)
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [session.token, periodDays]);

  const toggleRole = (role) => {
    setEditRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const toggleSort = (key) => {
    if (sort === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const handleSaveRoles = async (id) => {
    try {
      await updateEditorRoles(session.token, id, editRoles);
      setEditingId(null);
      await load();
    } catch (err) {
      onError?.(err.response?.data?.message || "Failed to update editor roles");
    }
  };

  const handleSaveStatus = async (id) => {
    try {
      await updateEditorStatus(session.token, id, editStatus);
      setEditingStatusId(null);
      await load();
    } catch (err) {
      onError?.(err.response?.data?.message || "Failed to update editor status");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this editor account?");
    if (!ok) return;
    try {
      await deleteEditorUser(session.token, id);
      await load();
    } catch (err) {
      onError?.(err.response?.data?.message || "Failed to delete editor");
    }
  };

  const topPerformers = (analytics?.topPerformers || []).slice(0, 6).map((e) => ({
    label: (e.username || e.email || `Editor ${e.editorId}`).slice(0, 12),
    value: e.contributionCount || 0,
  }));

  const columns = [
    {
      key: "editor",
      header: "Editor",
      render: (u) => (
        <div className="admin-cell-user">
          <img className="avatar-circle" src={resolveAvatar(u.profilePicture, "editor")} alt="" />
          <div>
            <strong>{u.fullName || u.username || displayNameFromEmail(u.email)}</strong>
            <div className="admin-cell-muted">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) =>
        editingStatusId === u.id ? (
          <select className="admin-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
            {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <Badge tone={(u.status || "").toLowerCase() === "active" ? "active" : "suspended"}>
            {u.approvalStatus || u.status || "ACTIVE"}
          </Badge>
        ),
    },
    { key: "field", header: "Field", render: (u) => u.fieldName || "—" },
    {
      key: "contributions",
      header: (
        <button type="button" className="admin-sort-btn" onClick={() => toggleSort("contributions")}>
          Contributions {sort === "contributions" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      render: (u) => u.contributionCount ?? 0,
    },
    {
      key: "lastActivityAt",
      header: (
        <button type="button" className="admin-sort-btn" onClick={() => toggleSort("lastActivityAt")}>
          Last Activity {sort === "lastActivityAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      render: (u) => (
        <div>
          <div>{formatDate(u.lastActivityAt)}</div>
          <Badge tone={activityTone(u.activityLevel)}>{u.activityLevel || "INACTIVE"}</Badge>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "action-cell",
      render: (u) =>
        editingId === u.id ? (
          <>
            <Button size="small" variant="primary" onClick={() => handleSaveRoles(u.id)}>Save</Button>
            <Button size="small" onClick={() => setEditingId(null)}>Cancel</Button>
          </>
        ) : editingStatusId === u.id ? (
          <>
            <Button size="small" variant="primary" onClick={() => handleSaveStatus(u.id)}>Save</Button>
            <Button size="small" onClick={() => setEditingStatusId(null)}>Cancel</Button>
          </>
        ) : (
          <>
            <Button size="small" onClick={() => { setEditingId(u.id); setEditRoles([...(u.roles || [])]); }}>Edit Roles</Button>
            <Button size="small" onClick={() => { setEditingStatusId(u.id); setEditStatus(u.status || "ACTIVE"); }}>Edit Status</Button>
            <Button size="small" onClick={() => setViewingUser(u)}>View</Button>
            <Button size="small" variant="danger" onClick={() => handleDelete(u.id)}>Delete</Button>
          </>
        ),
    },
  ];

  return (
    <div className="admin-mgmt-panel">
      <div className="admin-analytics-toolbar">
        <Link to="/admin/editor-requests" className="admin-link-btn">View Editor Applications →</Link>
        <label>
          Analytics period:
          <select className="admin-select" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </div>

      {analyticsLoading ? (
        <div className="admin-loading-state">Loading editor analytics…</div>
      ) : analytics && (
        <>
          <div className="admin-stats-grid admin-stats-grid-compact">
            <StatCard label="Total Editors" value={analytics.totalEditors ?? 0} color="#0ea5e9" />
            <StatCard label="Active" value={analytics.activeEditors ?? 0} color="#22c55e" />
            <StatCard label="Suspended" value={analytics.suspendedEditors ?? 0} color="#ef4444" />
            <StatCard label="Approval Rate" value={`${Math.round((analytics.approvalRate ?? 0) * 100)}%`} color="#8b5cf6" small />
          </div>
          <div className="admin-analytics-grid admin-analytics-grid-compact">
            <AdminChartCard
              title="Top Performing Editors"
              description="Editors ranked by content output and contribution volume."
            >
              {topPerformers.length > 0 ? (
                <BarChart data={topPerformers} labelKey="label" valueKey="value" color="#0ea5e9" height={200} />
              ) : (
                <p className="admin-empty-hint">No contributions recorded yet.</p>
              )}
            </AdminChartCard>
            <AdminChartCard
              title="Contribution Trends"
              description="Editor publishing activity over time during the selected period."
            >
              {(analytics.contributionTrend || []).length > 0 ? (
                <LineChart data={analytics.contributionTrend} labelKey="date" valueKey="count" color="#22c55e" height={200} />
              ) : (
                <p className="admin-empty-hint">Contribution trends will appear as editors publish content.</p>
              )}
            </AdminChartCard>
          </div>
        </>
      )}

      <FilterBar className="admin-filters-row admin-filters-extended">
        <SearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search editors…"
          className="admin-search admin-search-inline"
        />
        <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">All statuses</option>
          {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="admin-select" value={activityLevel} onChange={(e) => { setActivityLevel(e.target.value); setPage(0); }}>
          <option value="">All activity levels</option>
          {ACTIVITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </FilterBar>

      {editingId && (
        <div className="role-picker compact admin-inline-role-picker">
          {EDITOR_ROLE_OPTIONS.map((r) => (
            <label key={r} className={`role-chip ${editRoles.includes(r) ? "selected" : ""}`}>
              <input type="checkbox" checked={editRoles.includes(r)} onChange={() => toggleRole(r)} />
              {r}
            </label>
          ))}
        </div>
      )}

      {loading ? (
        <div className="admin-loading-state">Loading editors…</div>
      ) : (
        <>
          <DataTable columns={columns} data={data.items || []} emptyMessage="No editors match your filters" />
          <TablePagination
            page={data.page ?? page}
            totalPages={data.totalPages ?? 1}
            total={data.total ?? 0}
            pageSize={data.size ?? 20}
            onPageChange={setPage}
          />
        </>
      )}

      {viewingUser && (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewingUser(null)}>
          <div className="profile-modal-card admin-profile-card" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Editor Profile</h3>
              <button type="button" className="modal-close-btn" onClick={() => setViewingUser(null)}>×</button>
            </div>
            <div className="profile-modal-body">
              <img className="profile-avatar-lg" src={resolveAvatar(viewingUser.profilePicture, "editor")} alt="" />
              <div className="profile-lines">
                <p><strong>Email:</strong> {viewingUser.email}</p>
                <p><strong>Status:</strong> {viewingUser.status || "ACTIVE"}</p>
                <p><strong>Field:</strong> {viewingUser.fieldName || "—"}</p>
                <p><strong>Phone:</strong> {viewingUser.phone || "—"}</p>
                <p><strong>Contributions:</strong> {viewingUser.contributionCount ?? 0}</p>
                <p><strong>Last Contribution:</strong> {formatDate(viewingUser.lastContributionAt)}</p>
                <p><strong>Experience:</strong> {viewingUser.experience || "—"}</p>
                <p><strong>References:</strong> {viewingUser.references || "—"}</p>
                {(viewingUser.attachments || []).length > 0 && (
                  <div>
                    <p><strong>Attachments:</strong></p>
                    <div className="profile-attachments">
                      {viewingUser.attachments.map((a, idx) => (
                        <a key={idx} href={a} target="_blank" rel="noopener noreferrer">Attachment {idx + 1}</a>
                      ))}
                    </div>
                  </div>
                )}
                <p><strong>Roles:</strong></p>
                <div className="role-tags">{(viewingUser.roles || []).map((r) => <span key={r} className="role-tag">{r}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {Dialog}
    </div>
  );
}
