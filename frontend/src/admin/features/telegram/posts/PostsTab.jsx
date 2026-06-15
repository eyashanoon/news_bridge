import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../../data-display/DataTable";
import { FilterBar } from "../../../data-display/FilterBar";
import { SearchInput } from "../../../data-display/SearchInput";
import { TablePagination } from "../../../data-display/TablePagination";
import { Button } from "../../../design-system/Button";
import { useConfirmDialog } from "../../../hooks/useConfirmDialog";
import {
  searchAdminPosts,
  deleteTelegramPost,
  retagPost,
  listTelegramChannels,
} from "../../../services/telegramService";

export function PostsTab({ session }) {
  const [data, setData] = useState({ content: [], totalPages: 0, number: 0, totalElements: 0 });
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useConfirmDialog();

  const [filters, setFilters] = useState({
    q: "",
    channelId: "",
    tag: "",
    mediaType: "",
    sort: "newest",
    page: 0,
    size: 20,
  });

  useEffect(() => {
    listTelegramChannels(session.token).then(setChannels).catch(() => {});
  }, [session.token]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { ...filters };
    if (params.channelId) params.channelId = Number(params.channelId);
    else delete params.channelId;
    searchAdminPosts(session.token, params)
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || "Failed to load posts"))
      .finally(() => setLoading(false));
  }, [session.token, filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 0 }));

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this Telegram post?");
    if (!ok) return;
    await deleteTelegramPost(session.token, id);
    load();
  };

  const columns = [
    {
      key: "preview",
      header: "Post",
      render: (row) => (
        <Link to={`/admin/telegram/posts/${row.id}`} className="tg-table-link">
          <div className="tg-post-preview-cell">{row.contentPreview || <em>No content</em>}</div>
        </Link>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (r) => `@${r.channelUsername}`,
    },
    {
      key: "date",
      header: "Date",
      render: (r) => (r.messageDate ? new Date(r.messageDate).toLocaleString() : "—"),
    },
    { key: "views", header: "Views", render: (r) => r.viewCount },
    {
      key: "media",
      header: "Media",
      render: (r) => r.mediaType || "text",
    },
    {
      key: "tags",
      header: "Tags",
      render: (r) => (
        <div className="tg-tag-chips">
          {(r.tags || []).slice(0, 4).map((t) => (
            <span key={t} className="tg-tag-chip">{t}</span>
          ))}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "action-cell",
      render: (row) => (
        <div className="tg-row-actions">
          <Button size="small" onClick={() => retagPost(session.token, row.id).then(load)}>Retag</Button>
          <Button size="small" variant="danger" onClick={() => handleDelete(row.id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="tg-tab-panel">
      {error && <div className="admin-error">{error}</div>}
      <FilterBar className="admin-filters-row admin-filters-extended">
        <SearchInput value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Search content…" />
        <select value={filters.channelId} onChange={(e) => setFilter("channelId", e.target.value)}>
          <option value="">All channels</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>@{c.channelUsername}</option>
          ))}
        </select>
        <input type="text" placeholder="Tag" value={filters.tag} onChange={(e) => setFilter("tag", e.target.value)} />
        <select value={filters.mediaType} onChange={(e) => setFilter("mediaType", e.target.value)}>
          <option value="">All media</option>
          <option value="photo">Photo</option>
          <option value="video">Video</option>
        </select>
        <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
          <option value="newest">Newest</option>
          <option value="most_viewed">Most viewed</option>
          <option value="engagement">Highest engagement</option>
        </select>
      </FilterBar>

      {loading ? (
        <div className="admin-loading-state">Loading posts…</div>
      ) : (
        <>
          <DataTable columns={columns} data={data.content || []} emptyMessage="No posts found" />
          <TablePagination
            page={data.number ?? 0}
            totalPages={data.totalPages ?? 0}
            total={data.totalElements}
            pageSize={filters.size}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          />
        </>
      )}
      {Dialog}
    </div>
  );
}
