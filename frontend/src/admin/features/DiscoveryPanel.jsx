import { useState, useEffect, useRef } from "react";

/* ===================== DISCOVERY PANEL ===================== */
export function DiscoveryPanel({
  root, jobId, status, loading, logs, endpoints,
  outcome, reasons, manualMessage, requiresManualEntry,
  saveMsg, saving, onToggle, onToggleAll, onAdd, onRemove, onSave, onClose,
}) {
  const [customUrl, setCustomUrl] = useState("");
  const [assessing, setAssessing] = useState(false);
  const logRef = useRef(null);
  const savableEndpoints = endpoints.filter(
    (e) => e.assessmentStatus === "discovered" || e.assessmentStatus === "good"
  );
  const selectedCount = endpoints.filter(
    (e) => e.selected && (e.assessmentStatus === "discovered" || e.assessmentStatus === "good")
  ).length;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!customUrl.trim() || assessing) return;
    setAssessing(true);
    try {
      await onAdd(customUrl.trim());
      setCustomUrl("");
    } finally {
      setAssessing(false);
    }
  };

  const outcomeLabels = {
    success: "Discovery Successful",
    partial: "Partial Discovery",
    failed: "Discovery Failed",
  };

  const statusLabel = loading
    ? "Running"
    : status === "completed"
      ? (outcomeLabels[outcome] || "Complete")
      : status === "failed"
        ? "Failed"
        : status || "Idle";

  const outcomeClass = outcome ? `outcome-${outcome}` : "";

  return (
    <div className="discovery-panel">
      <div className="discovery-panel-header">
        <div>
          <h3>
            Endpoint Discovery
            {root && (
              <> — <span className="discovery-root-name">{root.name || root.baseUrl}</span></>
            )}
          </h3>
          <p className="discovery-subtitle">
            {root?.baseUrl || "Select a root and click Discover to start"}
            {jobId && <span className="discovery-job-id"> · Job {jobId.slice(0, 8)}…</span>}
          </p>
        </div>
        <div className="discovery-header-actions">
          <span className={`discovery-status-badge status-${statusLabel.toLowerCase().replace(/\s+/g, "-")} ${outcomeClass}`}>
            {statusLabel}
          </span>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {!loading && status === "completed" && outcome && (
        <div className={`discovery-outcome-banner ${outcomeClass}`}>
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
              {loading ? "Waiting for log output…" : "No logs yet. Click Discover on a root to begin."}
            </span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="discovery-log-line">{line}</div>
            ))
          )}
          {loading && <div className="discovery-log-line discovery-log-cursor">▌</div>}
        </div>
      </div>

      {loading && (
        <div className="discovery-loading">
          <div className="discovery-spinner" />
          <span>Crawling domain and classifying pages — this may take several minutes…</span>
        </div>
      )}

      {!loading && endpoints.length === 0 && status === "completed" && !requiresManualEntry && (
        <p className="discovery-empty">No listing endpoints discovered for this domain.</p>
      )}

      {(endpoints.length > 0 || (status === "completed" && requiresManualEntry)) && (
        <>
          {endpoints.length > 0 && (
            <>
              <div className="discovery-controls-row">
                <span className="discovery-count">
                  {selectedCount} / {savableEndpoints.length} savable selected
                  {endpoints.length !== savableEndpoints.length && (
                    <span className="discovery-count-muted">
                      {" "}({endpoints.length - savableEndpoints.length} rejected)
                    </span>
                  )}
                </span>
                <button className="admin-btn small" onClick={() => onToggleAll(true)}>Select All Good</button>
                <button className="admin-btn small" onClick={() => onToggleAll(false)}>Deselect All</button>
              </div>

              <div className="discovery-endpoints-table-wrap">
                <table className="discovery-endpoints-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Endpoint URL</th>
                      <th>Found From (Parent)</th>
                      <th>Confidence</th>
                      <th>Assessment</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((ep) => {
                      const savable = ep.assessmentStatus === "discovered" || ep.assessmentStatus === "good";
                      const statusClass = ep.assessmentStatus || "pending";
                      return (
                        <tr key={ep.url} className={ep.selected && savable ? "selected" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              checked={ep.selected}
                              disabled={!savable || ep.assessmentStatus === "assessing"}
                              onChange={() => onToggle(ep.url)}
                            />
                          </td>
                          <td className="discovery-ep-url-cell">
                            <a href={ep.url} target="_blank" rel="noopener noreferrer">{ep.url}</a>
                          </td>
                          <td className="discovery-ep-parent-cell">
                            {ep.parent && ep.parent !== "(manually added)" ? (
                              <a href={ep.parent} target="_blank" rel="noopener noreferrer">{ep.parent}</a>
                            ) : (
                              <span className="discovery-ep-no-parent">{ep.parent || "—"}</span>
                            )}
                          </td>
                          <td className="discovery-ep-conf-cell">
                            {ep.confidence != null ? `${(ep.confidence * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className={`discovery-ep-assessment discovery-assess-${statusClass}`}>
                            {ep.assessmentStatus === "assessing" && "Assessing…"}
                            {ep.assessmentStatus === "discovered" && "Auto-discovered"}
                            {ep.assessmentStatus === "good" && "Good for crawling"}
                            {ep.assessmentStatus === "rejected" && "Rejected"}
                            {ep.assessmentReason && (
                              <span className="discovery-assess-detail" title={ep.assessmentReason}>
                                {ep.assessmentReason.length > 60
                                  ? `${ep.assessmentReason.slice(0, 60)}…`
                                  : ep.assessmentReason}
                              </span>
                            )}
                          </td>
                          <td>
                            <button className="discovery-ep-remove" title="Remove from list" onClick={() => onRemove(ep.url)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {(requiresManualEntry || status === "completed") && (
            <form className="discovery-add-row" onSubmit={handleAddCustom}>
              <input
                placeholder="Enter endpoint URL to assess for crawling…"
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

          <div className="discovery-footer">
            <button
              className="admin-btn primary"
              disabled={saving || selectedCount === 0}
              onClick={onSave}
            >
              {saving ? "Saving…" : `Accept & Save ${selectedCount} Endpoint${selectedCount !== 1 ? "s" : ""}`}
            </button>
            <button className="admin-btn small" onClick={onClose}>Back to Roots</button>
          </div>
        </>
      )}
    </div>
  );
}
