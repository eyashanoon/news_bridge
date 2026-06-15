import { FilterBar } from "../../data-display/FilterBar";
import { SearchInput } from "../../data-display/SearchInput";
import { getBfsDepthFilterOptions } from "./endpointUtils";

export function EndpointFilters({
  filters,
  onChange,
  roots = [],
  variant = "endpoints",
  maxDepth = 2,
  extraActions = null,
}) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const isDiscovery = variant === "discovery";
  const depthOptions = isDiscovery ? getBfsDepthFilterOptions(maxDepth) : [];

  return (
    <FilterBar>
      <SearchInput
        placeholder="Search URL or path…"
        value={filters.search || ""}
        onChange={(e) => set("search", e.target.value)}
      />

      {!isDiscovery && (
        <>
          <SearchInput
            placeholder="Root name…"
            value={filters.rootNameSearch || ""}
            onChange={(e) => set("rootNameSearch", e.target.value)}
          />
          <select className="admin-select" value={filters.rootId || ""} onChange={(e) => set("rootId", e.target.value)}>
            <option value="">All roots</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select className="admin-select" value={filters.status || ""} onChange={(e) => set("status", e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
          <select className="admin-select" value={filters.lastCrawl || ""} onChange={(e) => set("lastCrawl", e.target.value)}>
            <option value="">Any last crawl</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="never">Never crawled</option>
          </select>
        </>
      )}

      {isDiscovery && (
        <select className="admin-select" value={filters.depth || "all"} onChange={(e) => set("depth", e.target.value)}>
          {depthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      <select
        className="admin-select"
        value={filters.groupSegment ?? 0}
        onChange={(e) => set("groupSegment", Number(e.target.value))}
      >
        <option value={0}>Group by: None</option>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <option key={n} value={n}>Group by: {n} segment{n !== 1 ? "s" : ""}</option>
        ))}
      </select>

      {extraActions}
    </FilterBar>
  );
}
