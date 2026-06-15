export function AdminPageHeader({ title, subtitle }) {
  if (!title && !subtitle) return null;
  return (
    <div className="admin-page-header">
      {title ? <h2>{title}</h2> : null}
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}
