import { StatCard } from "../../design-system/StatCard";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

export function RootAnalytics({ rootAnalytics = [] }) {
  if (!rootAnalytics.length) {
    return <p className="admin-muted">No root analytics available.</p>;
  }

  return (
    <div className="sources-root-analytics">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Root</th>
              <th>Total</th>
              <th>Active</th>
              <th>Disabled</th>
              <th>Avg depth</th>
              <th>Last endpoint added</th>
              <th>Crawl success</th>
              <th>Never crawled</th>
            </tr>
          </thead>
          <tbody>
            {rootAnalytics.map((r) => (
              <tr key={r.rootId}>
                <td>{r.rootName}</td>
                <td>{r.totalEndpoints}</td>
                <td>{r.activeEndpoints}</td>
                <td>{r.disabledEndpoints}</td>
                <td>{r.averageDiscoveryDepth}</td>
                <td>{formatDate(r.lastEndpointAddedAt)}</td>
                <td>{r.crawlSuccessRate}%</td>
                <td>{r.crawlFailureRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-kpi-row" style={{ marginTop: 16 }}>
        {rootAnalytics.slice(0, 4).map((r) => (
          <StatCard
            key={r.rootId}
            label={`${r.rootName} (${r.activeEndpoints} active)`}
            value={r.totalEndpoints}
            small
          />
        ))}
      </div>
    </div>
  );
}
