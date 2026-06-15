import { DataTable } from "../../data-display/DataTable";
import { Badge } from "../../design-system/Badge";
import { EndpointUrlDisplay } from "./EndpointUrlDisplay";
import { isDiscoverySelectable } from "./endpointUtils";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

export function EndpointTable({
  endpoints,
  roots = [],
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onStatusChange,
  onDelete,
  onRemove,
  selectable = false,
  editable = false,
  showDiscoveryMeta = false,
  highlightSegments = 0,
}) {
  const rootsById = Object.fromEntries(roots.map((r) => [r.id, r]));

  const selectableEndpoints = showDiscoveryMeta
    ? endpoints.filter(isDiscoverySelectable)
    : endpoints;
  const allSelected = selectableEndpoints.length > 0
    && selectableEndpoints.every((e) => selectedIds.includes(e.id));

  const columns = [
    ...(selectable ? [{
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onToggleSelectAll?.(e.target.checked)}
          aria-label="Select all"
        />
      ),
      render: (row) => {
        const savable = !showDiscoveryMeta || isDiscoverySelectable(row);
        return (
          <input
            type="checkbox"
            checked={selectedIds.includes(row.id)}
            disabled={showDiscoveryMeta && (!savable || row.assessmentStatus === "assessing")}
            onChange={() => onToggleSelect?.(row.id)}
            aria-label={`Select ${row.url}`}
          />
        );
      },
    }] : []),
    ...(showDiscoveryMeta ? [{
      key: "parent",
      header: "Parent",
      render: (row) => (
        row.parent ? (
          <EndpointUrlDisplay url={row.parent} highlightSegments={0} asLink className="endpoint-url--compact" />
        ) : "—"
      ),
    }] : []),
    {
      key: "url",
      header: "URL",
      className: "title-cell endpoint-url-cell",
      render: (row) => (
        <EndpointUrlDisplay
          url={row.url}
          highlightSegments={highlightSegments}
          asLink
        />
      ),
    },
    ...(!showDiscoveryMeta ? [{
      key: "root",
      header: "Root",
      render: (row) => row.rootName || rootsById[row.rootId]?.name || row.rootId || "—",
    }] : []),
    {
      key: "depth",
      header: showDiscoveryMeta ? "BFS depth" : "Path depth",
      render: (row) => {
        const val = showDiscoveryMeta ? row.bfsDepth : row.pathDepth;
        if (val == null) return "—";
        return (
          <span className={`endpoint-depth-pill${showDiscoveryMeta ? ` endpoint-depth-pill--d${val}` : ""}`}>
            {val}
          </span>
        );
      },
    },
    ...(!showDiscoveryMeta ? [
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge tone={row.status === "ACTIVE" ? "active" : "suspended"}>{row.status || "ACTIVE"}</Badge>
        ),
      },
      {
        key: "priority",
        header: "Priority",
        render: (row) => (row.crawlScore != null ? Number(row.crawlScore).toFixed(2) : "—"),
      },
      {
        key: "lastCrawl",
        header: "Last crawl",
        render: (row) => formatDate(row.lastCrawledAt),
      },
    ] : []),
    ...(showDiscoveryMeta ? [
      {
        key: "confidence",
        header: "Confidence",
        render: (row) => (row.confidence != null ? `${(row.confidence * 100).toFixed(1)}%` : "—"),
      },
      {
        key: "assessment",
        header: "Assessment",
        render: (row) => (
          <span className={`discovery-assess-${row.assessmentStatus || "unknown"}`}>
            {row.assessmentStatus || "—"}
          </span>
        ),
      },
      ...(onRemove ? [{
        key: "remove",
        header: "",
        className: "action-cell",
        render: (row) => (
          <button type="button" className="discovery-ep-remove" onClick={() => onRemove(row.url)}>✕</button>
        ),
      }] : []),
    ] : []),
    ...(editable ? [{
      key: "actions",
      header: "Actions",
      className: "action-cell",
      render: (row) => (
        <>
          <button type="button" className="admin-btn small" onClick={() => onEdit?.(row)}>Edit</button>
          {row.status === "ACTIVE" ? (
            <button type="button" className="admin-btn small" onClick={() => onStatusChange?.(row, "SUSPENDED")}>Deactivate</button>
          ) : (
            <button type="button" className="admin-btn small" onClick={() => onStatusChange?.(row, "ACTIVE")}>Activate</button>
          )}
          <button type="button" className="admin-btn small danger" onClick={() => onDelete?.(row)}>Delete</button>
        </>
      ),
    }] : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={endpoints}
      rowKey="id"
      emptyMessage="No endpoints found"
      rowClassName={(row) => {
        const selected = selectedIds.includes(row.id);
        const savable = !showDiscoveryMeta || isDiscoverySelectable(row);
        return selected && savable ? "endpoint-row-selected" : "";
      }}
    />
  );
}
