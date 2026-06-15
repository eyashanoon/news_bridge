import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { AdminChartCard } from "../../design-system/AdminChartCard";
import { PageShell } from "../../design-system/PageShell";
import { StatCard } from "../../design-system/StatCard";
import { BarChart, LineChart } from "../../analytics";
import { DataTable } from "../../data-display/DataTable";
import { FilterBar } from "../../data-display/FilterBar";
import { SearchInput } from "../../data-display/SearchInput";
import { TablePagination } from "../../data-display/TablePagination";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { hasRole } from "../../utils/roles";
import { resolveAvatar, displayNameFromEmail } from "../../utils/avatars";
import { EDITOR_ROLE_OPTIONS, USER_STATUSES } from "../../constants/roles";
import { ACTIVITY_LEVELS } from "../../constants/permissionGroups";
import {
  getEditors,
  getEditorStats,
  getEditorAnalytics,
  suspendEditor,
  activateEditor,
  promoteEditor,
  deleteEditor,
} from "../../services/editorService";

const ROLE_LEVELS = ["Junior", "Senior", "Verified", "Admin-assigned"];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusTone(status) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "SUSPENDED") return "suspended";
  if (s === "PENDING_ACTIVATION" || s === "PENDING") return "pending";
  return "default";
}

function activityTone(level) {
  if (level === "HIGH") return "approved";
  if (level === "MEDIUM") return "pending";
  if (level === "LOW") return "default";
  return "rejected";
}

