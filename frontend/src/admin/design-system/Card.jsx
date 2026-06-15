export function Card({ children, className = "" }) {
  return <div className={`admin-stat-card ${className}`.trim()}>{children}</div>;
}
