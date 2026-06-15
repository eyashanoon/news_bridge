/** Normalize URL path for segment extraction. */
function normalizePath(path) {
  if (!path || path === "/") return "/";
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
}

/** Path segments after the domain (first segment = first path component). */
export function getUrlPathSegments(url) {
  try {
    const path = normalizePath(new URL(url).pathname);
    if (path === "/") return [];
    return path.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

/** @deprecated Use getUrlPathSegments — kept for path-depth analytics. */
export function getPathSegments(url, baseUrl) {
  try {
    const u = new URL(url);
    let path = normalizePath(u.pathname);
    let basePath = "/";
    if (baseUrl) {
      basePath = normalizePath(new URL(baseUrl).pathname);
    }
    if (basePath !== "/" && path.startsWith(basePath)) {
      path = path.slice(basePath.length) || "/";
    }
    if (path === "/") return [];
    return path.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

export function getPathDepth(url, baseUrl) {
  return getPathSegments(url, baseUrl).length;
}

/** Group key from the first N path segments after the domain. */
export function getPathGroup(url, segmentCount) {
  if (!segmentCount || segmentCount <= 0) return null;
  const segments = getUrlPathSegments(url);
  if (!segments.length) return "(root)";
  return segments.slice(0, segmentCount).join("/");
}

export function getUrlPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

/** URL path depth filter (legacy — path segment count). */
export function matchesPathDepthFilter(depth, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "1") return depth === 1;
  if (filter === "2") return depth === 2;
  if (filter === "3") return depth === 3;
  if (filter === "4+") return depth >= 4;
  if (filter.startsWith("custom:")) {
    const custom = Number(filter.split(":")[1]);
    return !Number.isNaN(custom) && depth === custom;
  }
  return true;
}

/**
 * BFS tree depth filter for discovery results.
 * Depth 1 → only endpoints found at tree depth 1.
 * Depth 2 → endpoints at depth 1 and 2 (cumulative).
 */
export function matchesBfsDepthFilter(bfsDepth, filter) {
  if (!filter || filter === "all") return true;
  const depth = Number(bfsDepth);
  if (!Number.isFinite(depth)) return false;
  const maxDepth = Number(filter);
  if (!Number.isFinite(maxDepth) || maxDepth <= 0) return true;
  if (maxDepth === 1) return depth === 1;
  return depth >= 1 && depth <= maxDepth;
}

export function matchesLastCrawlFilter(lastCrawledAt, filter) {
  if (!filter) return true;
  if (!lastCrawledAt) return filter === "never";
  const ts = new Date(lastCrawledAt).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (filter === "7d") return now - ts <= 7 * day;
  if (filter === "30d") return now - ts <= 30 * day;
  if (filter === "90d") return now - ts <= 90 * day;
  if (filter === "never") return false;
  return true;
}

export function filterEndpoints(endpoints, filters, rootsById = {}, options = {}) {
  const {
    search = "",
    rootId = "",
    status = "",
    depth = "all",
    lastCrawl = "",
    endpointType = "",
    rootNameSearch = "",
  } = filters;

  const { useBfsDepth = false } = options;
  const q = search.trim().toLowerCase();
  const rootNameQ = rootNameSearch.trim().toLowerCase();

  return endpoints.filter((ep) => {
    const root = rootsById[ep.rootId] || { name: ep.rootName, baseUrl: "" };
    const path = getUrlPath(ep.url).toLowerCase();

    if (rootId && String(ep.rootId) !== String(rootId)) return false;
    if (status && ep.status !== status) return false;

    if (depth && depth !== "all") {
      const depthVal = useBfsDepth
        ? ep.bfsDepth
        : (ep.pathDepth ?? getPathDepth(ep.url, root.baseUrl));
      const matches = useBfsDepth
        ? matchesBfsDepthFilter(depthVal, depth)
        : matchesPathDepthFilter(depthVal, depth);
      if (!matches) return false;
    }

    if (!matchesLastCrawlFilter(ep.lastCrawledAt, lastCrawl)) return false;
    if (endpointType && ep.classification !== endpointType) return false;

    if (q) {
      const hay = `${ep.url} ${path} ${root.name || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (rootNameQ && !(root.name || "").toLowerCase().includes(rootNameQ)) return false;

    return true;
  });
}

export function groupEndpointsBySegment(endpoints, segmentCount, options = {}) {
  const { discoveryMode = false } = options;
  if (!segmentCount || segmentCount <= 0) return null;

  const groups = new Map();

  for (const ep of endpoints) {
    const key = getPathGroup(ep.url, segmentCount) ?? "(root)";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(ep);
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => a.url.localeCompare(b.url));
      const active = items.filter((e) => e.status === "ACTIVE").length;
      const disabled = items.length - active;
      const lastCrawl = items
        .map((e) => e.lastCrawledAt)
        .filter(Boolean)
        .sort()
        .pop();
      const confidences = items
        .map((e) => e.confidence)
        .filter((c) => c != null);
      const avgConfidence = confidences.length
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : null;

      const depthBreakdown = {};
      for (const ep of sorted) {
        if (Number.isFinite(ep.bfsDepth)) {
          depthBreakdown[ep.bfsDepth] = (depthBreakdown[ep.bfsDepth] || 0) + 1;
        }
      }

      return {
        key,
        label: key === "(root)" ? "/ (root)" : `/${key}`,
        segmentCount,
        endpoints: sorted,
        count: sorted.length,
        active,
        disabled,
        lastCrawl,
        avgConfidence,
        depthBreakdown,
        discoveryMode,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function isDiscoverySelectable(ep) {
  return ep.assessmentStatus === "discovered" || ep.assessmentStatus === "good";
}

export function computeBfsDepthBreakdown(endpoints) {
  const counts = {};
  let unknown = 0;
  for (const ep of endpoints) {
    const d = ep.bfsDepth;
    if (Number.isFinite(d)) {
      counts[d] = (counts[d] || 0) + 1;
    } else {
      unknown += 1;
    }
  }
  return { counts, unknown };
}

export function getBfsDepthFilterOptions(maxDepth = 2) {
  const cap = Math.max(1, Number(maxDepth) || 2);
  const options = [{ value: "all", label: "All depths" }];
  for (let i = 1; i <= cap; i += 1) {
    options.push({
      value: String(i),
      label: i === 1 ? "Depth 1 only" : `Up to depth ${i}`,
    });
  }
  return options;
}

export function discoveryEndpointToRow(ep, baseUrl) {
  return {
    id: ep.url,
    url: ep.url,
    parent: ep.parent || "",
    bfsDepth: ep.depth ?? null,
    confidence: ep.confidence,
    classification: ep.classification,
    selected: ep.selected,
    assessmentStatus: ep.assessmentStatus,
    assessmentReason: ep.assessmentReason,
    source: ep.source,
    status: ep.assessmentStatus === "rejected" ? "SUSPENDED" : "ACTIVE",
    pathDepth: getPathDepth(ep.url, baseUrl),
    rootName: "",
    crawlScore: ep.confidence != null ? ep.confidence : 1,
    lastCrawledAt: null,
    totalCrawls: 0,
    notes: "",
    articleCount: 0,
    _discovery: true,
  };
}