export function ManageEditors({ session }) {
  const navigate = useNavigate();
  const canManage = hasRole(session, "MANAGE_USERS");
  const [data, setData] = useState({ items: [], total: 0, page: 0, size: 20, totalPages: 1 });
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [roleLevel, setRoleLevel] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [sort, setSort] = useState("contributions");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [periodDays, setPeriodDays] = useState(30);
  const debouncedSearch = useDebouncedValue(search, 300);
  const { askConfirm, Dialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getEditors(session.token, {
        search: debouncedSearch || undefined,
        status: status || undefined,
        activityLevel: activityLevel || undefined,
        roleLevel: roleLevel || undefined,
        sort,
        sortDir,
        page,
        size: 20,
      });
      setData(result);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load editors");
    } finally {
      setLoading(false);
    }
  }, [session.token, debouncedSearch, status, activityLevel, roleLevel, sort, sortDir, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setStatsLoading(true);
    getEditorStats(session.token)
      .then(setStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [session.token]);

  useEffect(() => {
    setAnalyticsLoading(true);
    getEditorAnalytics(session.token, periodDays)
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [session.token, periodDays]);

  const toggleSort = (key) => {
    if (sort === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const handleSuspend = async (editor) => {
    const ok = await askConfirm(`Suspend editor ${editor.email}?`);
    if (!ok) return;
    try {
      await suspendEditor(session.token, editor.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to suspend editor");
    }
  };

  const handleActivate = async (editor) => {
    const ok = await askConfirm(`Activate editor ${editor.email}?`);
    if (!ok) return;
    try {
      await activateEditor(session.token, editor.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to activate editor");
    }
  };

  const handlePromote = async (editor) => {
    const ok = await askConfirm(`Promote ${editor.email} to Senior editor level?`);
    if (!ok) return;
    try {
      await promoteEditor(session.token, editor.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to promote editor");
    }
  };

  const handleDelete = async (editor) => {
    const ok = await askConfirm(`Permanently remove editor ${editor.email}?`);
    if (!ok) return;
    try {
      await deleteEditor(session.token, editor.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove editor");
    }
  };

  const topPerformers = (analytics?.topPerformers || []).slice(0, 6).map((e) => ({
    label: (e.username || e.email || `Editor ${e.editorId}`).slice(0, 12),
    value: e.contributionCount || 0,
  }));

  const columns = [
    {
      key: "editor",
      header: "Editor Name",
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
      render: (u) => (
        <Badge tone={statusTone(u.status)}>
          {u.status === "PENDING_ACTIVATION" ? "Pending" : (u.status || "ACTIVE")}
        </Badge>
      ),
    },
    {
      key: "roleLevel",
      header: "Role Level",
      render: (u) => <Badge tone="default">{u.roleLevel || "Junior"}</Badge>,
    },
    {
      key: "categories",
      header: "Assigned Categories",
      render: (u) => u.fieldName || "—",
    },
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
      key: "approval",
      header: "Approval Status",
      render: (u) => (
        <div>
          <Badge tone={statusTone(u.approvalStatus)}>{u.approvalStatus || "ACTIVE"}</Badge>
          {u.editorRequestId && (
            <div className="admin-cell-muted">
              <Link to="/admin/editor-requests">Request #{u.editorRequestId}</Link>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "action-cell",
      render: (u) => (
        <>
          <Button size="small" onClick={() => navigate(`/admin/editors/${u.id}`)}>View</Button>
          {canManage && u.status !== "SUSPENDED" && (
            <Button size="small" variant="danger" onClick={() => handleSuspend(u)}>Suspend</Button>
          )}
          {canManage && u.status === "SUSPENDED" && (
            <Button size="small" onClick={() => handleActivate(u)}>Activate</Button>
          )}
          {canManage && (u.roleLevel === "Junior" || u.roleLevel === "Verified") && (
            <Button size="small" onClick={() => handlePromote(u)}>Promote</Button>
          )}
          {canManage && (
            <Button size="small" variant="danger" onClick={() => handleDelete(u)}>Remove</Button>
          )}
        </>
      ),
    },
  ];

  return (
    <PageShell
      title="Editor Management"
      subtitle="Content operations center — manage editorial workforce, contributions, and performance"
      actions={
        <Link to="/admin/editor-requests" className="admin-link-btn">
          View Editor Applications →
        </Link>
      }
    >
      {error && <div className="admin-error">{error}</div>}

      {statsLoading ? (
        <div className="admin-loading-state">Loading editor KPIs…</div>
      ) : stats && (
        <div className="admin-stats-grid admin-stats-grid-compact">
          <StatCard label="Total Editors" value={stats.totalEditors ?? 0} color="#0ea5e9" />
          <StatCard label="Active Editors" value={stats.activeEditors ?? 0} color="#22c55e" />
          <StatCard label="Pending Editors" value={stats.pendingEditors ?? 0} color="#f59e0b" />
          <StatCard label="Suspended Editors" value={stats.suspendedEditors ?? 0} color="#ef4444" />
          <StatCard label="Total Published Content" value={stats.totalPublishedContent ?? 0} color="#8b5cf6" />
          <StatCard
            label="Avg Content / Editor"
            value={stats.averageContentPerEditor != null ? stats.averageContentPerEditor.toFixed(1) : "0"}
            color="#14b8a6"
            small
          />
          <StatCard
            label="Last Active Editor"
            value={stats.lastActiveEditorName || stats.lastActiveEditorEmail || "—"}
            color="#ec4899"
            small
          />
        </div>
      )}

      <div className="admin-analytics-toolbar">
        <label>
          Analytics period:
          <select className="admin-select" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </div>

      {!analyticsLoading && analytics && (
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
      )}

      <FilterBar className="admin-filters-row admin-filters-extended">
        <SearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by name, email, or ID…"
          className="admin-search admin-search-inline"
        />
        <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">All statuses</option>
          {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="admin-select" value={roleLevel} onChange={(e) => { setRoleLevel(e.target.value); setPage(0); }}>
          <option value="">All role levels</option>
          {ROLE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="admin-select" value={activityLevel} onChange={(e) => { setActivityLevel(e.target.value); setPage(0); }}>
          <option value="">All activity levels</option>
          {ACTIVITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select
          className="admin-select"
          value={`${sort}:${sortDir}`}
          onChange={(e) => {
            const [s, d] = e.target.value.split(":");
            setSort(s);
            setSortDir(d);
            setPage(0);
          }}
        >
          <option value="contributions:desc">Most contributions</option>
          <option value="lastActivityAt:desc">Recently active</option>
          <option value="lastActivityAt:asc">Least active</option>
          <option value="createdAt:desc">Newest joined</option>
          <option value="createdAt:asc">Oldest joined</option>
          <option value="name:asc">Name A–Z</option>
        </select>
      </FilterBar>

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

      {canManage && (
        <p className="admin-empty-hint" style={{ marginTop: "1rem" }}>
          Editor roles available: {EDITOR_ROLE_OPTIONS.join(", ")}
        </p>
      )}

      {Dialog}
    </PageShell>
  );
}
