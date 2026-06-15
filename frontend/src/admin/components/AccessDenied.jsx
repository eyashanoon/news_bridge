export function AccessDenied({ message = "You do not have permission to view this section." }) {
  return (
    <div className="admin-panel-container">
      <div className="admin-error" style={{ marginTop: "1rem" }}>
        {message}
      </div>
    </div>
  );
}
