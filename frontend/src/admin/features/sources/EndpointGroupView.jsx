import { useEffect, useRef, useState } from "react";
import { EndpointTable } from "./EndpointTable";
import { EndpointUrlDisplay, buildGroupSampleUrl } from "./EndpointUrlDisplay";
import { isDiscoverySelectable } from "./endpointUtils";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function getSelectableEndpoints(endpoints, showDiscoveryMeta) {
  if (!showDiscoveryMeta) return endpoints;
  return endpoints.filter(isDiscoverySelectable);
}

function getGroupSelectionState(group, selectedIds, showDiscoveryMeta) {
  const selectable = getSelectableEndpoints(group.endpoints, showDiscoveryMeta);
  if (!selectable.length) {
    return { allSelected: false, someSelected: false, selectableCount: 0 };
  }
  const selectedCount = selectable.filter((ep) => selectedIds.includes(ep.id)).length;
  return {
    allSelected: selectedCount === selectable.length,
    someSelected: selectedCount > 0 && selectedCount < selectable.length,
    selectableCount: selectable.length,
    selectedCount,
  };
}

export function EndpointGroupView({
  groups,
  roots,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleGroupSelect,
  onEdit,
  onStatusChange,
  onDelete,
  onRemove,
  selectable,
  editable,
  showDiscoveryMeta,
  highlightSegments = 0,
}) {
  const [collapsed, setCollapsed] = useState({});

  const toggleGroup = (key) => {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  };

  if (!groups.length) {
    return <div className="endpoint-group-empty">No endpoint groups match the current filters.</div>;
  }

  return (
    <div className="endpoint-group-view">
      {groups.map((group) => {
        const isOpen = !collapsed[group.key];
        const discoveryMode = showDiscoveryMeta || group.discoveryMode;
        const sampleUrl = buildGroupSampleUrl(group.endpoints, group.key);
        const selection = getGroupSelectionState(group, selectedIds, showDiscoveryMeta);

        return (
          <GroupCard
            key={group.key}
            group={group}
            isOpen={isOpen}
            discoveryMode={discoveryMode}
            sampleUrl={sampleUrl}
            selection={selection}
            selectable={selectable}
            highlightSegments={highlightSegments}
            selectedIds={selectedIds}
            roots={roots}
            showDiscoveryMeta={showDiscoveryMeta}
            editable={editable}
            onToggleGroup={toggleGroup}
            onToggleGroupSelect={onToggleGroupSelect}
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={onToggleSelectAll}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onRemove={onRemove}
            formatDate={formatDate}
          />
        );
      })}
    </div>
  );
}

function GroupCard({
  group,
  isOpen,
  discoveryMode,
  sampleUrl,
  selection,
  selectable,
  highlightSegments,
  selectedIds,
  roots,
  showDiscoveryMeta,
  editable,
  onToggleGroup,
  onToggleGroupSelect,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onStatusChange,
  onDelete,
  onRemove,
  formatDate,
}) {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = selection.someSelected;
    }
  }, [selection.someSelected, selection.allSelected]);

  return (
    <div
      className={`endpoint-group-card${isOpen ? " is-open" : ""}${selection.allSelected ? " is-group-selected" : ""}`}
    >
      <div className="endpoint-group-header">
        {selectable && selection.selectableCount > 0 && (
          <label className="endpoint-group-checkbox" onClick={(e) => e.stopPropagation()}>
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={selection.allSelected}
              onChange={(e) => onToggleGroupSelect?.(group.endpoints, e.target.checked)}
              aria-label={`Select all in ${group.label}`}
            />
          </label>
        )}

        <button
          type="button"
          className="endpoint-group-expand"
          onClick={() => onToggleGroup(group.key)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse group" : "Expand group"}
        >
          <span className="endpoint-group-chevron">{isOpen ? "▼" : "▶"}</span>
        </button>

        <div className="endpoint-group-heading">
          <div className="endpoint-group-path">
            {sampleUrl ? (
              <EndpointUrlDisplay
                url={sampleUrl}
                highlightSegments={highlightSegments || group.segmentCount}
              />
            ) : (
              <span className="endpoint-group-title">{group.label}</span>
            )}
          </div>
          <div className="endpoint-group-submeta">
            <span className="endpoint-group-count">
              {group.count} endpoint{group.count !== 1 ? "s" : ""}
            </span>
            {selectable && selection.selectableCount > 0 && (
              <span className="endpoint-group-selected-count">
                · {selection.selectedCount}/{selection.selectableCount} selected
              </span>
            )}
          </div>
        </div>

        <div className="endpoint-group-badges">
          {discoveryMode ? (
            <>
              {group.avgConfidence != null && (
                <span className="endpoint-group-badge">
                  Avg {(group.avgConfidence * 100).toFixed(0)}%
                </span>
              )}
              {Object.entries(group.depthBreakdown || {})
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([d, n]) => (
                  <span key={d} className="endpoint-group-badge endpoint-group-badge--depth">
                    BFS {d}: {n}
                  </span>
                ))}
            </>
          ) : (
            <>
              <span className="endpoint-group-badge endpoint-group-badge--active">
                {group.active} active
              </span>
              {group.disabled > 0 && (
                <span className="endpoint-group-badge endpoint-group-badge--muted">
                  {group.disabled} disabled
                </span>
              )}
              <span className="endpoint-group-badge endpoint-group-badge--muted">
                Last crawl {formatDate(group.lastCrawl)}
              </span>
            </>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="endpoint-group-body">
          <EndpointTable
            endpoints={group.endpoints}
            roots={roots}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={(val) => onToggleSelectAll?.(val, group.endpoints)}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onRemove={onRemove}
            selectable={selectable}
            editable={editable}
            showDiscoveryMeta={showDiscoveryMeta}
            highlightSegments={highlightSegments || group.segmentCount}
          />
        </div>
      )}
    </div>
  );
}
