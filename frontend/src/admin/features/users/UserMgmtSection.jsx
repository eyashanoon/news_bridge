export function UserMgmtSection({ title, description, children, className = "" }) {
  return (
    <section className={`user-mgmt-section ${className}`.trim()}>
      {(title || description) && (
        <header className="user-mgmt-section-header">
          {title ? <h3>{title}</h3> : null}
          {description ? <p>{description}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}
