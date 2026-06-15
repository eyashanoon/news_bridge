import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, authConfig } from "../../services/adminApi";
import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { AdminChartCard } from "../../design-system/AdminChartCard";
import { Card } from "../../design-system/Card";
import { PageShell } from "../../design-system/PageShell";
import { StatCard } from "../../design-system/StatCard";
import { Tabs } from "../../design-system/Tabs";
import { BarChart, DonutChart, LineChart } from "../../analytics";
import { DataTable } from "../../data-display/DataTable";
import { FilterBar } from "../../data-display/FilterBar";
import { SearchInput } from "../../data-display/SearchInput";
import { TablePagination } from "../../data-display/TablePagination";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { hasRole } from "../../utils/roles";
import { resolveAvatar, displayNameFromEmail } from "../../utils/avatars";
import { EDITOR_ROLE_OPTIONS } from "../../constants/roles";
import { PERMISSION_GROUPS } from "../../constants/permissionGroups";
import {
  getEditorById,
  getEditorProfileAnalytics,
  getEditorContent,
  getEditorActivity,
  suspendEditor,
  activateEditor,
  promoteEditor,
  assignCategories,
  updateEditorRoles,
  deleteEditor,
} from "../../services/editorService";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "content", label: "Content" },
  { id: "performance", label: "Performance" },
  { id: "permissions", label: "Permissions" },
];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusTone(status) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "SUSPENDED") return "suspended";
  if (s === "PENDING") return "pending";
  return "default";
}

