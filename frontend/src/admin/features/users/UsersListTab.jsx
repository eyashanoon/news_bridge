import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { Card } from "../../design-system/Card";
import { StatCard } from "../../design-system/StatCard";
import { DataTable } from "../../data-display/DataTable";
import { FilterBar } from "../../data-display/FilterBar";
import { SearchInput } from "../../data-display/SearchInput";
import { TablePagination } from "../../data-display/TablePagination";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { resolveAvatar } from "../../utils/avatars";
import { REGISTERED_ROLE_OPTIONS, EDITOR_ROLE_OPTIONS, USER_STATUSES } from "../../constants/roles";
import { ACTIVITY_LEVELS } from "../../constants/permissionGroups";
import {
  listAllFrontendUsersPaged,
  getUserSummaryAnalytics,
  updateRegisteredRoles,
  updateRegisteredStatus,
  deleteRegisteredUser,
  updateEditorRoles,
  updateEditorStatus,
  deleteEditorUser,
} from "../../services/usersService";
import { UserMgmtSection } from "./UserMgmtSection";
import {
  activityTone,
  displayUserName,
  formatActivityScore,
  formatDate,
  formatRelativeDate,
  isEditor,
  statusTone,
} from "./userMgmtUtils";

const ACCOUNT_TYPES = [
  { value: "", label: "All account types" },
  { value: "REGISTERED", label: "Registered users" },
  { value: "EDITOR", label: "Editors" },
];

const ROLE_TYPES = [
  { value: "", label: "All role types" },
  { value: "user", label: "User" },
  { value: "editor", label: "Editor-linked" },
  { value: "admin-linked", label: "Admin-linked" },
  { value: "Junior", label: "Editor: Junior" },
  { value: "Verified", label: "Editor: Verified" },
  { value: "Senior", label: "Editor: Senior" },
  { value: "Admin-assigned", label: "Editor: Admin-assigned" },
];

