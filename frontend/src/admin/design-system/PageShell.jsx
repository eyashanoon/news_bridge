export function PageShell({ title, subtitle, actions, tabs, breadcrumbs, children }) {
  return (
    <div className="admin-panel-container">
      {breadcrumbs ? <div className="admin-breadcrumbs">{breadcrumbs}</div> : null}
      {(title || subtitle) && (
        <div className="admin-page-header">
          {title ? <h2>{title}</h2> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      )}
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
      {tabs}
      {children}
    </div>
  );
}