export function EditorDetailWorkspace({ session, editorId }) {
  const navigate = useNavigate();
  const canManage = hasRole(session, "MANAGE_USERS");
  const [tab, setTab] = useState("overview");
  const [editor, setEditor] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activity, setActivity] = useState([]);
  const [content, setContent] = useState({ items: [], total: 0, page: 0, totalPages: 1 });
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodDays, setPeriodDays] = useState(30);
  const [contentSearch, setContentSearch] = useState("");
  const [contentType, setContentType] = useState("");
  const [contentPage, setContentPage] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [editRoles, setEditRoles] = useState([]);
  const [editingRoles, setEditingRoles] = useState(false);
  const debouncedContentSearch = useDebouncedValue(contentSearch, 300);
  const { askConfirm, Dialog } = useConfirmDialog();

  const loadEditor = useCallback(async () => {
    try {
      const data = await getEditorById(session.token, editorId);
      setEditor(data);
      setSelectedCategories(data.assignedCategoryIds || []);
      setEditRoles([...(data.roles || [])]);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load editor");
    }
  }, [session.token, editorId]);

  useEffect(() => {
    setLoading(true);
    loadEditor().finally(() => setLoading(false));
  }, [loadEditor]);

  useEffect(() => {
    if (tab === "performance") {
      getEditorProfileAnalytics(session.token, editorId, periodDays)
        .then(setAnalytics)
        .catch(() => {});
    }
  }, [session.token, editorId, periodDays, tab]);

  useEffect(() => {
    if (tab === "activity") {
      getEditorActivity(session.token, editorId)
        .then(setActivity)
        .catch(() => setActivity([]));
    }
  }, [session.token, editorId, tab]);

  useEffect(() => {
    if (tab === "content") {
      getEditorContent(session.token, editorId, {
        search: debouncedContentSearch || undefined,
        type: contentType || undefined,
        page: contentPage,
        size: 15,
      }).then(setContent).catch(() => {});
    }
  }, [session.token, editorId, tab, debouncedContentSearch, contentType, contentPage]);

  useEffect(() => {
    if (showCategoryPicker && fields.length === 0) {
      api.get("/api/fields", authConfig(session.token))
        .then((r) => setFields(r.data || []))
        .catch(() => {});
    }
  }, [showCategoryPicker, fields.length, session.token]);

  const handleSuspend = async () => {
    const ok = await askConfirm(`Suspend editor ${editor.email}?`);
    if (!ok) return;
    await suspendEditor(session.token, editorId);
    await loadEditor();
  };

  const handleActivate = async () => {
    const ok = await askConfirm(`Activate editor ${editor.email}?`);
    if (!ok) return;
    await activateEditor(session.token, editorId);
    await loadEditor();
  };

  const handlePromote = async () => {
    const ok = await askConfirm(`Promote ${editor.email} to Senior level?`);
    if (!ok) return;
    await promoteEditor(session.token, editorId);
    await loadEditor();
  };

  const handleDelete = async () => {
    const ok = await askConfirm(`Permanently remove editor ${editor.email}?`);
    if (!ok) return;
    await deleteEditor(session.token, editorId);
    navigate("/admin/editors");
  };

  const handleAssignCategories = async () => {
    const ok = await askConfirm("Update assigned categories for this editor?");
    if (!ok) return;
    try {
      await assignCategories(session.token, editorId, selectedCategories);
      setShowCategoryPicker(false);
      await loadEditor();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign categories");
    }
  };

  const handleResetRoles = async () => {
    const ok = await askConfirm("Reset editor to default junior roles?");
    if (!ok) return;
    const defaultRoles = ["READ_ARTICLE", "MANAGE_OWN_PROFILE", "PUBLISH_LIVE_NEWS"];
    await updateEditorRoles(session.token, editorId, defaultRoles);
    setEditingRoles(false);
    await loadEditor();
  };

  const handleSaveRoles = async () => {
    const ok = await askConfirm("Save updated role assignments?");
    if (!ok) return;
    await updateEditorRoles(session.token, editorId, editRoles);
    setEditingRoles(false);
    await loadEditor();
  };

  const toggleRole = (role) => {
    setEditRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const toggleCategory = (id) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  if (loading) return <div className="admin-loading-state">Loading editor profile…</div>;
  if (error && !editor) return <div className="admin-error">{error}</div>;
  if (!editor) return null;

  const displayName = editor.fullName || editor.username || displayNameFromEmail(editor.email);

  const contentColumns = [
    { key: "type", header: "Type", render: (r) => <Badge>{r.type}</Badge> },
    { key: "title", header: "Title", render: (r) => r.title || "—" },
    { key: "context", header: "Context", render: (r) => r.contextLabel || "—" },
    { key: "status", header: "Status", render: (r) => <Badge tone="active">{r.status}</Badge> },
    { key: "engagement", header: "Engagement", render: (r) => r.engagement ?? 0 },
    { key: "created", header: "Created", render: (r) => formatDate(r.createdAt) },
  ];

  const activityColumns = [
    { key: "type", header: "Type", render: (r) => <Badge>{r.type}</Badge> },
    { key: "label", header: "Action", render: (r) => r.label },
    { key: "detail", header: "Detail", render: (r) => r.detail || "—" },
    { key: "time", header: "When", render: (r) => formatDate(r.timestamp) },
  ];

  const effectivePermissions = PERMISSION_GROUPS.filter((g) =>
    g.roles.some((r) => (editor.roles || []).includes(r)),
  );

  const categoryChart = (analytics?.categoryDistribution || []).map((c) => ({
    label: c.tag,
    value: c.averageWeight ?? 1,
  }));

  return (
    <PageShell
      breadcrumbs={<Link to="/admin/editors">← Editors</Link>}
      title={
        <span className="admin-cell-user">
          <img className="avatar-circle" src={resolveAvatar(editor.profilePicture, "editor")} alt="" />
          <span>{displayName}</span>
        </span>
      }
      subtitle={editor.email}
      actions={
        canManage && (
          <div className="tg-detail-actions">
            {editor.status !== "SUSPENDED" ? (
              <Button size="small" variant="danger" onClick={handleSuspend}>Suspend</Button>
            ) : (
              <Button size="small" onClick={handleActivate}>Activate</Button>
            )}
            <Button size="small" onClick={handlePromote}>Promote</Button>
            <Button size="small" onClick={() => setShowCategoryPicker(true)}>Assign Categories</Button>
            <Button size="small" variant="danger" onClick={handleDelete}>Remove</Button>
          </div>
        )
      }
      tabs={<Tabs items={TABS} activeId={tab} onChange={setTab} className="admin-mgmt-tabs" />}
    >
      {error && <div className="admin-error">{error}</div>}

      {tab === "overview" && (
        <div className="admin-detail-grid">
          <Card>
            <h4>Profile</h4>
            <div className="profile-lines">
              <p><strong>Status:</strong> <Badge tone={statusTone(editor.status)}>{editor.status}</Badge></p>
              <p><strong>Role Level:</strong> {editor.roleLevel || "Junior"}</p>
              <p><strong>Assigned Categories:</strong> {editor.fieldName || "—"}</p>
              <p><strong>Join Date:</strong> {formatDate(editor.createdAt)}</p>
              <p><strong>Last Activity:</strong> {formatDate(editor.lastActivityAt)}</p>
              <p><strong>Phone:</strong> {editor.phone || "—"}</p>
              <p><strong>Experience:</strong> {editor.experience || "—"}</p>
              <p><strong>Contributions:</strong> {editor.contributionCount ?? 0}</p>
              <p><strong>Live Posts:</strong> {editor.livePostCount ?? 0}</p>
              <p><strong>Topic Posts:</strong> {editor.topicPostCount ?? 0}</p>
            </div>
          </Card>
          <Card>
            <h4>Approval & Onboarding</h4>
            <p><strong>Approval Status:</strong> <Badge tone={statusTone(editor.approvalStatus)}>{editor.approvalStatus}</Badge></p>
            {editor.editorRequestId ? (
              <p>
                This editor was approved via{" "}
                <Link to="/admin/editor-requests">request #{editor.editorRequestId}</Link>
              </p>
            ) : (
              <p className="admin-empty-hint">No linked editor request found.</p>
            )}
            {(editor.attachments || []).length > 0 && (
              <div>
                <p><strong>Attachments:</strong></p>
                <div className="profile-attachments">
                  {editor.attachments.map((a, idx) => (
                    <a key={idx} href={a} target="_blank" rel="noopener noreferrer">Attachment {idx + 1}</a>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Card>
            <h4>Roles</h4>
            <div className="role-tags">
              {(editor.roles || []).map((r) => <span key={r} className="role-tag">{r}</span>)}
            </div>
          </Card>
        </div>
      )}

      {tab === "activity" && (
        <Card>
          <h4>Editor Engagement Timeline</h4>
          <DataTable columns={activityColumns} data={activity} emptyMessage="No activity recorded yet" />
        </Card>
      )}

      {tab === "content" && (
        <>
          <FilterBar className="admin-filters-row">
            <SearchInput
              value={contentSearch}
              onChange={(e) => { setContentSearch(e.target.value); setContentPage(0); }}
              placeholder="Search content…"
              className="admin-search admin-search-inline"
            />
            <select className="admin-select" value={contentType} onChange={(e) => { setContentType(e.target.value); setContentPage(0); }}>
              <option value="">All types</option>
              <option value="LIVE_POST">Live Posts</option>
              <option value="TOPIC_POST">Topic Posts</option>
            </select>
          </FilterBar>
          <DataTable columns={contentColumns} data={content.items || []} emptyMessage="No content created yet" />
          <TablePagination
            page={content.page ?? contentPage}
            totalPages={content.totalPages ?? 1}
            total={content.total ?? 0}
            pageSize={15}
            onPageChange={setContentPage}
          />
        </>
      )}

      {tab === "performance" && (
        <>
          <div className="admin-analytics-toolbar">
            <label>
              Period:
              <select className="admin-select" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
          </div>
          {analytics && (
            <>
              <div className="admin-stats-grid admin-stats-grid-compact">
                <StatCard label="Total Content" value={analytics.totalContent ?? 0} color="#0ea5e9" />
                <StatCard label="Live Posts" value={analytics.livePostCount ?? 0} color="#22c55e" />
                <StatCard label="Topic Posts" value={analytics.topicPostCount ?? 0} color="#8b5cf6" />
                <StatCard label="Engagement" value={analytics.totalEngagement ?? 0} color="#f59e0b" />
                <StatCard label="Approval Rate" value={`${Math.round((analytics.approvalRate ?? 0) * 100)}%`} color="#14b8a6" small />
              </div>
              <div className="admin-analytics-grid admin-analytics-grid-compact">
                <AdminChartCard
                  title="Content Output Over Time"
                  description="Number of articles and posts published by this editor per day."
                >
                  {(analytics.contentOverTime || []).length > 0 ? (
                    <LineChart data={analytics.contentOverTime} labelKey="date" valueKey="count" color="#0ea5e9" height={220} />
                  ) : (
                    <p className="admin-empty-hint">No content in this period.</p>
                  )}
                </AdminChartCard>
                <AdminChartCard title="Category Distribution">
                  {categoryChart.length > 0 ? (
                    <DonutChart data={categoryChart} labelKey="label" valueKey="value" size={200} />
                  ) : (
                    <p className="admin-empty-hint">No categories assigned.</p>
                  )}
                </AdminChartCard>
              </div>
              <AdminChartCard
                title="Top Performing Content"
                description="This editor's highest-engagement content ranked by interaction score."
              >
                {(analytics.topPerformingContent || []).length > 0 ? (
                  <BarChart
                    data={(analytics.topPerformingContent || []).map((c) => ({
                      label: (c.title || "Untitled").slice(0, 20),
                      value: c.engagement ?? 0,
                    }))}
                    labelKey="label"
                    valueKey="value"
                    color="#22c55e"
                    height={200}
                  />
                ) : (
                  <p className="admin-empty-hint">No top content yet.</p>
                )}
              </AdminChartCard>
            </>
          )}
        </>
      )}

      {tab === "permissions" && (
        <div className="admin-detail-grid">
          <Card>
            <h4>Assigned Roles</h4>
            {canManage && !editingRoles ? (
              <>
                <div className="role-tags" style={{ marginBottom: "1rem" }}>
                  {(editor.roles || []).map((r) => <span key={r} className="role-tag">{r}</span>)}
                </div>
                <Button size="small" onClick={() => setEditingRoles(true)}>Edit Roles</Button>
                <Button size="small" onClick={handleResetRoles}>Reset Permissions</Button>
              </>
            ) : canManage && editingRoles ? (
              <>
                <div className="role-picker compact admin-inline-role-picker">
                  {EDITOR_ROLE_OPTIONS.map((r) => (
                    <label key={r} className={`role-chip ${editRoles.includes(r) ? "selected" : ""}`}>
                      <input type="checkbox" checked={editRoles.includes(r)} onChange={() => toggleRole(r)} />
                      {r}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: "0.75rem" }}>
                  <Button size="small" variant="primary" onClick={handleSaveRoles}>Save</Button>
                  <Button size="small" onClick={() => { setEditingRoles(false); setEditRoles([...(editor.roles || [])]); }}>Cancel</Button>
                </div>
              </>
            ) : (
              <div className="role-tags">
                {(editor.roles || []).map((r) => <span key={r} className="role-tag">{r}</span>)}
              </div>
            )}
          </Card>
          <Card>
            <h4>Effective Permission Groups</h4>
            {effectivePermissions.length > 0 ? (
              <ul className="admin-permission-list">
                {effectivePermissions.map((g) => (
                  <li key={g.id}>
                    <strong>{g.label}</strong>
                    <p className="admin-cell-muted">{g.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-empty-hint">No elevated permission groups — base editor access only.</p>
            )}
          </Card>
          <Card>
            <h4>Access Scope</h4>
            <ul className="admin-permission-list">
              <li>Can publish live news: {(editor.roles || []).includes("PUBLISH_LIVE_NEWS") ? "Yes" : "No"}</li>
              <li>Can edit live news: {(editor.roles || []).includes("EDIT_LIVE_NEWS") ? "Yes" : "No"}</li>
              <li>Can delete live news: {(editor.roles || []).includes("DELETE_LIVE_NEWS") ? "Yes" : "No"}</li>
              <li>Account status: {editor.status}</li>
            </ul>
          </Card>
        </div>
      )}

      {showCategoryPicker && (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" onClick={() => setShowCategoryPicker(false)}>
          <div className="profile-modal-card admin-profile-card" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Assign Categories</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowCategoryPicker(false)}>×</button>
            </div>
            <div className="profile-modal-body">
              <div className="role-picker compact admin-inline-role-picker">
                {fields.map((f) => (
                  <label key={f.id} className={`role-chip ${selectedCategories.includes(f.id) ? "selected" : ""}`}>
                    <input type="checkbox" checked={selectedCategories.includes(f.id)} onChange={() => toggleCategory(f.id)} />
                    {f.name}
                  </label>
                ))}
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Button size="small" variant="primary" onClick={handleAssignCategories}>Save Categories</Button>
                <Button size="small" onClick={() => setShowCategoryPicker(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {Dialog}
    </PageShell>
  );
}
