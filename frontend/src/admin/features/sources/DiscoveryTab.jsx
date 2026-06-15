import { useEffect, useRef, useState } from "react";
import { DiscoveryResultsView } from "./DiscoveryResultsView";
import { useDiscoverySession } from "./DiscoverySessionManager";
import { listRoots } from "../../services/sourcesService";
import { canManageEndpoints } from "./sourcesPermissions";

export function DiscoveryTab({ session }) {
  const logRef = useRef(null);
  const [roots, setRoots] = useState([]);
  const [saving, setSaving] = useState(false);
  const canManage = canManageEndpoints(session);

  const {
    rootId,
    rootName,
    rootBaseUrl,
    jobId,
    status,
    loading,
    logs,
    endpoints,
    outcome,
    reasons,
    manualMessage,
    requiresManualEntry,
    saveMsg,
    hasSession,
    error,
    toggleEndpoint,
    toggleAll,
    toggleGroup,
    maxDepth,
    assessUrl,
    removeEndpoint,
    saveSelected,
    clearSession,
    beginDiscovery,
  } = useDiscoverySession();

  useEffect(() => {
    listRoots(session.token).then(setRoots).catch(() => {});
  }, [session.token]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const [customUrl, setCustomUrl] = useState("");
  const [assessing, setAssessing] = useState(false);

  const selectedCount = endpoints.filter(
    (e) => e.selected && (e.assessmentStatus === "discovered" || e.assessmentStatus === "good")
  ).length;

  const handleSave = async () => {
    setSaving(true);
    await saveSelected();
    setSaving(false);
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!customUrl.trim() || assessing) return;
    setAssessing(true);
    try {
      await assessUrl(customUrl.trim());
      setCustomUrl("");
    } finally {
      setAssessing(false);
    }
  };

  const statusLabel = loading
    ? "Running"
    : status === "completed"
      ? "Complete"
      : status === "failed"
        ? "Failed"
        : status || "Idle";

  const activeRoot = roots.find((r) => r.id === rootId);

  return (
    <div className="discovery-panel sources-discovery-tab">
      <div className="discovery-panel-header">
        <div>
          <h3>
            Endpoint Discovery
            {(rootName || activeRoot?.name) && (
              <> — <span className="discovery-root-name">{rootName || activeRoot?.name}</span></>
            )}
          </h3>
          <p className="discovery-subtitle">
            {rootBaseUrl || activeRoot?.baseUrl || "Start discovery from the Roots tab"}
            {jobId && <span className="discovery-job-id"> · Job {jobId.slice(0, 8)}…</span>}
            {hasSession && loading && (
              <span className="roots-subtab-badge" style={{ marginLeft: 8 }}>runs in background</span>
            )}
          </p>
        </div>
        <div className="discovery-header-actions">
          <span className={`discovery-status-badge status-${statusLabel.toLowerCase().replace(/\s+/g, "-")}`}>
            {statusLabel}
          </span>
          {hasSession && (
            <button type="button" className="admin-btn small" onClick={clearSession}>Clear session</button>
          )}
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {!hasSession && (
        <div className="discovery-empty-state">
          <p>No active discovery session. Select a root on the <strong>Roots</strong> tab and click <strong>Discover</strong>.</p>
          {roots.length > 0 && canManage && (
            <div className="admin-filters-row" style={{ marginTop: 12 }}>
              <select
                className="admin-select"
                defaultValue=""
                onChange={async (e) => {
                  const root = roots.find((r) => String(r.id) === e.target.value);
                  if (root) await beginDiscovery(root);
                }}
              >
                <option value="" disabled>Quick start discovery for…</option>
                {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {hasSession && (
        <>
          {!loading && status === "completed" && outcome && (
            <div className={`discovery-outcome-banner outcome-${outcome}`}>
              <div className="discovery-outcome-title">
                {outcome === "success" && "Automatic discovery completed successfully."}
                {outcome === "partial" && "Discovery worked with restrictions."}
                {outcome === "failed" && "This domain could not be discovered automatically."}
              </div>
              {reasons?.length > 0 && (
                <ul className="discovery-outcome-reasons">
                  {reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                </ul>
              )}
              {requiresManualEntry && manualMessage && (
                <p className="discovery-outcome-manual">{manualMessage}</p>
              )}
            </div>
          )}

          <div className="discovery-log-section">
            <div className="discovery-log-header">Discovery Log</div>
            <div className="discovery-log-console" ref={logRef}>
              {logs.length === 0 ? (
                <span className="discovery-log-empty">
                  {loading ? "Waiting for log output…" : "No logs yet."}
                </span>
              ) : (
                logs.map((line, i) => <div key={i} className="discovery-log-line">{line}</div>)
              )}
              {loading && <div className="discovery-log-line discovery-log-cursor">▌</div>}
            </div>
          </div>

          {loading && (
            <div className="discovery-loading">
              <div className="discovery-spinner" />
              <span>Crawling domain — you can switch tabs; discovery continues in the background.</span>
            </div>
          )}

          {(endpoints.length > 0 || (status === "completed" && requiresManualEntry)) && (
            <>
              <DiscoveryResultsView
                endpoints={endpoints}
                rootBaseUrl={rootBaseUrl || activeRoot?.baseUrl}
                maxDepth={maxDepth ?? 2}
                onToggle={toggleEndpoint}
                onToggleAll={toggleAll}
                onToggleGroup={toggleGroup}
                onRemove={removeEndpoint}
              />

              {(requiresManualEntry || status === "completed") && canManage && (
                <form className="discovery-add-row" onSubmit={handleAddCustom}>
                  <input
                    placeholder="Enter endpoint URL to assess…"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="admin-search"
                    disabled={assessing}
                  />
                  <button className="admin-btn small" type="submit" disabled={assessing || !customUrl.trim()}>
                    {assessing ? "Assessing…" : "Assess"}
                  </button>
                </form>
              )}

              {saveMsg && (
                <div className={`discovery-save-msg ${saveMsg.startsWith("Saved") ? "success" : "error"}`}>
                  {saveMsg}
                </div>
              )}

              {canManage && (
                <div className="discovery-footer">
                  <button
                    type="button"
                    className="admin-btn primary"
                    disabled={saving || selectedCount === 0}
                    onClick={handleSave}
                  >
                    {saving ? "Saving…" : `Accept & Save ${selectedCount} Endpoint${selectedCount !== 1 ? "s" : ""}`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
