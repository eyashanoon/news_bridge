import { TrustGauge, BiasSpectrum } from "./TrustWidgets";

function InfoRow({ label, value, href }) {
  if (!value) return null;
  return (
    <div className="verify-info-row">
      <span className="verify-info-label">{label}</span>
      {href ? (
        <a className="verify-info-value verify-info-link" href={href} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      ) : (
        <span className="verify-info-value">{value}</span>
      )}
    </div>
  );
}

export function VerificationPopup({ open, onClose, root, trust, loading, error }) {
  if (!open) return null;

  const meta = trust?.metadata || {};
  const pct = trust?.trustScore ?? 0;
  const gaugeColor = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="verify-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="verify-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-modal-title"
      >
        <header className="verify-modal-header">
          <div>
            <h3 id="verify-modal-title">{trust?.organizationName || root?.name || "Source Verification"}</h3>
            <p className="verify-modal-domain">{root?.baseUrl}</p>
          </div>
          <button type="button" className="verify-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {loading && (
          <div className="verify-modal-loading">
            <div className="verify-spinner" />
            <p>Querying open evaluation APIs…</p>
            <span className="verify-loading-apis">MBFC · Wikipedia · Wikidata</span>
          </div>
        )}

        {!loading && error && (
          <div className="verify-modal-error">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && trust?.found && (
          <div className="verify-modal-body">
            <section className="verify-section verify-trust-section">
              <h4>Trusted News Score</h4>
              <p className="verify-api-tag">via {trust.trustSource || "Media Bias/Fact Check"}</p>
              <TrustGauge trustScore={trust.trustScore} label={trust.trustLabel} size="large" />
              {trust.factualReporting && (
                <p className="verify-factual" style={{ color: gaugeColor }}>
                  Factual reporting: <strong>{trust.factualReporting}</strong>
                </p>
              )}
            </section>

            <section className="verify-section verify-bias-section">
              <h4>Political Bias</h4>
              <p className="verify-api-tag">via {trust.biasSource || "Media Bias/Fact Check"}</p>
              <BiasSpectrum bias={trust.biasLabel} position={trust.biasPosition} />
              {trust.agendaBias && (
                <p className="verify-bias-note">{trust.agendaBias}</p>
              )}
            </section>

            <section className="verify-section verify-info-section">
              <h4>About This Source</h4>
              <p className="verify-api-tag">via {trust.infoSource || "Wikipedia"}</p>
              {trust.siteDescription ? (
                <p className="verify-description">{trust.siteDescription}</p>
              ) : (
                <p className="verify-description muted">No detailed description available from open sources.</p>
              )}
              <div className="verify-info-grid">
                <InfoRow label="Organization" value={trust.organizationName} />
                <InfoRow label="Country" value={meta.wikidataCountry} />
                <InfoRow label="Founded" value={meta.wikidataInceptionYear ? String(meta.wikidataInceptionYear) : null} />
                <InfoRow label="Domain age" value={trust.domainAgeYears ? `${trust.domainAgeYears} years` : null} />
                <InfoRow label="Web rank" value={meta.trancoRank ? `#${meta.trancoRank} globally` : null} />
                <InfoRow label="Wikipedia" value={meta.wikipediaUrl ? "View article" : null} href={meta.wikipediaUrl} />
                <InfoRow label="MBFC review" value={meta.mbfcReviewUrl ? "Full rating" : null} href={meta.mbfcReviewUrl} />
              </div>
            </section>
          </div>
        )}

        {!loading && !error && trust && !trust.found && (
          <div className="verify-modal-error">
            <p>{trust.description || "This domain was not found in open evaluation databases."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
