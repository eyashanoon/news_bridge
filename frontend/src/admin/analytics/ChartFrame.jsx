export function ChartFrame({ title, description, expanded = false, children, className = "" }) {
  const showTitle = expanded && title;
  const showMeta = showTitle || description;

  return (
    <div className={`admin-chart-frame${expanded ? " admin-chart-frame-expanded" : ""} ${className}`.trim()}>
      {showMeta ? (
        <div className="admin-chart-frame-meta">
          {showTitle ? <h4 className="admin-chart-frame-title">{title}</h4> : null}
          {description ? <p className="admin-chart-frame-description">{description}</p> : null}
        </div>
      ) : null}
      <div className="admin-chart-frame-plot">{children}</div>
    </div>
  );
}
