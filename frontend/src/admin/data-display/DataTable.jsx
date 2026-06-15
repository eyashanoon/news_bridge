export function DataTable({
  columns,
  data,
  rowKey = "id",
  emptyMessage = "No records found",
  rowClassName,
  children,
}) {
  if (children) {
    return <div className="admin-table-wrap">{children}</div>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={col.key ?? (typeof col.header === "string" ? col.header : `col-${idx}`)}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-row">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row[rowKey] ?? row.id}
                className={typeof rowClassName === "function" ? rowClassName(row) : rowClassName || ""}
              >
                {columns.map((col, idx) => (
                  <td key={col.key ?? (typeof col.header === "string" ? col.header : `col-${idx}`)} className={col.className || ""}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
