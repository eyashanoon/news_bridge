import { Link } from "react-router-dom";

export function AdminBreadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="admin-breadcrumb-item">
            {index > 0 && <span className="admin-breadcrumb-sep">/</span>}
            {item.to && !isLast ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span className={isLast ? "admin-breadcrumb-current" : ""}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
