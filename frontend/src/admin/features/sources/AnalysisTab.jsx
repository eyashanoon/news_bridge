import { useCallback, useEffect, useState } from "react";
import { getEndpointAnalytics, listRoots } from "../../services/sourcesService";
import { EndpointAnalytics } from "./EndpointAnalytics";
import { RootAnalytics } from "./RootAnalytics";

export function AnalysisTab({ session }) {
  const [analytics, setAnalytics] = useState(null);
  const [roots, setRoots] = useState([]);
  const [rootFilter, setRootFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getEndpointAnalytics(session.token, rootFilter ? Number(rootFilter) : undefined);
      setAnalytics(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [session.token, rootFilter]);

  useEffect(() => {
    listRoots(session.token).then(setRoots).catch(() => {});
  }, [session.token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="sources-analysis-tab">
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-filters-row">
        <select className="admin-select" value={rootFilter} onChange={(e) => setRootFilter(e.target.value)}>
          <option value="">All roots</option>
          {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button type="button" className="admin-btn small" onClick={load}>Refresh</button>
      </div>

      <EndpointAnalytics analytics={analytics} loading={loading} />

      <h3 style={{ marginTop: 24 }}>Per-root breakdown</h3>
      <RootAnalytics rootAnalytics={analytics?.rootAnalytics} />
    </div>
  );
}
