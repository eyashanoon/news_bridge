import { Button } from "../design-system/Button";

export function TablePagination({
  page,
  totalPages,
  total,
  onPageChange,
  pageSize = 20,
}) {
  if (totalPages <= 1 && total === undefined) return null;

  const from = total != null ? page * pageSize + 1 : null;
  const to = total != null ? Math.min((page + 1) * pageSize, total) : null;

  return (
    <div className="admin-pagination-row">
      <span>
        {total != null
          ? `Showing ${from}–${to} of ${total}`
          : `Page ${page + 1} of ${Math.max(totalPages, 1)}`}
      </span>
      <div className="action-cell">
        <Button size="small" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button
          size="small"
          disabled={totalPages > 0 ? page >= totalPages - 1 : false}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
