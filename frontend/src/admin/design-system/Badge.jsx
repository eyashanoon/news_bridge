export function Badge({ children, tone = "default", className = "" }) {
  const toneClass =
    tone === "approved" || tone === "active"
      ? "approved"
      : tone === "rejected" || tone === "suspended"
        ? "rejected"
        : tone === "pending"
          ? "pending"
          : children?.toString?.().toLowerCase?.() || "default";

  return (
    <span className={`status-badge ${toneClass} ${className}`.trim()}>
      {children}
    </span>
  );
}
