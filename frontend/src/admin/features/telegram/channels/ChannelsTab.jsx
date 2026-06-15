import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../../data-display/DataTable";
import { FilterBar } from "../../../data-display/FilterBar";
import { SearchInput } from "../../../data-display/SearchInput";
import { TablePagination } from "../../../data-display/TablePagination";
import { Button } from "../../../design-system/Button";
import { Badge } from "../../../design-system/Badge";
import ChannelOnboardingModal from "../../../../components/ChannelOnboardingModal";
import { useConfirmDialog } from "../../../hooks/useConfirmDialog";
import {
  searchAdminChannels,
  getChannelCountries,
  updateTelegramChannelStatus,
  deleteTelegramChannel,
  refreshChannelProfile,
} from "../../../services/telegramService";
import { ChannelSearchModal } from "../components/ChannelSearchModal";

export function ChannelsTab({ session, onRefreshKpis }) {
  const [data, setData] = useState({ content: [], totalPages: 0, number: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [onboardingChannel, setOnboardingChannel] = useState(null);
  const { askConfirm, Dialog } = useConfirmDialog();

  const [countries, setCountries] = useState([]);

  const [filters, setFilters] = useState({
    q: "",
    status: "",
    scope: "",
    language: "",
    purpose: "",
    country: "",
    sort: "newest",
    page: 0,
    size: 20,
  });

  useEffect(() => {
    getChannelCountries(session.token).then(setCountries).catch(() => setCountries([]));
  }, [session.token]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    searchAdminChannels(session.token, filters)
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || "Failed to load channels"))
      .finally(() => setLoading(false));
  }, [session.token, filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value, page: 0 }));
  };

  const handleStatus = async (ch, status) => {
    await updateTelegramChannelStatus(session.token, ch.id, status);
    load();
    onRefreshKpis?.();
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this channel and all collected posts?", "Delete Channel");
    if (!ok) return;
    await deleteTelegramChannel(session.token, id);
    load();
    onRefreshKpis?.();
  };

  const columns = [
    {
      key: "name",
      header: "Channel",
      render: (row) => (
        <Link to={`/admin/telegram/channels/${row.id}`} className="tg-table-link">
          <div className="tg-table-channel">
            <span className="tg-channel-avatar sm">
              {row.avatarUrl ? <img src={row.avatarUrl} alt="" /> : (row.displayName?.[0] || "T")}
            </span>
            <div>
              <strong>{row.displayName || row.channelUsername}</strong>
              <div className="tg-muted">@{row.channelUsername}</div>
            </div>
          </div>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge tone={row.status === "ACTIVE" ? "active" : "suspended"}>{row.status}</Badge>
      ),
    },
    { key: "purpose", header: "Purpose", render: (r) => r.purpose || "—" },
    { key: "region", header: "Region", render: (r) => r.region || "—" },
    { key: "language", header: "Lang", render: (r) => r.language || "—" },
    {
      key: "subscribers",
      header: "Subs",
      render: (r) => (r.subscriberCount != null ? r.subscriberCount.toLocaleString() : "—"),
    },
    { key: "posts", header: "Posts", render: (r) => r.totalPostsCollected },
    {
      key: "priority",
      header: "Priority",
      render: (r) => r.crawlPriority?.toFixed(1) ?? "—",
    },
    {
      key: "engagement",
      header: "Engagement",
      render: (r) => r.engagementScore?.toFixed(2) ?? "—",
    },
    {
      key: "health",
      header: "Health",
      render: (r) => r.healthScore?.toFixed(2) ?? "—",
    },
    {
      key: "lastCrawl",
      header: "Last crawl",
      render: (r) => (r.lastCrawledAt ? new Date(r.lastCrawledAt).toLocaleString() : "Never"),
    },
    {
      key: "actions",
      header: "Actions",
      className: "action-cell",
      render: (row) => (
        <div className="tg-row-actions">
          {!row.onboardingCompleted && (
            <Button size="small" onClick={() => setOnboardingChannel(row)}>Onboard</Button>
          )}
          <Button size="small" onClick={() => refreshChannelProfile(session.token, row.id).then(load)}>
            Refresh
          </Button>
          {row.status === "ACTIVE" ? (
            <Button size="small" variant="danger" onClick={() => handleStatus(row, "SUSPENDED")}>Suspend</Button>
          ) : (
            <Button size="small" onClick={() => handleStatus(row, "ACTIVE")}>Activate</Button>
          )}
          <Button size="small" variant="danger" onClick={() => handleDelete(row.id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="tg-tab-panel">
      {error && <div className="admin-error">{error}</div>}
      <div className="tg-tab-toolbar">
        <Button onClick={() => setSearchOpen(true)}>+ Add Channel</Button>
      </div>

      <FilterBar className="admin-filters-row admin-filters-extended">
        <SearchInput
          value={filters.q}
          onChange={(e) => setFilter("q", e.target.value)}
          placeholder="Search name or username…"
        />
        <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={filters.scope} onChange={(e) => setFilter("scope", e.target.value)}>
          <option value="">All regions</option>
          <option value="local">Regional</option>
          <option value="international">International</option>
        </select>
        <select value={filters.purpose} onChange={(e) => setFilter("purpose", e.target.value)}>
          <option value="">All purposes</option>
          <option value="news">News</option>
          <option value="sports">Sports</option>
          <option value="tech">Tech</option>
          <option value="finance">Finance</option>
          <option value="entertainment">Entertainment</option>
        </select>
        <input
          type="text"
          placeholder="Language"
          value={filters.language}
          onChange={(e) => setFilter("language", e.target.value)}
        />
        <select value={filters.country} onChange={(e) => setFilter("country", e.target.value)}>
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
          <option value="newest">Newest</option>
          <option value="most_active">Most active</option>
          <option value="engagement">Highest engagement</option>
          <option value="priority">Highest priority</option>
          <option value="most_posts">Most posts</option>
        </select>
      </FilterBar>

      {loading ? (
        <div className="admin-loading-state">Loading channels…</div>
      ) : (
        <>
          <DataTable columns={columns} data={data.content || []} emptyMessage="No channels match your filters" />
          <TablePagination
            page={data.number ?? 0}
            totalPages={data.totalPages ?? 0}
            total={data.totalElements}
            pageSize={filters.size}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          />
        </>
      )}

      {searchOpen && (
        <ChannelSearchModal
          session={session}
          existingChannels={data.content || []}
          onClose={() => setSearchOpen(false)}
          onAdded={(ch) => { setOnboardingChannel(ch); load(); onRefreshKpis?.(); }}
        />
      )}

      {onboardingChannel && (
        <ChannelOnboardingModal
          channel={onboardingChannel}
          session={session}
          onComplete={() => { setOnboardingChannel(null); load(); }}
          onSkip={() => setOnboardingChannel(null)}
        />
      )}

      {Dialog}
    </div>
  );
}
