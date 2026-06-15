import { useMemo, useState } from "react";
import { EndpointFilterSummary } from "./EndpointFilterSummary";
import { EndpointFilters } from "./EndpointFilters";
import { EndpointGroupView } from "./EndpointGroupView";
import { EndpointTable } from "./EndpointTable";
import {
  computeBfsDepthBreakdown,
  discoveryEndpointToRow,
  filterEndpoints,
  groupEndpointsBySegment,
  isDiscoverySelectable,
} from "./endpointUtils";

const DEFAULT_FILTERS = {
  search: "",
  depth: "all",
  groupSegment: 0,
};

export function DiscoveryResultsView({
  endpoints,
  rootBaseUrl,
  maxDepth = 2,
  onToggle,
  onToggleAll,
  onToggleGroup,
  onRemove,
  selectable = true,
}) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const rows = useMemo(
    () => endpoints.map((ep) => discoveryEndpointToRow(ep, rootBaseUrl)),
    [endpoints, rootBaseUrl]
  );

  const filtered = useMemo(
    () => filterEndpoints(rows, filters, {}, { useBfsDepth: true }),
    [rows, filters]
  );

  const groups = useMemo(() => {
    if (!filters.groupSegment) return null;
    return groupEndpointsBySegment(filtered, filters.groupSegment, { discoveryMode: true });
  }, [filtered, filters.groupSegment]);

  const { counts: depthBreakdown, unknown: unknownDepthCount } = useMemo(
    () => computeBfsDepthBreakdown(rows),
    [rows]
  );

  const selectedIds = useMemo(
    () => rows.filter((e) => e.selected && isDiscoverySelectable(e)).map((e) => e.id),
    [rows]
  );

  const handleToggleGroup = (groupEndpoints, val) => {
    onToggleGroup?.(groupEndpoints, val);
  };

  return (
    <div className="discovery-results-view sources-panel-section">
      <EndpointFilters
        filters={filters}
        onChange={setFilters}
        variant="discovery"
        maxDepth={maxDepth}
        extraActions={
          <>
            <button
              type="button"
              className="admin-btn small"
              onClick={() => onToggleGroup?.(filtered.filter(isDiscoverySelectable), true)}
            >
              Select all visible
            </button>
            <button type="button" className="admin-btn small" onClick={() => onToggleAll?.(false)}>Deselect all</button>
          </>
        }
      />

      <EndpointFilterSummary
        totalCount={rows.length}
        filteredCount={filtered.length}
        selectedCount={selectedIds.length}
        filters={filters}
        variant="discovery"
        depthBreakdown={depthBreakdown}
        maxDepth={maxDepth}
        unknownDepthCount={unknownDepthCount}
      />

      {groups ? (
        <EndpointGroupView
          groups={groups}
          selectable={selectable}
          showDiscoveryMeta
          selectedIds={selectedIds}
          highlightSegments={filters.groupSegment}
          onToggleSelect={(url) => onToggle?.(url)}
          onToggleGroupSelect={handleToggleGroup}
          onRemove={onRemove}
        />
      ) : (
        <div className="discovery-endpoints-table-wrap endpoint-table-panel">
          <EndpointTable
            endpoints={filtered}
            selectable={selectable}
            showDiscoveryMeta
            selectedIds={selectedIds}
            highlightSegments={0}
            onToggleSelect={(url) => onToggle?.(url)}
            onRemove={onRemove}
          />
        </div>
      )}
    </div>
  );
}
