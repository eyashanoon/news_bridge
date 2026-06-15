export function EndpointFilterSummary({
  totalCount,
  filteredCount,
  selectedCount,
  filters,
  variant = "endpoints",
  depthBreakdown = {},
  maxDepth,
  unknownDepthCount = 0,
}) {
  const chips = [];

  if (filters.search?.trim()) {
    chips.push(`Search: "${filters.search.trim()}"`);
  }

  if (variant === "discovery" && filters.depth && filters.depth !== "all") {
    const d = Number(filters.depth);
    chips.push(d === 1 ? "BFS depth 1 only" : `BFS depth ≤ ${d}`);
  }

  if (filters.groupSegment > 0) {
    chips.push(`Grouped by ${filters.groupSegment} segment${filters.groupSegment !== 1 ? "s" : ""}`);
  }

  if (variant === "endpoints") {
    if (filters.rootId) chips.push("Root filter");
    if (filters.status) chips.push(`Status: ${filters.status}`);
    if (filters.lastCrawl) chips.push(`Last crawl: ${filters.lastCrawl}`);
  }

  const depthParts = Object.entries(depthBreakdown)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([d, n]) => `D${d}: ${n}`);

  return (
    <div className="endpoint-filter-summary">
      <div className="endpoint-filter-summary-main">
        <span className="endpoint-filter-summary-count">
          Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> endpoint{totalCount !== 1 ? "s" : ""}
        </span>
        {selectedCount > 0 && (
          <span className="endpoint-filter-summary-selected">
            · <strong>{selectedCount}</strong> selected
          </span>
        )}
        {variant === "discovery" && maxDepth != null && (
          <span className="endpoint-filter-summary-meta">
            · Discovery ran with max depth <strong>{maxDepth}</strong>
          </span>
        )}
      </div>

      {(chips.length > 0 || depthParts.length > 0) && (
        <div className="endpoint-filter-summary-chips">
          {chips.map((c) => (
            <span key={c} className="endpoint-filter-chip">{c}</span>
          ))}
          {variant === "discovery" && depthParts.length > 0 && (
            <span className="endpoint-filter-chip endpoint-filter-chip--depth">
              In results: {depthParts.join(" · ")}
              {unknownDepthCount > 0 && ` · unknown depth: ${unknownDepthCount}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
