/**
 * Renders a URL with the origin and first N path segments visually emphasized.
 * Used when grouping endpoints by path segment.
 */
export function EndpointUrlDisplay({
  url,
  highlightSegments = 0,
  asLink = false,
  className = "",
}) {
  let origin = url;
  let segments = [];
  let suffix = "";

  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    const path = parsed.pathname.replace(/\/$/, "") || "";
    segments = path === "" || path === "/" ? [] : path.split("/").filter(Boolean);
    suffix = `${parsed.search}${parsed.hash}`;
  } catch {
    return <span className={`endpoint-url-display ${className}`}>{url}</span>;
  }

  const highlightCount = Math.max(0, Number(highlightSegments) || 0);
  const highlighted = segments.slice(0, highlightCount);
  const rest = segments.slice(highlightCount);

  const inner = (
    <span className={`endpoint-url-display ${className}`}>
      <span className="endpoint-url-origin">{origin}</span>
      {highlighted.map((seg, i) => (
        <span key={`h-${i}`} className="endpoint-url-seg endpoint-url-seg--highlight">
          /{seg}
        </span>
      ))}
      {rest.map((seg, i) => (
        <span key={`r-${i}`} className="endpoint-url-seg">
          /{seg}
        </span>
      ))}
      {!segments.length && highlightCount > 0 && (
        <span className="endpoint-url-seg endpoint-url-seg--highlight">/</span>
      )}
      {suffix && <span className="endpoint-url-suffix">{suffix}</span>}
    </span>
  );

  if (asLink) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="endpoint-url-link">
        {inner}
      </a>
    );
  }

  return inner;
}

/** Build a canonical sample URL for a segment group header. */
export function buildGroupSampleUrl(endpoints, groupKey) {
  const ep = endpoints?.[0];
  if (!ep?.url) return null;
  try {
    const parsed = new URL(ep.url);
    if (groupKey === "(root)") return `${parsed.origin}/`;
    return `${parsed.origin}/${groupKey}`;
  } catch {
    return null;
  }
}