export function UsersListTab({ session, onError }) {
  const [data, setData] = useState({ items: [], total: 0, page: 0, size: 20, totalPages: 1 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [accountType, setAccountType] = useState("");
  const [roleType, setRoleType] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);
  const [editingId, setEditingId] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [viewingUser, setViewingUser] = useState(null);
  const { askConfirm, Dialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAllFrontendUsersPaged(session.token, {
        search: debouncedSearch || undefined,
        status: status || undefined,
        accountType: accountType || undefined,
        roleType: roleType || undefined,
        activityLevel: activityLevel || undefined,
        sort,
        sortDir,
        page,
        size: 20,
      });
      setData(result);
      onError?.("");
    } catch (err) {
      onError?.(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [session.token, debouncedSearch, status, accountType, roleType, activityLevel, sort, sortDir, page, onError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getUserSummaryAnalytics(session.token)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [session.token]);

  const totalFrontend = (summary?.totalRegisteredUsers ?? 0) + (summary?.totalEditors ?? 0);
  const hasFilters = Boolean(search || status || accountType || roleType || activityLevel);

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

  const handleSaveRoles = async (user) => {
    try {
      if (isEditor(user)) {
        await updateEditorRoles(session.token, user.id, editRoles);
      } else {
        await updateRegisteredRoles(session.token, user.id, editRoles);
      }
      setEditingId(null);
      setEditingType(null);
      await load();
    } catch (err) {
      onError?.(err.response?.data?.message || "Failed to update roles");
    }
  };

  const handleSaveStatus = async (user) => {
    try {
      if (isEditor(user)) {
        await updateEditorStatus(session.token, user.id, editStatus);
      } else {
        await updateRegisteredStatus(session.token, user.id, editStatus);
      }
      setEditingStatusId(null);
      await load();
    } catch (err) {
      onError?.(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (user) => {
    const label = isEditor(user) ? "editor" : "registered user";
    const ok = await askConfirm(`Delete this ${label} account?`);
    if (!ok) return;
    try {
      if (isEditor(user)) {
        await deleteEditorUser(session.token, user.id);
      } else {
        await deleteRegisteredUser(session.token, user.id);
      }
      await load();
    } catch (err) {
      onError?.(err.response?.data?.message || "Failed to delete user");
    }
  };

  const roleOptions = editingType === "EDITOR" ? EDITOR_ROLE_OPTIONS : REGISTERED_ROLE_OPTIONS;

  const columns = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <div className="admin-cell-user">
          <img className="avatar-circle" src={resolveAvatar(null, isEditor(u) ? "editor" : "user")} alt="" />
          <div className="user-mgmt-cell-text">
            <strong>{displayUserName(u)}</strong>
            {u.username ? <div className="admin-cell-muted">@{u.username}</div> : null}
            <div className="admin-cell-muted">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (u) => (
        <Badge tone={isEditor(u) ? "pending" : "default"}>
          {isEditor(u) ? "Editor" : "Registered"}
        </Badge>
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
          <Badge tone={statusTone(u.status || (u.active ? "ACTIVE" : "INACTIVE"))}>
            {u.status || (u.active ? "ACTIVE" : "INACTIVE")}
          </Badge>
        ),
    },
    {
      key: "roleType",
      header: "Role",
      render: (u) => (
        <span className="user-mgmt-role-pill">
          {isEditor(u) ? (u.roleLevel || "Junior") : (u.roleType || "user")}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: (
        <button type="button" className="admin-sort-btn" onClick={() => toggleSort("createdAt")}>
          Joined {sort === "createdAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      render: (u) => (
        <span className="user-mgmt-date-cell" title={formatDate(u.createdAt)}>
          {formatRelativeDate(u.createdAt)}
        </span>
      ),
    },
    {
      key: "lastActivityAt",
      header: (
        <button type="button" className="admin-sort-btn" onClick={() => toggleSort("lastActivityAt")}>
          Last Active {sort === "lastActivityAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      render: (u) => (
        <div className="user-mgmt-activity-cell">
          <span className="user-mgmt-date-cell" title={formatDate(u.lastActivityAt)}>
            {formatRelativeDate(u.lastActivityAt)}
          </span>
          <Badge tone={activityTone(u.activityLevel)}>{u.activityLevel || "INACTIVE"}</Badge>
        </div>
      ),
    },
    {
      key: "score",
      header: (
        <button type="button" className="admin-sort-btn" onClick={() => toggleSort("activityScore")}>
          Score {sort === "activityScore" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      render: (u) => <span className="user-mgmt-score">{formatActivityScore(u)}</span>,
    },
    {
      key: "contributions",
      header: (
        <button type="button" className="admin-sort-btn" onClick={() => toggleSort("contributions")}>
          Posts {sort === "contributions" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      render: (u) => (isEditor(u) ? (u.contributionCount ?? 0) : "—"),
    },
    {
      key: "actions",
      header: "Actions",
      className: "action-cell",
      render: (u) =>
        editingId === u.id ? (
          <div className="user-mgmt-actions">
            <Button size="small" variant="primary" onClick={() => handleSaveRoles(u)}>Save</Button>
            <Button size="small" onClick={() => { setEditingId(null); setEditingType(null); }}>Cancel</Button>
          </div>
        ) : editingStatusId === u.id ? (
          <div className="user-mgmt-actions">
            <Button size="small" variant="primary" onClick={() => handleSaveStatus(u)}>Save</Button>
            <Button size="small" onClick={() => setEditingStatusId(null)}>Cancel</Button>
          </div>
        ) : (
          <div className="user-mgmt-actions">
            <Button size="small" onClick={() => {
              setEditingId(u.id);
              setEditingType(u.type);
              setEditRoles([...(u.roles || [])]);
            }}>Roles</Button>
            <Button size="small" onClick={() => {
              setEditingStatusId(u.id);
              setEditStatus(u.status || "ACTIVE");
            }}>Status</Button>
            <Button size="small" onClick={() => setViewingUser(u)}>View</Button>
            {isEditor(u) ? (
              <Link to={`/admin/editors/${u.id}`} className="admin-table-link">
                <Button size="small">Detail</Button>
              </Link>
            ) : null}
            <Button size="small" variant="danger" onClick={() => handleDelete(u)}>Delete</Button>
          </div>
        ),
    },
  ];

  return (
    <div className="admin-mgmt-panel user-mgmt-panel">
      <UserMgmtSection
        title="Overview"
        description="Totals reflect all registered users and editors in the system. The table below respects your active filters."
      >
        <div className="admin-stats-grid user-mgmt-kpi-grid">
          <StatCard label="Frontend Users" value={totalFrontend} color="#0ea5e9" hint="Registered + editors" />
          <StatCard
            label="Matching Filters"
            value={data.total ?? 0}
            color="#38bdf8"
            hint={hasFilters ? "Filtered result count" : "All users"}
          />
          <StatCard label="Registered" value={summary?.totalRegisteredUsers ?? "—"} color="#22d3ee" small hint="Non-editor accounts" />
          <StatCard label="Editors" value={summary?.totalEditors ?? "—"} color="#8b5cf6" small hint="Editor accounts" />
          <StatCard label="Active Accounts" value={summary?.activeUsers ?? "—"} color="#22c55e" small hint="Status = ACTIVE" />
          <StatCard label="Suspended" value={summary?.suspendedUsers ?? "—"} color="#f59e0b" small hint="Status = SUSPENDED" />
        </div>
      </UserMgmtSection>

      <UserMgmtSection title="Search & Filters">
        <FilterBar className="user-mgmt-filters">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by ID, email, name, or username…"
            className="admin-search admin-search-inline user-mgmt-search"
          />
          <select className="admin-select" value={accountType} onChange={(e) => { setAccountType(e.target.value); setPage(0); }}>
            {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="admin-select" value={roleType} onChange={(e) => { setRoleType(e.target.value); setPage(0); }}>
            {ROLE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select className="admin-select" value={activityLevel} onChange={(e) => { setActivityLevel(e.target.value); setPage(0); }}>
            <option value="">All activity levels</option>
            {ACTIVITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <Button size="small" variant="muted" onClick={() => {
            setSearch(""); setStatus(""); setAccountType(""); setRoleType(""); setActivityLevel(""); setPage(0);
          }}>Reset</Button>
        </FilterBar>
      </UserMgmtSection>

      {editingId && (
        <Card className="user-mgmt-role-editor">
          <p className="admin-cell-muted">
            Editing roles for {editingType === "EDITOR" ? "editor" : "registered user"} account
          </p>
          <div className="role-picker compact admin-inline-role-picker">
            {roleOptions.map((r) => (
              <label key={r} className={`role-chip ${editRoles.includes(r) ? "selected" : ""}`}>
                <input type="checkbox" checked={editRoles.includes(r)} onChange={() => toggleRole(r)} />
                {r}
              </label>
            ))}
          </div>
        </Card>
      )}

      <UserMgmtSection
        title="Users"
        description={`Showing page ${(data.page ?? page) + 1} of ${data.totalPages ?? 1} · ${data.total ?? 0} total matches`}
      >
        {loading ? (
          <div className="admin-loading-state">Loading frontend users…</div>
        ) : (
          <Card className="user-mgmt-table-card">
            <DataTable columns={columns} data={data.items || []} emptyMessage="No registered users or editors match your filters" />
            <TablePagination
              page={data.page ?? page}
              totalPages={data.totalPages ?? 1}
              total={data.total ?? 0}
              pageSize={data.size ?? 20}
              onPageChange={setPage}
            />
          </Card>
        )}
      </UserMgmtSection>

      {viewingUser && (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewingUser(null)}>
          <div className="profile-modal-card admin-profile-card user-mgmt-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>{isEditor(viewingUser) ? "Editor Profile" : "User Profile"}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setViewingUser(null)}>×</button>
            </div>
            <div className="profile-modal-body user-mgmt-profile-body">
              <img className="profile-avatar-lg" src={resolveAvatar(null, isEditor(viewingUser) ? "editor" : "user")} alt="" />
              <div className="user-mgmt-profile-grid">
                <div><span className="user-mgmt-profile-label">ID</span><span>{viewingUser.id}</span></div>
                <div><span className="user-mgmt-profile-label">Account</span><span>{isEditor(viewingUser) ? "Editor" : "Registered"}</span></div>
                <div><span className="user-mgmt-profile-label">Name</span><span>{displayUserName(viewingUser)}</span></div>
                <div><span className="user-mgmt-profile-label">Email</span><span>{viewingUser.email}</span></div>
                <div><span className="user-mgmt-profile-label">Status</span><span>{viewingUser.status || "ACTIVE"}</span></div>
                <div>
                  <span className="user-mgmt-profile-label">{isEditor(viewingUser) ? "Role Level" : "Role Type"}</span>
                  <span>{isEditor(viewingUser) ? (viewingUser.roleLevel || "Junior") : (viewingUser.roleType || "user")}</span>
                </div>
                {isEditor(viewingUser) && viewingUser.fieldName ? (
                  <div><span className="user-mgmt-profile-label">Fields</span><span>{viewingUser.fieldName}</span></div>
                ) : null}
                {isEditor(viewingUser) ? (
                  <div><span className="user-mgmt-profile-label">Contributions</span><span>{viewingUser.contributionCount ?? 0}</span></div>
                ) : null}
                <div><span className="user-mgmt-profile-label">Joined</span><span>{formatDate(viewingUser.createdAt)}</span></div>
                <div><span className="user-mgmt-profile-label">Last Activity</span><span>{formatDate(viewingUser.lastActivityAt)}</span></div>
                <div>
                  <span className="user-mgmt-profile-label">Activity Score</span>
                  <span>{formatActivityScore(viewingUser)} ({viewingUser.activityLevel || "INACTIVE"})</span>
                </div>
              </div>
              <div className="user-mgmt-profile-roles">
                <span className="user-mgmt-profile-label">Roles</span>
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
