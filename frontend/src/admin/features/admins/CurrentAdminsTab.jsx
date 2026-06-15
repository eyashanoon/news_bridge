import { useMemo } from "react";
import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { DataTable } from "../../data-display/DataTable";
import { FilterBar } from "../../data-display/FilterBar";
import { SearchInput } from "../../data-display/SearchInput";
import { TablePagination } from "../../data-display/TablePagination";
import { useTableState } from "../../hooks/useTableState";
import { resolveAvatar, displayNameFromEmail } from "../../utils/avatars";
import { ADMIN_ROLES, USER_STATUSES } from "../../constants/roles";
import { ACTIVITY_LEVELS, groupLabel } from "../../constants/permissionGroups";

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

export function CurrentAdminsTab({
  admins,
  loading,
  error,
  editingId,
  editRoles,
  editingStatusId,
  editStatus,
  viewingAdmin,
  onToggleRole,
  onStartEditRoles,
  onCancelEditRoles,
  onSaveRoles,
  onStartEditStatus,
  onCancelEditStatus,
  onSaveStatus,
  onSetEditStatus,
  onView,
  onCloseView,
  onDelete,
}) {
  const {
    search,
    setSearch,
    debouncedSearch,
    filters,
    setFilter,
    page,
    setPage,
    pageSize,
    sort,
    toggleSort,
    resetFilters,
  } = useTableState({
    initialFilters: { status: "", permissionGroup: "", role: "", activityLevel: "" },
  });

  const filtered = useMemo(() => {
    let rows = [...admins];
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (a) =>
          String(a.id).includes(q) ||
          (a.email || "").toLowerCase().includes(q) ||
          displayNameFromEmail(a.email).toLowerCase().includes(q)
      );
    }
    if (filters.status) rows = rows.filter((a) => (a.status || "ACTIVE") === filters.status);
    if (filters.role) rows = rows.filter((a) => (a.roles || []).includes(filters.role));
    if (filters.permissionGroup) {
      rows = rows.filter((a) => (a.permissionGroups || []).includes(filters.permissionGroup));
    }
    if (filters.activityLevel) {
      rows = rows.filter((a) => (a.activityLevel || "INACTIVE") === filters.activityLevel);
    }
    if (sort.key) {
      rows.sort((a, b) => {
        let av;
        let bv;
        if (sort.key === "name") {
          av = displayNameFromEmail(a.email).toLowerCase();
          bv = displayNameFromEmail(b.email).toLowerCase();
        } else if (sort.key === "createdAt") {
          av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        } else if (sort.key === "lastActivityAt") {
          av = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          bv = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        } else {
          return 0;
        }
        if (av < bv) return sort.direction === "asc" ? -1 : 1;
        if (av > bv) return sort.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [admins, debouncedSearch, filters, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const columns = [
    {
      header: "Admin",
      render: (a) => (
        <div className="admin-cell-user">
          <img className="avatar-circle" src={resolveAvatar(a.profilePicture, "admin")} alt="" />
          <div>
            <strong>{displayNameFromEmail(a.email)}</strong>
            <div className="admin-cell-muted">{a.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      render: (a) =>
        editingStatusId === a.id ? (
          <select className="admin-select" value={editStatus} onChange={(e) => onSetEditStatus(e.target.value)}>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <Badge tone={(a.status || "").toLowerCase() === "active" ? "active" : "suspended"}>
            {a.status || (a.active ? "ACTIVE" : "INACTIVE")}
          </Badge>
        ),
    },
    {
      header: "Roles",
      render: (a) =>
        editingId === a.id ? (
          <div className="role-picker compact">
            {ADMIN_ROLES.map((r) => (
              <label key={r} className={`role-chip ${editRoles.includes(r) ? "selected" : ""}`}>
                <input type="checkbox" checked={editRoles.includes(r)} onChange={() => onToggleRole(r)} />
                {r}
              </label>
            ))}
          </div>
        ) : (
          <div className="role-tags">{(a.roles || []).map((r) => <span key={r} className="role-tag">{r}</span>)}</div>
        ),
    },
    {
      header: "Groups",
      render: (a) => (
        <div className="role-tags">
          {(a.permissionGroups || []).map((g) => (
            <span key={g} className="role-tag group-tag">{groupLabel(g)}</span>
          ))}
        </div>
      ),
    },
    {
      header: (
        <button type="button" className="admin-sort-btn" onClick={() => toggleSort("createdAt")}>
          Created {sort.key === "createdAt" ? (sort.direction === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      render: (a) => formatDate(a.createdAt),
    },
    {
      header: (
        <button type="button" className="admin-sort-btn" onClick={() => toggleSort("lastActivityAt")}>
          Last Activity {sort.key === "lastActivityAt" ? (sort.direction === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      render: (a) => (
        <div>
          <div>{formatDate(a.lastActivityAt)}</div>
          <Badge tone={activityTone(a.activityLevel)}>{a.activityLevel || "INACTIVE"}</Badge>
        </div>
      ),
    },
    {
      header: "Actions",
      className: "action-cell",
      render: (a) =>
        editingId === a.id ? (
          <>
            <Button size="small" variant="primary" onClick={() => onSaveRoles(a.id)}>Save</Button>
            <Button size="small" onClick={onCancelEditRoles}>Cancel</Button>
          </>
        ) : editingStatusId === a.id ? (
          <>
            <Button size="small" variant="primary" onClick={() => onSaveStatus(a.id)}>Save</Button>
            <Button size="small" onClick={onCancelEditStatus}>Cancel</Button>
          </>
        ) : (
          <>
            <Button size="small" onClick={() => onStartEditRoles(a)}>Edit Roles</Button>
            <Button size="small" onClick={() => onStartEditStatus(a)}>Edit Status</Button>
            <Button size="small" onClick={() => onView(a)}>View</Button>
            <Button size="small" variant="danger" onClick={() => onDelete(a.id)}>Delete</Button>
          </>
        ),
    },
  ];

  return (
    <div className="admin-mgmt-panel">
      {error && <div className="admin-error">{error}</div>}

      <FilterBar className="admin-filters-row admin-filters-extended">
        <SearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by name, email, or ID…"
          className="admin-search admin-search-inline"
        />
        <select className="admin-select" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="admin-select" value={filters.permissionGroup} onChange={(e) => setFilter("permissionGroup", e.target.value)}>
          <option value="">All permission groups</option>
          {[...new Set(admins.flatMap((a) => a.permissionGroups || []))].map((g) => (
            <option key={g} value={g}>{groupLabel(g)}</option>
          ))}
        </select>
        <select className="admin-select" value={filters.role} onChange={(e) => setFilter("role", e.target.value)}>
          <option value="">All roles</option>
          {ADMIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="admin-select" value={filters.activityLevel} onChange={(e) => setFilter("activityLevel", e.target.value)}>
          <option value="">All activity levels</option>
          {ACTIVITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <Button size="small" variant="muted" onClick={resetFilters}>Reset</Button>
      </FilterBar>

      {loading ? (
        <div className="admin-loading-state">Loading administrators…</div>
      ) : (
        <>
          <DataTable columns={columns} data={pageRows} emptyMessage="No administrators match your filters" />
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      {viewingAdmin && (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" onClick={onCloseView}>
          <div className="profile-modal-card admin-profile-card" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Admin Profile</h3>
              <button type="button" className="modal-close-btn" onClick={onCloseView}>×</button>
            </div>
            <div className="profile-modal-body">
              <img className="profile-avatar-lg" src={resolveAvatar(viewingAdmin.profilePicture, "admin")} alt="" />
              <div className="profile-lines">
                <p><strong>ID:</strong> {viewingAdmin.id}</p>
                <p><strong>Name:</strong> {displayNameFromEmail(viewingAdmin.email)}</p>
                <p><strong>Email:</strong> {viewingAdmin.email}</p>
                <p><strong>Status:</strong> {viewingAdmin.status || "ACTIVE"}</p>
                <p><strong>Activity:</strong> {viewingAdmin.activityLevel || "INACTIVE"}</p>
                <p><strong>Created:</strong> {formatDate(viewingAdmin.createdAt)}</p>
                <p><strong>Last Activity:</strong> {formatDate(viewingAdmin.lastActivityAt)}</p>
                <p><strong>Roles:</strong></p>
                <div className="role-tags">{(viewingAdmin.roles || []).map((r) => <span key={r} className="role-tag">{r}</span>)}</div>
                <p><strong>Permission Groups:</strong></p>
                <div className="role-tags">{(viewingAdmin.permissionGroups || []).map((g) => (
                  <span key={g} className="role-tag group-tag">{groupLabel(g)}</span>
                ))}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
