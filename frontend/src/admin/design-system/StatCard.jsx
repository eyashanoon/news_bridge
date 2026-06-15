export function StatCard({ label, value, color, small, hint, title }) {
  return (
    <div className="admin-stat-card" title={title}>
      <span className="admin-stat-label">{label}</span>
      <span
        className={`admin-stat-value${small ? " small" : ""}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      {hint ? <span className="user-mgmt-stat-hint">{hint}</span> : null}
    </div>
  );
}
