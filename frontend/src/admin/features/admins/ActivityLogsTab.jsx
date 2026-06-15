import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { DataTable } from "../../data-display/DataTable";
import { FilterBar } from "../../data-display/FilterBar";
import { SearchInput } from "../../data-display/SearchInput";
import { TablePagination } from "../../data-display/TablePagination";
import { getActivityLogs } from "../../services/adminsService";
import { ACTIVITY_ACTIONS, formatActivityAction } from "../../constants/permissionGroups";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ActivityLogsTab({ session }) {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getActivityLogs(session.token, {
        search: search || undefined,
        action: action || undefined,
        status: status || undefined,
        page,
        size: pageSize,
      });
      setLogs(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.totalElements || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load activity logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [session.token, search, action, status, page]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const columns = [
    {
      header: "Admin",
      render: (row) => (
        <div>
          <strong>{row.adminEmail}</strong>
          {row.adminId && <div className="admin-cell-muted">ID {row.adminId}</div>}
        </div>
      ),
    },
    {
      header: "Action",
      render: (row) => (
        <div className="user-mgmt-cell-text">
          <strong>{formatActivityAction(row.action)}</strong>
          <span className="admin-cell-muted">{row.action}</span>
        </div>
      ),
    },
    { header: "Timestamp", render: (row) => formatDate(row.timestamp) },
    {
      header: "Status",
      render: (row) => (
        <Badge tone={row.status === "SUCCESS" ? "approved" : "rejected"}>{row.status}</Badge>
      ),
    },
    {
      header: "Target",
      className: "admin-activity-target-cell",
      render: (row) => <code className="admin-activity-target">{row.targetResource || "—"}</code>,
    },
    {
      header: "Details",
      className: "admin-activity-result-cell",
      render: (row) => <span className="admin-cell-result">{row.result || "—"}</span>,
    },
  ];

  return (
    <div className="admin-mgmt-panel">
      {error && <div className="admin-error">{error}</div>}

      <FilterBar className="admin-filters-row admin-filters-extended">
        <SearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search logs…"
          className="admin-search admin-search-inline"
        />
        <select className="admin-select" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
          <option value="">All actions</option>
          {ACTIVITY_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">All statuses</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
        </select>
        <Button size="small" variant="muted" onClick={() => { setSearch(""); setAction(""); setStatus(""); setPage(0); }}>
          Reset
        </Button>
      </FilterBar>

      {loading ? (
        <div className="admin-loading-state">Loading activity logs…</div>
      ) : logs.length === 0 ? (
        <div className="admin-empty-state">
          <h3>No activity logs found</h3>
          <p>Data-changing admin actions (create, update, delete, approve, suspend, etc.) will appear here.</p>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={logs} emptyMessage="No logs found" />
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
