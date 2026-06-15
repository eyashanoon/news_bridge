/* ===================== BIAS CHIP ===================================== */
const BIAS_COLORS = {
  "Far Left":    { bg: "#1e3a8a", fg: "#fff" },
  "Left":        { bg: "#3b82f6", fg: "#fff" },
  "Center-Left": { bg: "#93c5fd", fg: "#1e3a5f" },
  "Center":      { bg: "#6b7280", fg: "#fff" },
  "Center-Right":{ bg: "#fca5a5", fg: "#7f1d1d" },
  "Right":       { bg: "#ef4444", fg: "#fff" },
  "Far Right":   { bg: "#7f1d1d", fg: "#fff" },
  "Conspiracy":  { bg: "#7c2d12", fg: "#fff" },
  "Fake News":   { bg: "#450a0a", fg: "#fff" },
  "Satire":      { bg: "#6b21a8", fg: "#fff" },
  "Pro-Science": { bg: "#0e7490", fg: "#fff" },
  "Unknown":     { bg: "#374151", fg: "#d1d5db" },
  "Unrated":     { bg: "#374151", fg: "#d1d5db" },
};

export function trustScoreColor(pct) {
  const n = Math.max(0, Math.min(100, pct ?? 0));
  if (n >= 70) return { main: "#4ade80", border: "rgba(34, 197, 94, 0.35)", bg: "rgba(34, 197, 94, 0.12)" };
  if (n >= 40) return { main: "#fbbf24", border: "rgba(245, 158, 11, 0.35)", bg: "rgba(245, 158, 11, 0.12)" };
  return { main: "#f87171", border: "rgba(239, 68, 68, 0.35)", bg: "rgba(239, 68, 68, 0.12)" };
}

export function BiasChip({ bias }) {
  const c = BIAS_COLORS[bias] || BIAS_COLORS["Unknown"];
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: "12px",
      fontSize: "0.67rem", fontWeight: 700,
      backgroundColor: c.bg, color: c.fg, letterSpacing: "0.03em"
    }}>{bias || "Unknown"}</span>
  );
}

/* ===================== BIAS SPECTRUM (popup) ========================= */
export function BiasSpectrum({ bias, position = 0 }) {
  const pct = Math.max(0, Math.min(100, ((position + 100) / 200) * 100));
  return (
    <div className="bias-spectrum">
      <div className="bias-spectrum-labels">
        <span>Left</span>
        <span>Center</span>
        <span>Right</span>
      </div>
      <div className="bias-spectrum-track">
        <div className="bias-spectrum-gradient" />
        <div className="bias-spectrum-marker" style={{ left: `${pct}%` }} title={bias} />
      </div>
      <div className="bias-spectrum-result">
        <BiasChip bias={bias} />
      </div>
    </div>
  );
}

/* ===================== RELIABILITY BAR =============================== */
export function ReliabilityBar({ score }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{width:"100%", maxWidth:130}}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:"0.62rem", color:"#94a3b8", marginBottom:2}}>
        <span>Reliability</span><span>{pct}%</span>
      </div>
      <div style={{height:5, borderRadius:3, background:"#334155", overflow:"hidden"}}>
        <div style={{width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width .4s"}} />
      </div>
    </div>
  );
}

export function TrustGauge({ trustScore, label, size = "normal" }) {
  const pct = Math.max(0, Math.min(100, trustScore ?? 0));
  const color =
    pct >= 70 ? "#22c55e" :
    pct >= 40 ? "#f59e0b" : "#ef4444";

  const angle = (pct / 100) * 180;
  const toRad = (d) => (d * Math.PI) / 180;
  const endX = 60 + 50 * Math.cos(toRad(180 - angle));
  const endY = 60 - 50 * Math.sin(toRad(180 - angle));
  const largeArc = angle > 180 ? 1 : 0;
  const bgD = "M 10 60 A 50 50 0 0 1 110 60";
  const fgD = pct === 0 ? "" : `M 10 60 A 50 50 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;

  const isLarge = size === "large";
  const svgW = isLarge ? 220 : 140;
  const svgH = isLarge ? 128 : 82;
  const fontSize = isLarge ? 28 : 18;
  const strokeW = isLarge ? 14 : 12;

  return (
    <div className={`trust-gauge-wrap ${isLarge ? "trust-gauge-large" : ""}`}>
      <svg viewBox="0 0 120 70" width={svgW} height={svgH}>
        <path d={bgD} fill="none" stroke="#334155" strokeWidth={strokeW} strokeLinecap="round" />
        {fgD && <path d={fgD} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />}
        <text x="60" y="58" textAnchor="middle" fontSize={fontSize} fontWeight="bold" fill={color}>{pct}%</text>
      </svg>
      <div className="trust-label" style={{ color, fontSize: isLarge ? "0.85rem" : undefined }}>{label || "—"}</div>
    </div>
  );
}
