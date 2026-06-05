import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "../context/SessionContext";
import { api, authConfig } from "../api";
import { useNavigate } from "react-router-dom";

const ADMIN_ROLES = [
  "OWNER",
  "MANAGE_USERS",
  "VIEW_EDITOR_REQUESTS",
  "APPROVE_EDITOR_REQUESTS",
  "VIEW_EDITOR_INFO",
  "SUSPEND_EDITOR",
  "UPDATE_ANY_ARTICLE",
  "DELETE_ANY_ARTICLE",
  "CREATE_ADMIN",
  "VIEW_CRAWLER_LOGS",
  "CONTROL_CRAWLER",
  "MANAGE_EVENTS",
  "APPROVE_PUBLISH_REQUESTS",
  "MANAGE_TELEGRAM_CHANNELS",
  "VIEW_TELEGRAM_POSTS",
  "CONTROL_TELEGRAM_CRAWLER",
];

const REGISTERED_ROLE_OPTIONS = [
  "READ_ARTICLE",
  "MANAGE_OWN_PROFILE",
  "REACT_POST",
  "LEAVE_COMMENT",
  "REPORT_POST",
  "CREATE_EDITOR_REQUEST",
];

const EDITOR_ROLE_OPTIONS = [
  "READ_ARTICLE",
  "MANAGE_OWN_PROFILE",
  "REACT_POST",
  "LEAVE_COMMENT",
  "REPORT_POST",
  "PUBLISH_LIVE_NEWS",
  "EDIT_LIVE_NEWS",
  "DELETE_LIVE_NEWS",
];

const USER_STATUSES = ["ACTIVE", "PENDING_ACTIVATION", "SUSPENDED"];

function hasRole(session, ...roles) {
  const userRoles = session?.roles || [];
  return roles.some((r) => userRoles.includes(r));
}

const DEFAULT_EDITOR_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%25' height='100%25' fill='%231f2937'/><circle cx='60' cy='44' r='21' fill='%2334d399'/><rect x='24' y='72' width='72' height='32' rx='16' fill='%2310b981'/></svg>";
const DEFAULT_ADMIN_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%25' height='100%25' fill='%230f172a'/><circle cx='60' cy='44' r='21' fill='%2338bdf8'/><rect x='24' y='72' width='72' height='32' rx='16' fill='%232563eb'/></svg>";
const DEFAULT_USER_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%25' height='100%25' fill='%232f3b4f'/><circle cx='60' cy='44' r='21' fill='%2394a3b8'/><rect x='24' y='72' width='72' height='32' rx='16' fill='%2364748b'/></svg>";

function resolveAvatar(src, type = "user") {
  if (src && src.trim()) return src;
  if (type === "admin") return DEFAULT_ADMIN_AVATAR;
  if (type === "editor") return DEFAULT_EDITOR_AVATAR;
  return DEFAULT_USER_AVATAR;
}

function displayNameFromEmail(email) {
  if (!email) return "Unknown";
  return email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function useAdminDialog() {
  const [state, setState] = useState({
    open: false,
    title: "Confirm Action",
    message: "",
    requireText: false,
    expectedText: "",
    inputValue: "",
    resolve: null,
  });

  const askConfirm = (message, title = "Confirm Action") =>
    new Promise((resolve) => {
      setState({
        open: true,
        title,
        message,
        requireText: false,
        expectedText: "",
        inputValue: "",
        resolve,
      });
    });

  const askTypedConfirm = (message, expectedText = "DELETE", title = "Confirm Hard Delete") =>
    new Promise((resolve) => {
      setState({
        open: true,
        title,
        message,
        requireText: true,
        expectedText,
        inputValue: "",
        resolve,
      });
    });

  const closeWith = (value) => {
    if (state.resolve) state.resolve(value);
    setState((prev) => ({ ...prev, open: false, resolve: null, inputValue: "" }));
  };

  const Dialog = state.open ? (
    <div className="confirm-modal-overlay" role="dialog" aria-modal="true">
      <div className="confirm-modal-card">
        <h3>{state.title}</h3>
        <p>{state.message}</p>
        {state.requireText && (
          <div className="confirm-typed-input-wrap">
            <label>Type {state.expectedText} to continue</label>
            <input
              value={state.inputValue}
              onChange={(e) => setState((prev) => ({ ...prev, inputValue: e.target.value }))}
              placeholder={state.expectedText}
            />
          </div>
        )}
        <div className="confirm-modal-actions">
          <button className="admin-btn small" onClick={() => closeWith(false)}>Cancel</button>
          <button
            className="admin-btn small danger"
            disabled={state.requireText && state.inputValue !== state.expectedText}
            onClick={() => closeWith(true)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { askConfirm, askTypedConfirm, Dialog };
}

export default function AdminPage({ target }) {
  const { session } = useSession();

  if (!target) return <DashboardOverview session={session} />;

  return (
    <div className="admin-panel-container">
      {target === "admins" && hasRole(session, "CREATE_ADMIN") && <ManageAdmins session={session} />}
      {target === "users" && hasRole(session, "MANAGE_USERS") && <ManageUsers session={session} />}
      {target === "articles" && hasRole(session, "UPDATE_ANY_ARTICLE", "DELETE_ANY_ARTICLE") && <ManageArticles session={session} />}
      {target === "roots" && hasRole(session, "MANAGE_USERS", "OWNER") && <ManageRoots session={session} />}
      {target === "endpoints" && hasRole(session, "MANAGE_USERS", "OWNER") && <ManageEndpoints session={session} />}
      {target === "editor-requests" && hasRole(session, "VIEW_EDITOR_REQUESTS") && <EditorRequests session={session} />}
      {target === "crawler" && hasRole(session, "VIEW_CRAWLER_LOGS", "CONTROL_CRAWLER") && <ManageCrawler session={session} />}
      {target === "fields" && hasRole(session, "MANAGE_USERS", "APPROVE_EDITOR_REQUESTS") && <ManageFields session={session} />}
      {target === "events" && hasRole(session, "MANAGE_EVENTS", "MANAGE_USERS") && <ManageEvents session={session} />}
      {target === "telegram" && hasRole(session, "MANAGE_TELEGRAM_CHANNELS", "VIEW_TELEGRAM_POSTS", "MANAGE_USERS") && <ManageTelegram session={session} />}
    </div>
  );
}

/* ===================== DASHBOARD OVERVIEW ===================== */
function DashboardOverview({ session }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/api/admin/dashboard/stats", authConfig(session.token))
      .then((res) => setStats(res.data))
      .catch(console.error);
  }, [session.token]);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Dashboard</h2>
        <p>System overview and quick stats</p>
      </div>
      <div className="admin-stats-grid">
        <StatCard label="Total Articles" value={stats?.totalArticles ?? "-"} color="var(--brand)" />
        <StatCard label="Registered Users" value={stats?.totalRegisteredUsers ?? "-"} color="#0f766e" />
        <StatCard label="Editors" value={stats?.totalEditors ?? "-"} color="#7c3aed" />
        <StatCard label="Admins" value={stats?.totalAdmins ?? "-"} color="#b45309" />
        <StatCard label="Pending Requests" value={stats?.pendingEditorRequests ?? "-"} color="#dc2626" />
        <StatCard label="Active Session" value={session?.email || "-"} color="#475569" small />
      </div>
    </div>
  );
}

function StatCard({ label, value, color, small }) {
  return (
    <div className="admin-stat-card">
      <span className="admin-stat-label">{label}</span>
      <span className={`admin-stat-value${small ? " small" : ""}`} style={{ color }}>{value}</span>
    </div>
  );
}

/* ===================== MANAGE ADMINS ===================== */
function ManageAdmins({ session }) {
  const [admins, setAdmins] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", roles: [], profilePicture: "" });
  const [editingId, setEditingId] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [viewingAdmin, setViewingAdmin] = useState(null);
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useAdminDialog();

  const cfg = authConfig(session.token);

  const load = useCallback(() => {
    api.get("/api/admin/users", cfg).then((r) => setAdmins(r.data)).catch(console.error);
  }, [session.token]);

  useEffect(load, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/admin/users", form, cfg);
      setForm({ email: "", password: "", roles: [], profilePicture: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create admin");
    }
  };

  const handleUpdateRoles = async (id) => {
    try {
      await api.put(`/api/admin/users/${id}/roles`, { roles: editRoles }, cfg);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update roles");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this admin account?");
    if (!ok) return;
    try {
      await api.delete(`/api/admin/users/${id}`, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete admin");
    }
  };

  const handleUpdateStatus = async (id) => {
    try {
      await api.put(`/api/admin/users/${id}/status`, { status: editStatus }, cfg);
      setEditingStatusId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const toggleRole = (role, list, setter) => {
    setter(list.includes(role) ? list.filter((r) => r !== role) : [...list, role]);
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Manage Administrators</h2>
        <p>Create admins, assign roles, and manage access</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <button className="admin-btn primary" onClick={() => setShowCreate(!showCreate)}>
        {showCreate ? "Cancel" : "+ New Admin"}
      </button>

      {showCreate && (
        <form className="admin-form" onSubmit={handleCreate}>
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <input placeholder="Profile image URL (optional)" value={form.profilePicture} onChange={(e) => setForm({ ...form, profilePicture: e.target.value })} />
          <div className="role-picker">
            {ADMIN_ROLES.map((r) => (
              <label key={r} className={`role-chip ${form.roles.includes(r) ? "selected" : ""}`}>
                <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r, form.roles, (v) => setForm({ ...form, roles: v }))} />
                {r}
              </label>
            ))}
          </div>
          <button className="admin-btn primary" type="submit">Create Admin</button>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Photo</th><th>Email</th><th>Status</th><th>Roles</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td><img className="avatar-circle" src={resolveAvatar(a.profilePicture, "admin")} alt="admin avatar" /></td>
                <td>{a.email}</td>
                <td>
                  {editingStatusId === a.id ? (
                    <div className="action-cell">
                      <select className="admin-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                        {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button className="admin-btn small primary" onClick={() => handleUpdateStatus(a.id)}>Save</button>
                      <button className="admin-btn small" onClick={() => setEditingStatusId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <span className={`status-badge ${(a.status || "").toLowerCase() === "active" ? "approved" : "rejected"}`}>
                      {a.status || (a.active ? "ACTIVE" : "INACTIVE")}
                    </span>
                  )}
                </td>
                <td>
                  {editingId === a.id ? (
                    <div className="role-picker compact">
                      {ADMIN_ROLES.map((r) => (
                        <label key={r} className={`role-chip ${editRoles.includes(r) ? "selected" : ""}`}>
                          <input type="checkbox" checked={editRoles.includes(r)} onChange={() => toggleRole(r, editRoles, setEditRoles)} />
                          {r}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="role-tags">{[...a.roles].map((r) => <span key={r} className="role-tag">{r}</span>)}</div>
                  )}
                </td>
                <td className="action-cell">
                  {editingId === a.id ? (
                    <>
                      <button className="admin-btn small primary" onClick={() => handleUpdateRoles(a.id)}>Save</button>
                      <button className="admin-btn small" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="admin-btn small" onClick={() => { setEditingId(a.id); setEditRoles([...a.roles]); }}>Edit Roles</button>
                      <button className="admin-btn small" onClick={() => { setEditingStatusId(a.id); setEditStatus(a.status || "ACTIVE"); }}>Edit Status</button>
                      <button className="admin-btn small" onClick={() => setViewingAdmin(a)}>View</button>
                      <button className="admin-btn small danger" onClick={() => handleDelete(a.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {admins.length === 0 && <tr><td colSpan="6" className="empty-row">No admins found</td></tr>}
          </tbody>
        </table>
      </div>

      {Dialog}
      {viewingAdmin && (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewingAdmin(null)}>
          <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Admin Profile</h3>
              <button className="modal-close-btn" onClick={() => setViewingAdmin(null)}>x</button>
            </div>
            <div className="profile-modal-body">
              <img className="profile-avatar-lg" src={resolveAvatar(viewingAdmin.profilePicture, "admin")} alt="admin profile" />
              <div className="profile-lines">
                <p><strong>Name:</strong> {displayNameFromEmail(viewingAdmin.email)}</p>
                <p><strong>Email:</strong> {viewingAdmin.email}</p>
                <p><strong>Status:</strong> {viewingAdmin.status || "ACTIVE"}</p>
                <p><strong>Roles:</strong></p>
                <div className="role-tags">{[...(viewingAdmin.roles || [])].map((r) => <span key={r} className="role-tag">{r}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== MANAGE USERS ===================== */
function ManageUsers({ session }) {
  const [tab, setTab] = useState("registered");
  const [registered, setRegistered] = useState([]);
  const [editors, setEditors] = useState([]);
  const [error, setError] = useState("");
  const [editingRegisteredId, setEditingRegisteredId] = useState(null);
  const [editingEditorId, setEditingEditorId] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [editingRegisteredStatusId, setEditingRegisteredStatusId] = useState(null);
  const [editingEditorStatusId, setEditingEditorStatusId] = useState(null);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingType, setViewingType] = useState("registered");
  const { askConfirm, Dialog } = useAdminDialog();
  const cfg = authConfig(session.token);

  const loadRegistered = useCallback(() => {
    api.get("/api/admin/manage/registered-users", cfg).then((r) => setRegistered(r.data)).catch(console.error);
  }, [session.token]);

  const loadEditors = useCallback(() => {
    api.get("/api/admin/manage/editor-users", cfg).then((r) => setEditors(r.data)).catch(console.error);
  }, [session.token]);

  useEffect(() => { loadRegistered(); loadEditors(); }, [loadRegistered, loadEditors]);

  const toggleRole = (role) => {
    setEditRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const saveRegisteredRoles = async (id) => {
    setError("");
    try {
      await api.put(`/api/admin/manage/registered-users/${id}/roles`, { roles: editRoles }, cfg);
      setEditingRegisteredId(null);
      setEditRoles([]);
      loadRegistered();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update registered user roles");
    }
  };

  const saveEditorRoles = async (id) => {
    setError("");
    try {
      await api.put(`/api/admin/manage/editor-users/${id}/roles`, { roles: editRoles }, cfg);
      setEditingEditorId(null);
      setEditRoles([]);
      loadEditors();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update editor roles");
    }
  };

  const saveRegisteredStatus = async (id) => {
    setError("");
    try {
      await api.put(`/api/admin/manage/registered-users/${id}/status`, { status: editStatus }, cfg);
      setEditingRegisteredStatusId(null);
      loadRegistered();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update registered user status");
    }
  };

  const saveEditorStatus = async (id) => {
    setError("");
    try {
      await api.put(`/api/admin/manage/editor-users/${id}/status`, { status: editStatus }, cfg);
      setEditingEditorStatusId(null);
      loadEditors();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update editor status");
    }
  };

  const deleteRegisteredUser = async (id) => {
    const ok = await askConfirm("Delete this registered user account?");
    if (!ok) return;
    try {
      await api.delete(`/api/admin/manage/registered-users/${id}`, cfg);
      loadRegistered();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete registered user");
    }
  };

  const deleteEditorUser = async (id) => {
    const ok = await askConfirm("Delete this editor account?");
    if (!ok) return;
    try {
      await api.delete(`/api/admin/manage/editor-users/${id}`, cfg);
      loadEditors();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete editor user");
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Manage Users</h2>
        <p>View registered users and editors</p>
      </div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === "registered" ? "active" : ""}`} onClick={() => setTab("registered")}>Registered ({registered.length})</button>
        <button className={`admin-tab ${tab === "editors" ? "active" : ""}`} onClick={() => setTab("editors")}>Editors ({editors.length})</button>
      </div>

      {tab === "registered" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Photo</th><th>Username</th><th>Email</th><th>Status</th><th>Roles</th><th>Actions</th></tr></thead>
            <tbody>
              {registered.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td><img className="avatar-circle" src={resolveAvatar(null, "user")} alt="user avatar" /></td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>
                    {editingRegisteredStatusId === u.id ? (
                      <div className="action-cell">
                        <select className="admin-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                          {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button className="admin-btn small primary" onClick={() => saveRegisteredStatus(u.id)}>Save</button>
                        <button className="admin-btn small" onClick={() => setEditingRegisteredStatusId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <span className={`status-badge ${(u.status || "").toLowerCase() === "active" ? "approved" : "rejected"}`}>
                        {u.status || (u.active ? "ACTIVE" : "INACTIVE")}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingRegisteredId === u.id ? (
                      <div className="role-picker compact">
                        {REGISTERED_ROLE_OPTIONS.map((r) => (
                          <label key={r} className={`role-chip ${editRoles.includes(r) ? "selected" : ""}`}>
                            <input type="checkbox" checked={editRoles.includes(r)} onChange={() => toggleRole(r)} />
                            {r}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="role-tags">{[...(u.roles || [])].map((r) => <span key={r} className="role-tag">{r}</span>)}</div>
                    )}
                  </td>
                  <td className="action-cell">
                    {editingRegisteredId === u.id ? (
                      <>
                        <button className="admin-btn small primary" onClick={() => saveRegisteredRoles(u.id)}>Save</button>
                        <button className="admin-btn small" onClick={() => { setEditingRegisteredId(null); setEditRoles([]); }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="admin-btn small" onClick={() => { setEditingRegisteredId(u.id); setEditingEditorId(null); setEditRoles([...(u.roles || [])]); }}>
                          Edit Roles
                        </button>
                        <button className="admin-btn small" onClick={() => { setEditingRegisteredStatusId(u.id); setEditStatus(u.status || "ACTIVE"); }}>
                          Edit Status
                        </button>
                        <button className="admin-btn small" onClick={() => { setViewingUser(u); setViewingType("registered"); }}>
                          View
                        </button>
                        <button className="admin-btn small danger" onClick={() => deleteRegisteredUser(u.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {registered.length === 0 && <tr><td colSpan="7" className="empty-row">No registered users</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "editors" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Photo</th><th>Username</th><th>Email</th><th>Status</th><th>Field</th><th>Phone</th><th>Roles</th><th>Actions</th></tr></thead>
            <tbody>
              {editors.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td><img className="avatar-circle" src={resolveAvatar(u.profilePicture, "editor")} alt="editor avatar" /></td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>
                    {editingEditorStatusId === u.id ? (
                      <div className="action-cell">
                        <select className="admin-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                          {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button className="admin-btn small primary" onClick={() => saveEditorStatus(u.id)}>Save</button>
                        <button className="admin-btn small" onClick={() => setEditingEditorStatusId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <span className={`status-badge ${(u.status || "").toLowerCase() === "active" ? "approved" : "rejected"}`}>
                        {u.status || (u.active ? "ACTIVE" : "INACTIVE")}
                      </span>
                    )}
                  </td>
                  <td>{u.fieldName || "-"}</td>
                  <td>{u.phone || "-"}</td>
                  <td>
                    {editingEditorId === u.id ? (
                      <div className="role-picker compact">
                        {EDITOR_ROLE_OPTIONS.map((r) => (
                          <label key={r} className={`role-chip ${editRoles.includes(r) ? "selected" : ""}`}>
                            <input type="checkbox" checked={editRoles.includes(r)} onChange={() => toggleRole(r)} />
                            {r}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="role-tags">{[...(u.roles || [])].map((r) => <span key={r} className="role-tag">{r}</span>)}</div>
                    )}
                  </td>
                  <td className="action-cell">
                    {editingEditorId === u.id ? (
                      <>
                        <button className="admin-btn small primary" onClick={() => saveEditorRoles(u.id)}>Save</button>
                        <button className="admin-btn small" onClick={() => { setEditingEditorId(null); setEditRoles([]); }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="admin-btn small" onClick={() => { setEditingEditorId(u.id); setEditingRegisteredId(null); setEditRoles([...(u.roles || [])]); }}>
                          Edit Roles
                        </button>
                        <button className="admin-btn small" onClick={() => { setEditingEditorStatusId(u.id); setEditStatus(u.status || "ACTIVE"); }}>
                          Edit Status
                        </button>
                        <button className="admin-btn small" onClick={() => { setViewingUser(u); setViewingType("editor"); }}>
                          View
                        </button>
                        <button className="admin-btn small danger" onClick={() => deleteEditorUser(u.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {editors.length === 0 && <tr><td colSpan="9" className="empty-row">No editors</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {Dialog}
      {viewingUser && (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewingUser(null)}>
          <div className="profile-modal-card profile-animated" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>{viewingType === "editor" ? "Editor Profile" : "User Profile"}</h3>
              <button className="modal-close-btn" onClick={() => setViewingUser(null)}>x</button>
            </div>
            <div className="profile-modal-body">
              <img
                className="profile-avatar-lg"
                src={resolveAvatar(viewingType === "editor" ? viewingUser.profilePicture : null, viewingType === "editor" ? "editor" : "user")}
                alt="profile"
              />
              <div className="profile-lines">
                <p><strong>Name:</strong> {viewingUser.username || displayNameFromEmail(viewingUser.email)}</p>
                <p><strong>Email:</strong> {viewingUser.email}</p>
                <p><strong>Status:</strong> {viewingUser.status || "ACTIVE"}</p>
                {viewingType === "editor" && <p><strong>Field:</strong> {viewingUser.fieldName || "-"}</p>}
                {viewingType === "editor" && <p><strong>Phone:</strong> {viewingUser.phone || "-"}</p>}
                {viewingType === "editor" && <p><strong>Experience:</strong> {viewingUser.experience || "-"}</p>}
                {viewingType === "editor" && <p><strong>References:</strong> {viewingUser.references || "-"}</p>}
                {viewingType === "editor" && (viewingUser.attachments || []).length > 0 && (
                  <div>
                    <p><strong>Attachments:</strong></p>
                    <div className="profile-attachments">
                      {(viewingUser.attachments || []).map((a, idx) => (
                        <a key={idx} href={a} target="_blank" rel="noopener noreferrer">Attachment {idx + 1}</a>
                      ))}
                    </div>
                  </div>
                )}
                <p><strong>Roles:</strong></p>
                <div className="role-tags">{[...(viewingUser.roles || [])].map((r) => <span key={r} className="role-tag">{r}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== MANAGE ARTICLES ===================== */
/* ===================== MANAGE ARTICLES ===================== */
function ManageArticles({ session }) {
  const [articles, setArticles] = useState([]);
  const [roots, setRoots] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [articlePage, setArticlePage] = useState(0);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleRootId, setArticleRootId] = useState("");
  const [articleEndpointId, setArticleEndpointId] = useState("");
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleTotalPages, setArticleTotalPages] = useState(0);
  const [articleDetail, setArticleDetail] = useState(null);
  const [articleDetailLoading, setArticleDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useAdminDialog();

  const cfg = authConfig(session.token);
  const canUpdate = hasRole(session, "UPDATE_ANY_ARTICLE");
  const canDelete = hasRole(session, "DELETE_ANY_ARTICLE");

  const loadRoots = useCallback(async () => {
    try {
      const res = await api.get(`/roots`, cfg);
      setRoots(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load roots");
    }
  }, [session.token]);

  const loadEndpoints = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (articleRootId) params.set("rootId", articleRootId);
      const res = await api.get(`/endpoints${params.toString() ? `?${params.toString()}` : ""}`, cfg);
      setEndpoints(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load endpoints");
    }
  }, [session.token, articleRootId]);

  const loadArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(articlePage));
      params.set("size", String(20));
      if (articleSearch) params.set("search", articleSearch);
      if (articleRootId) params.set("rootId", articleRootId);
      if (articleEndpointId) params.set("endpointId", articleEndpointId);
      const res = await api.get(`/articles/admin?${params.toString()}`, cfg);
      setArticles(res.data.items || []);
      setArticleTotal(res.data.total || 0);
      setArticleTotalPages(res.data.totalPages || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load articles");
    }
  }, [session.token, articlePage, articleSearch, articleRootId, articleEndpointId]);

  useEffect(() => { loadRoots(); }, [loadRoots]);
  useEffect(() => { loadEndpoints(); }, [loadEndpoints]);
  useEffect(() => { loadArticles(); }, [loadArticles]);

  const loadArticleDetail = async (id) => {
    setArticleDetailLoading(true);
    try {
      const res = await api.get(`/articles/${id}/blocks`, cfg);
      setArticleDetail(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load article details");
    } finally {
      setArticleDetailLoading(false);
    }
  };

  const handleDeleteArticle = async (id) => {
    const ok = await askConfirm("Delete this article permanently?");
    if (!ok) return;
    try {
      await api.delete(`/articles/${id}`, cfg);
      setArticleDetail(null);
      loadArticles();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete article");
    }
  };

  const handleDeleteBlock = async (articleId, blockId) => {
    const ok = await askConfirm("Delete this block from article?");
    if (!ok) return;
    try {
      await api.delete(`/articles/${articleId}/blocks/${blockId}`, cfg);
      loadArticleDetail(articleId);
      loadArticles();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete block");
    }
  };

  const endpointOptions = endpoints.filter((ep) => !articleRootId || String(ep.rootId) === String(articleRootId));

  return (
    <div>
      <div className="admin-page-header">
        <h2>Manage Articles</h2>
        <p>View, edit, and delete article content and blocks</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-filters-row">
        <input
          className="admin-search"
          placeholder="Search title, URL, or content"
          value={articleSearch}
          onChange={(e) => { setArticleSearch(e.target.value); setArticlePage(0); }}
        />
        <select className="admin-select" value={articleRootId} onChange={(e) => { setArticleRootId(e.target.value); setArticleEndpointId(""); setArticlePage(0); }}>
          <option value="">All roots</option>
          {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="admin-select" value={articleEndpointId} onChange={(e) => { setArticleEndpointId(e.target.value); setArticlePage(0); }}>
          <option value="">All endpoints</option>
          {endpointOptions.map((ep) => <option key={ep.id} value={ep.id}>{ep.url}</option>)}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>ID</th><th>Title</th><th>Root</th><th>Endpoint</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td className="title-cell">{a.title || "-"}</td>
                <td>{a.rootName || "-"}</td>
                <td className="url-cell"><a href={a.endpointUrl} target="_blank" rel="noopener noreferrer">{a.endpointUrl?.substring(0, 45)}{a.endpointUrl?.length > 45 ? "..." : ""}</a></td>
                <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "-"}</td>
                <td className="action-cell">
                  <button className="admin-btn small" onClick={() => loadArticleDetail(a.id)}>View</button>
                  {canDelete && <button className="admin-btn small danger" onClick={() => handleDeleteArticle(a.id)}>Delete</button>}
                </td>
              </tr>
            ))}
            {articles.length === 0 && <tr><td colSpan="6" className="empty-row">No articles found</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination-row">
        <span>Page {articlePage + 1} / {Math.max(articleTotalPages, 1)} ({articleTotal} items)</span>
        <div className="action-cell">
          <button className="admin-btn small" disabled={articlePage <= 0} onClick={() => setArticlePage((p) => Math.max(0, p - 1))}>Previous</button>
          <button className="admin-btn small" disabled={articlePage + 1 >= articleTotalPages} onClick={() => setArticlePage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {articleDetail && (
        <ArticleDetailModal article={articleDetail} loading={articleDetailLoading} onClose={() => setArticleDetail(null)} onDelete={handleDeleteArticle} onDeleteBlock={handleDeleteBlock} canUpdate={canUpdate} askConfirm={askConfirm} />
      )}
      {Dialog}
    </div>
  );
}

/* ===================== BIAS CHIP ===================================== */
const BIAS_COLORS = {
  "Far Left":    { bg: "#1e3a8a", fg: "#fff" },
  "Left":        { bg: "#3b82f6", fg: "#fff" },
  "Center-Left": { bg: "#93c5fd", fg: "#1e3a5f" },
  "Center":      { bg: "#6b7280", fg: "#fff" },
  "Center-Right":{ bg: "#fca5a5", fg: "#7f1d1d" },
  "Right":       { bg: "#ef4444", fg: "#fff" },
  "Far Right":   { bg: "#7f1d1d", fg: "#fff" },
  "Unknown":     { bg: "#374151", fg: "#d1d5db" },
};
function BiasChip({ bias }) {
  const c = BIAS_COLORS[bias] || BIAS_COLORS["Unknown"];
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: "12px",
      fontSize: "0.67rem", fontWeight: 700,
      backgroundColor: c.bg, color: c.fg, letterSpacing: "0.03em"
    }}>{bias || "Unknown"}</span>
  );
}

/* ===================== RELIABILITY BAR =============================== */
function ReliabilityBar({ score }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{width:"100%", maxWidth:130}}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:"0.62rem", color:"#94a3b8", marginBottom:2}}>
        <span>Reliability</span><span>{pct}%</span>
      </div>
      <div style={{height:5, borderRadius:3, background:"#334155", overflow:"hidden"}}>
        <div style={{width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width .4s"}} />
      </div>
    </div>
  );
}

function TrustGauge({ trustScore, label }) {
  const pct = Math.max(0, Math.min(100, trustScore ?? 0));
  const color =
    pct >= 70 ? "#22c55e" :
    pct >= 40 ? "#f59e0b" : "#ef4444";

  const angle = (pct / 100) * 180;
  const toRad = (d) => (d * Math.PI) / 180;
  const endX = 60 + 50 * Math.cos(toRad(180 - angle));
  const endY = 60 - 50 * Math.sin(toRad(180 - angle));
  const largeArc = angle > 180 ? 1 : 0;
  const bgD = "M 10 60 A 50 50 0 0 1 110 60";
  const fgD = pct === 0 ? "" : `M 10 60 A 50 50 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;

  return (
    <div className="trust-gauge-wrap">
      <svg viewBox="0 0 120 70" width="140" height="82">
        <path d={bgD} fill="none" stroke="#334155" strokeWidth="12" strokeLinecap="round" />
        {fgD && <path d={fgD} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />}
        <text x="60" y="58" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>{pct}%</text>
      </svg>
      <div className="trust-label" style={{ color }}>{label || "—"}</div>
    </div>
  );
}

/* ===================== MANAGE ROOTS ===================== */
function ManageRoots({ session }) {
  const [roots, setRoots] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ name: "", baseUrl: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState({ name: "", baseUrl: "" });
  const [error, setError] = useState("");

  // trust verification state — keyed by rootId
  const [verifying, setVerifying] = useState({});         // rootId → bool
  const [trustResults, setTrustResults] = useState({});   // rootId → { domainAgeYears, trustScore, reliabilityScore, biasLabel, trustLabel, description, found }

  // discovery state — only one root at a time
  const [rootsSubTab, setRootsSubTab] = useState("list"); // "list" | "discovery"
  const [discoveringId, setDiscoveringId] = useState(null);
  const [discoveryJobId, setDiscoveryJobId] = useState(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState(null);
  const [discoveryLogs, setDiscoveryLogs] = useState([]);
  const [discoveryEndpoints, setDiscoveryEndpoints] = useState([]); // { url, parent, confidence, selected }
  const [savingEndpoints, setSavingEndpoints] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const pollRef = useRef(null);

  const { askConfirm, askTypedConfirm, Dialog } = useAdminDialog();
  const cfg = authConfig(session.token);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchText) params.set("search", searchText);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get(`/roots${params.toString() ? `?${params.toString()}` : ""}`, cfg);
      setRoots(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load roots");
    }
  }, [session.token, searchText, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/roots", form, cfg);
      setForm({ name: "", baseUrl: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create root");
    }
  };

  const handleUpdate = async (id) => {
    setError("");
    try {
      await api.put(`/roots/${id}`, editingForm, cfg);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update root");
    }
  };

  const handleStatus = async (id, status) => {
    setError("");
    try {
      await api.put(`/roots/${id}/status`, { status }, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await askConfirm(`Delete root '${name}' and ALL linked endpoints/articles?`);
    if (!ok) return;
    const typedOk = await askTypedConfirm("This is a hard delete and cannot be undone.", "DELETE");
    if (!typedOk) return;
    setError("");
    try {
      await api.delete(`/roots/${id}?hard=true`, cfg);
      if (discoveringId === id) setDiscoveringId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete root");
    }
  };

  // ── Verify (NewsGuard) ──────────────────────────────────────────────────
  const handleVerify = async (id) => {
    // Clear any previous result so the button shows while loading
    setTrustResults((t) => { const next = { ...t }; delete next[id]; return next; });
    setVerifying((v) => ({ ...v, [id]: true }));
    try {
      const res = await api.post(`/roots/${id}/verify`, {}, cfg);
      setTrustResults((t) => ({ ...t, [id]: { ...res.data, _error: null } }));
    } catch (err) {
      const msg =
        err.response?.status === 404
          ? "Endpoint not found — restart the backend server."
          : err.response?.data?.message || err.message || "Verification failed";
      setTrustResults((t) => ({
        ...t,
        [id]: { found: false, domainAgeYears: null, trustScore: null, reliabilityScore: null,
                 biasLabel: null, trustLabel: null, description: null, _error: msg },
      }));
    } finally {
      setVerifying((v) => ({ ...v, [id]: false }));
    }
  };

  // ── Discover (async job with live logs) ─────────────────────────────────
  const stopPolling = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const pollDiscoveryJob = useCallback(async (rootId, jobId, logOffset) => {
    try {
      const res = await api.get(
        `/roots/${rootId}/discover/jobs/${jobId}?logOffset=${logOffset}`,
        { ...cfg, timeout: 30000 }
      );
      const data = res.data;
      if (data.logs?.length) {
        setDiscoveryLogs((prev) => [...prev, ...data.logs]);
      }
      setDiscoveryStatus(data.status);

      if (data.status === "completed" && data.result) {
        const eps = (data.result.endpoints || []).map((e) => ({
          url: e.url,
          parent: e.parent || "",
          confidence: e.confidence,
          selected: true,
        }));
        setDiscoveryEndpoints(eps);
        setDiscoveryLoading(false);
        stopPolling();
      } else if (data.status === "failed") {
        setError(data.error || "Discovery failed");
        setDiscoveryLoading(false);
        stopPolling();
      } else {
        pollRef.current = setTimeout(
          () => pollDiscoveryJob(rootId, jobId, data.log_count ?? logOffset),
          1500
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to poll discovery job");
      setDiscoveryLoading(false);
      stopPolling();
    }
  }, [cfg]);

  const handleDiscover = async (id) => {
    stopPolling();
    setDiscoveringId(id);
    setRootsSubTab("discovery");
    setDiscoveryJobId(null);
    setDiscoveryEndpoints([]);
    setDiscoveryLogs([]);
    setDiscoveryStatus("pending");
    setSaveMsg("");
    setError("");
    setDiscoveryLoading(true);
    try {
      const res = await api.post(`/roots/${id}/discover`, {}, { ...cfg, timeout: 30000 });
      const jobId = res.data.job_id;
      if (!jobId) throw new Error("Discovery service did not return a job ID");
      setDiscoveryJobId(jobId);
      setDiscoveryLogs([`Job started: ${jobId}`]);
      pollDiscoveryJob(id, jobId, 0);
    } catch (err) {
      setError(err.response?.data?.message || "Discovery failed — is the discovery service running on port 8004?");
      setDiscoveryLoading(false);
    }
  };

  const toggleEndpoint = (url) => {
    setDiscoveryEndpoints((ep) =>
      ep.map((e) => e.url === url ? { ...e, selected: !e.selected } : e)
    );
  };

  const toggleAll = (val) => {
    setDiscoveryEndpoints((ep) => ep.map((e) => ({ ...e, selected: val })));
  };

  const addCustomEndpoint = (url) => {
    if (!url || discoveryEndpoints.some((e) => e.url === url)) return;
    setDiscoveryEndpoints((ep) => [
      ...ep,
      { url, parent: "(manually added)", confidence: null, selected: true },
    ]);
  };

  const removeEndpoint = (url) => {
    setDiscoveryEndpoints((ep) => ep.filter((e) => e.url !== url));
  };

  // ── Save endpoints ──────────────────────────────────────────────────────
  const handleSaveEndpoints = async () => {
    if (!discoveringId) return;
    const urls = discoveryEndpoints.filter((e) => e.selected).map((e) => e.url);
    if (urls.length === 0) {
      setSaveMsg("No endpoints selected.");
      return;
    }
    setSavingEndpoints(true);
    setSaveMsg("");
    try {
      const res = await api.post(`/roots/${discoveringId}/endpoints/bulk`, { urls }, cfg);
      setSaveMsg(`Saved ${res.data.length} new endpoint(s) successfully.`);
    } catch (err) {
      setSaveMsg(err.response?.data?.message || "Failed to save endpoints.");
    } finally {
      setSavingEndpoints(false);
    }
  };

  const discoveringRoot = roots.find((r) => r.id === discoveringId);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Manage Roots (Domains)</h2>
        <p>Configure root domains for content collection</p>
      </div>

      <div className="roots-subtabs">
        <button
          type="button"
          className={`roots-subtab ${rootsSubTab === "list" ? "active" : ""}`}
          onClick={() => setRootsSubTab("list")}
        >
          Roots List
        </button>
        <button
          type="button"
          className={`roots-subtab ${rootsSubTab === "discovery" ? "active" : ""}`}
          onClick={() => setRootsSubTab("discovery")}
          disabled={!discoveringId && discoveryLogs.length === 0}
        >
          Discovery
          {discoveryLoading && <span className="roots-subtab-badge">running</span>}
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {rootsSubTab === "discovery" && (
        <DiscoveryPanel
          root={discoveringRoot}
          jobId={discoveryJobId}
          status={discoveryStatus}
          loading={discoveryLoading}
          logs={discoveryLogs}
          endpoints={discoveryEndpoints}
          saveMsg={saveMsg}
          saving={savingEndpoints}
          onToggle={toggleEndpoint}
          onToggleAll={toggleAll}
          onAdd={addCustomEndpoint}
          onRemove={removeEndpoint}
          onSave={handleSaveEndpoints}
          onClose={() => {
            stopPolling();
            setRootsSubTab("list");
            setDiscoveringId(null);
            setDiscoveryJobId(null);
            setDiscoveryLogs([]);
            setDiscoveryEndpoints([]);
            setDiscoveryStatus(null);
            setSaveMsg("");
          }}
        />
      )}

      {rootsSubTab === "list" && <form className="admin-form" onSubmit={handleCreate}>
        <input placeholder="Root name (e.g., BBC News)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Base URL (https://example.com)" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} required />
        <button className="admin-btn primary" type="submit">Add Root</button>
      </form>}

      {rootsSubTab === "list" && <div className="admin-filters-row">
        <input className="admin-search" placeholder="Search by name or URL" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button className="admin-btn small" onClick={load}>Search</button>
      </div>}

      {rootsSubTab === "list" && <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Base URL</th><th>Status</th>
              <th>Trust Score</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roots.map((r) => {
              const trust = trustResults[r.id];
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    {editingId === r.id
                      ? <input value={editingForm.name} onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })} />
                      : r.name}
                  </td>
                  <td>
                    {editingId === r.id
                      ? <input value={editingForm.baseUrl} onChange={(e) => setEditingForm({ ...editingForm, baseUrl: e.target.value })} />
                      : r.baseUrl}
                  </td>
                  <td>
                    <span className={`status-badge ${(r.status || "").toLowerCase() === "active" ? "approved" : "rejected"}`}>
                      {r.status || "ACTIVE"}
                    </span>
                  </td>
                  <td className="trust-cell">
                    {trust?._error ? (
                      <div className="trust-error-wrap">
                        <span className="trust-error-msg" title={trust._error}>⚠ {trust._error}</span>
                        <button className="admin-btn small" onClick={() => handleVerify(r.id)}>Retry</button>
                      </div>
                    ) : trust?.found ? (
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <TrustGauge trustScore={trust.trustScore} label={trust.trustLabel} />
                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
                          <span style={{fontSize:"0.62rem",color:"#94a3b8"}}>Bias:</span>
                          <BiasChip bias={trust.biasLabel} />
                        </div>
                        <ReliabilityBar score={trust.reliabilityScore} />
                        <span className="trust-hint" style={{fontSize:"0.61rem",textAlign:"center"}}>{trust.description}</span>
                      </div>
                    ) : trust && !trust.found ? (
                      <div className="trust-error-wrap">
                        <span className="trust-not-found">{trust.trustLabel || "Not found"}</span>
                        <span className="trust-hint">{trust.description || "Not found in archive"}</span>
                        <button className="admin-btn small" style={{fontSize:"0.72rem",padding:"2px 8px"}} onClick={() => handleVerify(r.id)}>Retry</button>
                      </div>
                    ) : (
                      <button
                        className="admin-btn small"
                        disabled={!!verifying[r.id]}
                        onClick={() => handleVerify(r.id)}
                      >
                        {verifying[r.id] ? "Verifying…" : "Verify"}
                      </button>
                    )}
                  </td>
                  <td className="action-cell">
                    {editingId === r.id ? (
                      <>
                        <button className="admin-btn small primary" onClick={() => handleUpdate(r.id)}>Save</button>
                        <button className="admin-btn small" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="admin-btn small" onClick={() => { setEditingId(r.id); setEditingForm({ name: r.name, baseUrl: r.baseUrl }); }}>Edit</button>
                        <button
                          className="admin-btn small accent"
                          disabled={discoveryLoading && discoveringId === r.id}
                          onClick={() => handleDiscover(r.id)}
                        >
                          {discoveryLoading && discoveringId === r.id ? "Discovering…" : "Discover"}
                        </button>
                        <button className="admin-btn small" onClick={() => handleStatus(r.id, "SUSPENDED")}>Suspend</button>
                        <button className="admin-btn small" onClick={() => handleStatus(r.id, "ACTIVE")}>Activate</button>
                        <button className="admin-btn small danger" onClick={() => handleDelete(r.id, r.name)}>Hard Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {roots.length === 0 && <tr><td colSpan="6" className="empty-row">No roots found</td></tr>}
          </tbody>
        </table>
      </div>}

      {Dialog}
    </div>
  );
}

/* ===================== DISCOVERY PANEL ===================== */
function DiscoveryPanel({ root, jobId, status, loading, logs, endpoints, saveMsg, saving, onToggle, onToggleAll, onAdd, onRemove, onSave, onClose }) {
  const [customUrl, setCustomUrl] = useState("");
  const logRef = useRef(null);
  const selectedCount = endpoints.filter((e) => e.selected).length;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onAdd(customUrl.trim());
      setCustomUrl("");
    }
  };

  const statusLabel = loading
    ? "Running"
    : status === "completed"
      ? "Complete"
      : status === "failed"
        ? "Failed"
        : status || "Idle";

  return (
    <div className="discovery-panel">
      <div className="discovery-panel-header">
        <div>
          <h3>
            Endpoint Discovery
            {root && (
              <> — <span className="discovery-root-name">{root.name || root.baseUrl}</span></>
            )}
          </h3>
          <p className="discovery-subtitle">
            {root?.baseUrl || "Select a root and click Discover to start"}
            {jobId && <span className="discovery-job-id"> · Job {jobId.slice(0, 8)}…</span>}
          </p>
        </div>
        <div className="discovery-header-actions">
          <span className={`discovery-status-badge status-${statusLabel.toLowerCase()}`}>{statusLabel}</span>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="discovery-log-section">
        <div className="discovery-log-header">Discovery Log</div>
        <div className="discovery-log-console" ref={logRef}>
          {logs.length === 0 ? (
            <span className="discovery-log-empty">
              {loading ? "Waiting for log output…" : "No logs yet. Click Discover on a root to begin."}
            </span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="discovery-log-line">{line}</div>
            ))
          )}
          {loading && <div className="discovery-log-line discovery-log-cursor">▌</div>}
        </div>
      </div>

      {loading && (
        <div className="discovery-loading">
          <div className="discovery-spinner" />
          <span>Crawling domain and classifying pages — this may take several minutes…</span>
        </div>
      )}

      {!loading && endpoints.length === 0 && status === "completed" && (
        <p className="discovery-empty">No listing endpoints discovered for this domain.</p>
      )}

      {endpoints.length > 0 && (
        <>
          <div className="discovery-controls-row">
            <span className="discovery-count">{selectedCount} / {endpoints.length} selected</span>
            <button className="admin-btn small" onClick={() => onToggleAll(true)}>Select All</button>
            <button className="admin-btn small" onClick={() => onToggleAll(false)}>Deselect All</button>
          </div>

          <div className="discovery-endpoints-table-wrap">
            <table className="discovery-endpoints-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Endpoint URL</th>
                  <th>Found From (Parent)</th>
                  <th>Confidence</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((ep) => (
                  <tr key={ep.url} className={ep.selected ? "selected" : ""}>
                    <td>
                      <input type="checkbox" checked={ep.selected} onChange={() => onToggle(ep.url)} />
                    </td>
                    <td className="discovery-ep-url-cell">
                      <a href={ep.url} target="_blank" rel="noopener noreferrer">{ep.url}</a>
                    </td>
                    <td className="discovery-ep-parent-cell">
                      {ep.parent ? (
                        <a href={ep.parent} target="_blank" rel="noopener noreferrer">{ep.parent}</a>
                      ) : (
                        <span className="discovery-ep-no-parent">—</span>
                      )}
                    </td>
                    <td className="discovery-ep-conf-cell">
                      {ep.confidence != null ? `${(ep.confidence * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td>
                      <button className="discovery-ep-remove" title="Remove from list" onClick={() => onRemove(ep.url)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form className="discovery-add-row" onSubmit={handleAddCustom}>
            <input
              placeholder="Add custom endpoint URL…"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="admin-search"
            />
            <button className="admin-btn small" type="submit">Add</button>
          </form>

          {saveMsg && (
            <div className={`discovery-save-msg ${saveMsg.startsWith("Saved") ? "success" : "error"}`}>
              {saveMsg}
            </div>
          )}

          <div className="discovery-footer">
            <button
              className="admin-btn primary"
              disabled={saving || selectedCount === 0}
              onClick={onSave}
            >
              {saving ? "Saving…" : `Accept & Save ${selectedCount} Endpoint${selectedCount !== 1 ? "s" : ""}`}
            </button>
            <button className="admin-btn small" onClick={onClose}>Back to Roots</button>
          </div>
        </>
      )}
    </div>
  );
}


/* ===================== MANAGE ENDPOINTS ===================== */
function ManageEndpoints({ session }) {
  const [endpoints, setEndpoints] = useState([]);
  const [roots, setRoots] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [rootFilter, setRootFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ url: "", rootId: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState({ url: "", rootId: "" });
  const [error, setError] = useState("");
  const { askConfirm, askTypedConfirm, Dialog } = useAdminDialog();

  const cfg = authConfig(session.token);

  const extractDomain = (url) => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  };

  const loadRoots = useCallback(async () => {
    try {
      const res = await api.get(`/roots`, cfg);
      setRoots(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load roots");
    }
  }, [session.token]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (rootFilter) params.set("rootId", rootFilter);
      if (searchText) params.set("search", searchText);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get(`/endpoints${params.toString() ? `?${params.toString()}` : ""}`, cfg);
      setEndpoints(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load endpoints");
    }
  }, [session.token, rootFilter, searchText, statusFilter]);

  useEffect(() => { loadRoots(); }, [loadRoots]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/endpoints", {
        url: form.url,
        rootId: form.rootId ? Number(form.rootId) : null,
      }, cfg);
      setForm({ url: "", rootId: "" });
      load();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create endpoint";
      if (msg.includes("Root for domain") && !form.rootId) {
        const domain = extractDomain(form.url);
        if (!domain) {
          setError(msg);
          return;
        }
        const confirmAddRoot = await askConfirm(`Root for '${domain}' does not exist. Add it now?`);
        if (!confirmAddRoot) {
          setError(msg);
          return;
        }
        try {
          await api.post("/roots", { name: domain, baseUrl: `https://${domain}` }, cfg);
          await api.post("/endpoints", { url: form.url, rootId: null }, cfg);
          setForm({ url: "", rootId: "" });
          loadRoots();
          load();
        } catch (secondErr) {
          setError(secondErr.response?.data?.message || "Failed to auto-create root and endpoint");
        }
        return;
      }
      setError(msg);
    }
  };

  const handleUpdate = async (id) => {
    setError("");
    try {
      await api.put(`/endpoints/${id}`, {
        url: editingForm.url,
        rootId: editingForm.rootId ? Number(editingForm.rootId) : null,
      }, cfg);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update endpoint");
    }
  };

  const handleStatus = async (id, status) => {
    setError("");
    try {
      await api.put(`/endpoints/${id}/status`, { status }, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id, url) => {
    const ok = await askConfirm(`Delete endpoint '${url}' and all related articles?`);
    if (!ok) return;
    const typedOk = await askTypedConfirm("This is a hard delete and cannot be undone.", "DELETE");
    if (!typedOk) return;
    setError("");
    try {
      await api.delete(`/endpoints/${id}?hard=true`, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete endpoint");
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Manage Endpoints</h2>
        <p>Configure content collection endpoints</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <form className="admin-form" onSubmit={handleCreate}>
        <input placeholder="Endpoint URL (https://example.com/news)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required />
        <select value={form.rootId} onChange={(e) => setForm({ ...form, rootId: e.target.value })}>
          <option value="">Auto-detect root from URL domain</option>
          {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="admin-btn primary" type="submit">Add Endpoint</button>
      </form>

      <div className="admin-filters-row">
        <input className="admin-search" placeholder="Search by URL" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        <select className="admin-select" value={rootFilter} onChange={(e) => setRootFilter(e.target.value)}>
          <option value="">All roots</option>
          {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button className="admin-btn small" onClick={load}>Search</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>ID</th><th>URL</th><th>Root</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.id}>
                <td>{ep.id}</td>
                <td>{editingId === ep.id ? <input value={editingForm.url} onChange={(e) => setEditingForm({ ...editingForm, url: e.target.value })} /> : <span className="title-cell">{ep.url}</span>}</td>
                <td>{editingId === ep.id ? <select className="admin-select" value={editingForm.rootId} onChange={(e) => setEditingForm({ ...editingForm, rootId: e.target.value })}><option value="">Auto-detect</option>{roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select> : (roots.find((r) => String(r.id) === String(ep.rootId))?.name || ep.rootId)}</td>
                <td><span className={`status-badge ${(ep.status || "").toLowerCase() === "active" ? "approved" : "rejected"}`}>{ep.status || "ACTIVE"}</span></td>
                <td className="action-cell">
                  {editingId === ep.id ? (
                    <>
                      <button className="admin-btn small primary" onClick={() => handleUpdate(ep.id)}>Save</button>
                      <button className="admin-btn small" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="admin-btn small" onClick={() => { setEditingId(ep.id); setEditingForm({ url: ep.url, rootId: String(ep.rootId || "") }); }}>Edit</button>
                      <button className="admin-btn small" onClick={() => handleStatus(ep.id, "SUSPENDED")}>Suspend</button>
                      <button className="admin-btn small" onClick={() => handleStatus(ep.id, "ACTIVE")}>Activate</button>
                      <button className="admin-btn small danger" onClick={() => handleDelete(ep.id, ep.url)}>Hard Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {endpoints.length === 0 && <tr><td colSpan="5" className="empty-row">No endpoints found</td></tr>}
          </tbody>
        </table>
      </div>
      {Dialog}
    </div>
  );
}

/* ===================== ARTICLE DETAIL MODAL ===================== */
function ArticleDetailModal({ article, loading, onClose, onDelete, onDeleteBlock, canUpdate, askConfirm }) {
  const [view, setView] = useState("view");
  const [selectedBlocks, setSelectedBlocks] = useState(new Set());
  const [modalError, setModalError] = useState("");

  const toggleBlockSelect = (blockId) => {
    const newSet = new Set(selectedBlocks);
    if (newSet.has(blockId)) {
      newSet.delete(blockId);
    } else {
      newSet.add(blockId);
    }
    setSelectedBlocks(newSet);
  };

  const handleDeleteSelected = async () => {
    if (selectedBlocks.size === 0) {
      setModalError("Select at least one block to delete.");
      return;
    }
    const ok = await askConfirm(`Delete ${selectedBlocks.size} block(s)?`);
    if (!ok) return;
    setModalError("");
    for (const blockId of selectedBlocks) {
      await onDeleteBlock(article.articleId, blockId);
    }
    setSelectedBlocks(new Set());
  };

  const renderBlock = (block) => {
    const type = block.blockType;
    const isSelected = selectedBlocks.has(block.id);
    const blockClass = `article-block ${isSelected ? "selected" : ""}`;

    if (view === "view") {
      if (type === "IMAGE" && block.mediaUrl) {
        return (
          <figure key={block.id} className="article-figure">
            <img src={block.mediaUrl} alt={block.altText || "Article image"} />
            {block.altText && <figcaption>{block.altText}</figcaption>}
          </figure>
        );
      }
      if (type === "VIDEO" && block.mediaUrl) {
        return (
          <div key={block.id} className="article-video-embed">
            <video controls src={block.mediaUrl} playsInline></video>
          </div>
        );
      }
      if (["AUDIO", "ATTACHMENT"].includes(type) && block.mediaUrl) {
        return (
          <div key={block.id} className="article-attachment">
            <a href={block.mediaUrl} target="_blank" rel="noopener noreferrer">{block.mediaUrl}</a>
          </div>
        );
      }
      if (type === "TEXT" && block.textContent) {
        return <p key={block.id} className="article-paragraph">{block.textContent}</p>;
      }
    } else {
      // Edit mode
      return (
        <div key={block.id} className={blockClass} onClick={() => toggleBlockSelect(block.id)}>
          <div className="block-header">
            <span>{type} #{block.sortOrder}</span>
            {isSelected && <span className="selected-badge">Selected</span>}
          </div>
          {type === "IMAGE" && block.mediaUrl && <img src={block.mediaUrl} alt={block.altText || "Article image"} />}
          {type === "VIDEO" && block.mediaUrl && <video controls src={block.mediaUrl} playsInline></video>}
          {["AUDIO", "ATTACHMENT"].includes(type) && block.mediaUrl && <a href={block.mediaUrl} target="_blank" rel="noopener noreferrer">{block.mediaUrl}</a>}
          {type === "TEXT" && <p>{block.textContent}</p>}
        </div>
      );
    }
  };

  return (
    <div className="article-modal-overlay" onClick={onClose}>
      <div className="article-modal" onClick={(e) => e.stopPropagation()}>
        <div className="article-modal-header">
          <div className="article-modal-tabs">
            <button className={`modal-tab ${view === "view" ? "active" : ""}`} onClick={() => setView("view")}>View Article</button>
            {canUpdate && <button className={`modal-tab ${view === "edit" ? "active" : ""}`} onClick={() => setView("edit")}>Edit Content</button>}
          </div>
          <button className="modal-close-btn" onClick={onClose}>x</button>
        </div>

        <div className="article-modal-content">
          {loading && <div className="loading">Loading...</div>}
          {!loading && (
            <>
              {modalError && <div className="admin-error">{modalError}</div>}
              <h2 className="article-modal-title">{article.title || "Untitled Article"}</h2>
              <p className="article-modal-meta">Root: {article.rootName || "-"} | Endpoint: {article.endpointUrl || "-"}</p>

              {view === "view" && (
                <div className="article-content">
                  {(article.blocks || []).sort((a, b) => a.sortOrder - b.sortOrder).map(renderBlock)}
                </div>
              )}

              {view === "edit" && (
                <div>
                  <div className="article-blocks-list">
                    {(article.blocks || []).map(renderBlock)}
                    {(article.blocks || []).length === 0 && <div className="empty-row">No blocks in this article.</div>}
                  </div>
                  {selectedBlocks.size > 0 && (
                    <div className="edit-actions">
                      <button className="admin-btn danger" onClick={handleDeleteSelected}>Delete {selectedBlocks.size} Block(s)</button>
                      <button className="admin-btn small" onClick={() => setSelectedBlocks(new Set())}>Clear Selection</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="article-modal-footer">
          {canUpdate && view === "view" && <button className="admin-btn danger" onClick={() => onDelete(article.articleId)}>Delete Article</button>}
          <button className="admin-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== EDITOR REQUESTS ===================== */
function EditorRequests({ session }) {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const cfg = authConfig(session.token);
  const canApprove = hasRole(session, "APPROVE_EDITOR_REQUESTS");
  const { askConfirm, Dialog } = useAdminDialog();

  const load = useCallback(() => {
    api.get("/api/editor-requests", cfg).then((r) => setRequests(r.data)).catch(console.error);
  }, [session.token]);

  useEffect(load, [load]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/api/editor-requests/${id}/approve`, {}, cfg);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id) => {
    const ok = await askConfirm("Reject this editor request?");
    if (!ok) return;
    try {
      await api.post(`/api/editor-requests/${id}/reject`, {}, cfg);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Editor Requests</h2>
        <p>Review and process editor applications</p>
      </div>
      <div className="admin-tabs">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} className={`admin-tab ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {s} ({s === "ALL" ? requests.length : requests.filter((r) => r.status === s).length})
          </button>
        ))}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>ID</th><th>Photo</th><th>User</th><th>Field</th><th>Experience</th><th>Status</th>{canApprove && <th>Actions</th>}</tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td><img className="avatar-circle" src={resolveAvatar(r.profilePicture, "editor")} alt="editor request avatar" /></td>
                <td>{r.userEmail}</td>
                <td>{r.field?.name || "-"}</td>
                <td className="title-cell">{r.experience?.substring(0, 80) || "-"}</td>
                <td><span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                {canApprove && (
                  <td className="action-cell">
                    {r.status === "PENDING" && (
                      <>
                        <button className="admin-btn small primary" onClick={() => handleApprove(r.id)}>Approve</button>
                        <button className="admin-btn small danger" onClick={() => handleReject(r.id)}>Reject</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={canApprove ? 7 : 6} className="empty-row">No requests</td></tr>}
          </tbody>
        </table>
      </div>
      {Dialog}
    </div>
  );
}

/* ===================== MANAGE CRAWLER ===================== */
function ManageCrawler({ session }) {
  const [crawlerTab, setCrawlerTab] = useState("article");

  return (
    <div className="crawler-panel">
      <div className="admin-page-header">
        <h2>Crawler Control Centre</h2>
        <p>Manage article and Telegram crawlers from one dashboard</p>
      </div>
      <div className="crawler-tab-bar">
        <button className={`crawler-tab-btn ${crawlerTab === "article" ? "active" : ""}`} onClick={() => setCrawlerTab("article")}>
          Article Crawler
        </button>
        {hasRole(session, "CONTROL_TELEGRAM_CRAWLER", "VIEW_TELEGRAM_POSTS") && (
          <button className={`crawler-tab-btn ${crawlerTab === "telegram" ? "active" : ""}`} onClick={() => setCrawlerTab("telegram")}>
            Telegram Crawler
          </button>
        )}
      </div>
      {crawlerTab === "article" && <ArticleCrawlerPanel session={session} />}
      {crawlerTab === "telegram" && <TelegramCrawlerPanel session={session} />}
    </div>
  );
}

﻿/* --- Article Crawler Panel --- */
function ArticleCrawlerPanel({ session }) {
  const [status, setStatus]         = useState(null);
  const [health, setHealth]         = useState(null);
  const [logs, setLogs]             = useState([]);
  const [lastLogTs, setLastLogTs]   = useState(null);
  const [actionMsg, setActionMsg]   = useState("");
  const [error, setError]           = useState("");
  const [busy, setBusy]             = useState(false);
  const [intervalInput, setIntervalInput]   = useState("");
  const [manualEpId, setManualEpId]         = useState("");
  const [manualPause, setManualPause]       = useState(false);
  const [manualMsg, setManualMsg]           = useState("");
  const [autoScroll, setAutoScroll]         = useState(true);
  const [logEndEl, setLogEndEl]             = useState(null);

  const cfg        = authConfig(session.token);
  const canControl = hasRole(session, "CONTROL_CRAWLER");
  const isOffline  = health === null;
  const channels   = status?.channels || [];
  const anyActive  = channels.some(c => c.status === "crawling");

  const fetchStatus = useCallback(async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        api.get("/api/admin/crawler/status", cfg),
        api.get("/api/admin/crawler/health", cfg),
      ]);
      setStatus(sRes.data);
      setHealth(hRes.data);
      setError("");
    } catch {
      setHealth(null);
      setError("Crawler server unreachable");
    }
  }, [session.token]); // eslint-disable-line

  const fetchLogs = useCallback(async () => {
    try {
      const url = "/api/admin/crawler/logs" +
        (lastLogTs ? `?since=${encodeURIComponent(lastLogTs)}` : "?limit=200");
      const res = await api.get(url, cfg);
      const entries = res.data.logs || [];
      if (entries.length > 0) {
        setLogs(prev => [...prev, ...entries].slice(-500));
        setLastLogTs(entries[entries.length - 1].ts);
      }
    } catch { /* best-effort */ }
  }, [session.token, lastLogTs]); // eslint-disable-line

  useEffect(() => { fetchStatus(); fetchLogs(); }, []); // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => { fetchStatus(); fetchLogs(); }, anyActive ? 2000 : 5000);
    return () => clearInterval(id);
  }, [anyActive, fetchStatus, fetchLogs]);

  useEffect(() => {
    if (autoScroll && logEndEl) logEndEl.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll, logEndEl]);

  const control = async (path, label, method = "post") => {
    setError(""); setBusy(true);
    try {
      if (method === "delete") await api.delete(`/api/admin/crawler/${path}`, cfg);
      else await api.post(`/api/admin/crawler/${path}`, {}, cfg);
      setActionMsg(`${label} — ${new Date().toLocaleTimeString()}`);
      await fetchStatus();
      if (path !== "logs") await fetchLogs();
      if (path === "logs") setLogs([]);
    } catch (err) {
      setError(err.response?.data?.message || `${label} failed`);
    } finally { setBusy(false); }
  };

  const handleSetInterval = async (e) => {
    e.preventDefault();
    const val = parseInt(intervalInput, 10);
    if (!val || val < 1 || val > 100) { setError("Staleness weight must be 1–100"); return; }
    setError(""); setBusy(true);
    try {
      await api.post("/api/admin/crawler/interval", { minutes: val }, cfg);
      setActionMsg(`Staleness weight set to ${val / 10} — ${new Date().toLocaleTimeString()}`);
      setIntervalInput(""); await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to set staleness weight");
    } finally { setBusy(false); }
  };

  const handleManualRun = async (e) => {
    e.preventDefault();
    const epId = parseInt(manualEpId, 10);
    if (!epId || epId < 1) { setManualMsg("Enter a valid endpoint ID."); return; }
    setManualMsg(""); setError(""); setBusy(true);
    try {
      if (manualPause && !status?.paused) {
        await api.post("/api/admin/crawler/stop", {}, cfg);
      }
      const res = await api.post("/api/admin/crawler/run-endpoint", { endpointId: epId }, cfg);
      setManualMsg(`Crawl started: ${res.data?.message || "OK"}`);
      setManualEpId("");
      await fetchStatus();
    } catch (err) {
      setManualMsg(`Failed: ${err.response?.data?.message || err.response?.data?.detail || "Run failed"}`);
    } finally { setBusy(false); }
  };

  const levelClass = lvl => {
    if (!lvl) return "log-info";
    const l = lvl.toUpperCase();
    if (l === "ERROR") return "log-error";
    if (l === "WARN")  return "log-warn";
    return "log-info";
  };

  const fmtPriority = p => {
    if (p == null) return "—";
    if (p >= 9999) return <span className="due-now">NEW</span>;
    return p.toFixed(2);
  };

  const fmtMinutes = m => {
    if (m == null) return "never";
    if (m < 1) return "<1m";
    if (m < 60) return `${Math.round(m)}m`;
    return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  };

  const schedulerState = isOffline ? "OFFLINE" : status?.paused ? "PAUSED" : "ACTIVE";
  const queued = status?.queuedEndpoints || [];

  return (
    <div className="crawler-sub-panel">
      {error     && <div className="admin-error">{error}</div>}
      {actionMsg && <div className="crawler-action-toast">{actionMsg}</div>}

      {/* Overview Cards */}
      <div className="crawler-status-grid">
        <div className={`crawler-status-card ${isOffline ? "card-offline" : health?.ok ? "card-ok" : "card-warn"}`}>
          <span className="card-label">Heartbeat</span>
          <span className="card-value">{isOffline ? "OFFLINE" : health?.ok ? "HEALTHY" : "WARN"}</span>
          <span className="card-sub">{health?.backendBaseUrl || "—"}</span>
        </div>
        <div className={`crawler-status-card ${schedulerState === "ACTIVE" ? "card-ok" : schedulerState === "OFFLINE" ? "card-offline" : "card-warn"}`}>
          <span className="card-label">Scheduler</span>
          <span className="card-value">{schedulerState}</span>
          <span className="card-sub">{status?.queueSize != null ? `${status.queueSize} endpoints queued` : "—"}</span>
        </div>
        <div className={`crawler-status-card ${anyActive ? "card-running" : "card-ok"}`}>
          <span className="card-label">Channels</span>
          <span className="card-value">
            {anyActive && <span className="pulse-dot" />}
            {channels.filter(c => c.status === "crawling").length}
            <small style={{fontSize:"0.8rem",fontWeight:500,color:"#94a3b8"}}>&nbsp;/ {channels.length} active</small>
          </span>
          <span className="card-sub">{anyActive ? "crawling now" : "all idle"}</span>
        </div>
        <div className="crawler-status-card card-ok">
          <span className="card-label">Articles Found</span>
          <span className="card-value">{status?.totalArticlesFound ?? "—"}</span>
          <span className="card-sub">{status?.totalCrawls != null ? `${status.totalCrawls} runs total` : "—"}</span>
        </div>
      </div>

      {/* Channel Status */}
      {!isOffline && channels.length > 0 && (
        <div className="crawler-section-block">
          <div className="crawler-section-title">Channel Status</div>
          <div className="crawler-channels-grid">
            {channels.map(ch => (
              <div key={ch.id}
                className={`crawler-ch-card ${ch.status === "crawling" ? "ch-crawling" : ch.status === "stopped" ? "ch-stopped" : "ch-idle"}`}>
                <div className="ch-header">
                  <span className="ch-id">CH {ch.id}</span>
                  <span className={`ch-badge ${ch.status === "crawling" ? "badge-crawling" : ch.status === "stopped" ? "badge-stopped" : "badge-idle"}`}>
                    {ch.status === "crawling" && <span className="pulse-dot" />}
                    {ch.status.toUpperCase()}
                  </span>
                </div>
                {ch.endpointId != null && (
                  <div className="ch-ep-id">EP #{ch.endpointId}</div>
                )}
                <div className={`ch-ep-url${!ch.endpoint ? " ch-no-ep" : ""}`} title={ch.endpoint || ""}>
                  {ch.endpoint ? (ch.endpoint.length > 55 ? ch.endpoint.slice(0, 52) + "…" : ch.endpoint) : "—"}
                </div>
                {ch.startedAt && (
                  <div className="ch-started">since {new Date(ch.startedAt + "Z").toLocaleTimeString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Queue — sorted by priority */}
      {!isOffline && queued.length > 0 && (
        <div className="crawler-section-block">
          <div className="crawler-section-title">Pending Endpoints — Priority Order</div>
          <div className="crawler-queue-table-wrap">
            <table className="crawler-queue-table">
              <thead>
                <tr><th>EP ID</th><th>URL</th><th>Priority</th><th>Prod Score</th><th>Last Crawled</th><th>Runs</th></tr>
              </thead>
              <tbody>
                {queued.map(ep => (
                  <tr key={ep.id} className={ep.priority >= 9999 ? "row-due" : ""}>
                    <td className="ep-id-cell">#{ep.id}</td>
                    <td className="ep-url-cell" title={ep.url}>
                      {ep.url.length > 60 ? ep.url.slice(0, 57) + "…" : ep.url}
                    </td>
                    <td className="ep-due-cell">{fmtPriority(ep.priority)}</td>
                    <td className="ep-score-cell">{ep.score}</td>
                    <td className="ep-score-cell">{fmtMinutes(ep.minutesSinceCrawl)}</td>
                    <td className="ep-score-cell">{ep.crawlCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Control Bar */}
      {canControl && (
        <div className="crawler-command-bar">
          <button className="admin-btn primary"
            onClick={() => control("start", "Scheduler resumed")}
            disabled={busy || isOffline || !status?.paused}>
            Resume
          </button>
          <button className="admin-btn danger"
            onClick={() => control("stop", "Scheduler paused")}
            disabled={busy || isOffline || status?.paused}>
            Pause
          </button>
          <button className="admin-btn" style={{background:"linear-gradient(135deg,#0f766e,#0d9488)",borderColor:"#134e4a"}}
            onClick={() => control("restart", "Scheduler restarted")}
            disabled={busy || isOffline}>
            Restart
          </button>
          <button className="admin-btn accent"
            onClick={() => control("run-now", "All endpoints re-queued for immediate run")}
            disabled={busy || isOffline}>
            Run All Now
          </button>
          <button className="admin-btn"
            onClick={() => { fetchStatus(); fetchLogs(); }}
            disabled={busy}>
            Refresh
          </button>
          <button className="admin-btn muted"
            onClick={() => control("logs", "Logs cleared", "delete")}
            disabled={busy}>
            Clear Logs
          </button>
        </div>
      )}

      {/* Manual Endpoint Run */}
      {canControl && (
        <div className="crawler-section-block">
          <div className="crawler-section-title">Manual Endpoint Run</div>
          <p className="crawler-section-desc">
            Run a specific listing endpoint immediately. Optionally pause the scheduler first
            so only this endpoint crawls.
          </p>
          <form className="crawler-manual-run-form" onSubmit={handleManualRun}>
            <input
              type="number" min="1"
              placeholder="Endpoint ID"
              value={manualEpId}
              onChange={e => setManualEpId(e.target.value)}
              className="manual-ep-input"
            />
            <label className="manual-pause-toggle">
              <input type="checkbox" checked={manualPause}
                onChange={e => setManualPause(e.target.checked)} />
              Pause scheduler first
            </label>
            <button className="admin-btn accent" type="submit" disabled={busy || isOffline || !manualEpId}>
              {busy ? <><span className="spinner-sm" /> Running…</> : "Run Endpoint Now"}
            </button>
            {status?.paused && (
              <button className="admin-btn primary" type="button"
                onClick={() => control("start", "Scheduler resumed")}
                disabled={busy || isOffline}>
                Resume Scheduler
              </button>
            )}
          </form>
          {manualMsg && (
            <div className={`crawler-action-toast${manualMsg.startsWith("Failed") ? " toast-error" : ""}`}>
              {manualMsg}
            </div>
          )}
        </div>
      )}

      {/* Staleness Weight */}
      {canControl && (
        <form className="crawler-interval-form" onSubmit={handleSetInterval}>
          <label>Staleness Weight</label>
          <input type="number" min="1" max="100"
            placeholder="1–100 (÷10)"
            value={intervalInput}
            onChange={e => setIntervalInput(e.target.value)}
          />
          <button className="admin-btn primary" type="submit" disabled={busy || !intervalInput}>Apply</button>
        </form>
      )}

      {/* Live Log */}
      <div className="crawler-log-panel">
        <div className="log-panel-header">
          <span>Live Log Stream</span>
          <label className="log-autoscroll-toggle">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
        </div>
        <div className="log-entries">
          {logs.length === 0
            ? <span className="log-empty">No log entries yet.</span>
            : logs.map((entry, i) => (
              <div key={i} className={`log-entry ${levelClass(entry.level)}`}>
                <span className="log-ts">{entry.ts ? new Date(entry.ts).toLocaleTimeString() : ""}</span>
                <span className="log-lvl">{entry.level || "INFO"}</span>
                <span className="log-msg">{entry.msg}</span>
              </div>
            ))
          }
          <div ref={el => setLogEndEl(el)} />
        </div>
      </div>
    </div>
  );
}


/* ===================== MANAGE FIELDS ===================== */
function ManageFields({ session }) {
  const [fields, setFields] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useAdminDialog();
  const cfg = authConfig(session.token);

  const load = useCallback(() => {
    api.get("/api/fields", cfg).then((r) => setFields(r.data)).catch(console.error);
  }, [session.token]);

  useEffect(load, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/fields", form, cfg);
      setForm({ name: "", description: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create field");
    }
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/api/fields/${id}`, editForm, cfg);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update field");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this category field?");
    if (!ok) return;
    try {
      await api.delete(`/api/fields/${id}`, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete field");
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Manage Category Fields</h2>
        <p>Create, edit, and remove news categories</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <button className="admin-btn primary" onClick={() => setShowCreate(!showCreate)}>
        {showCreate ? "Cancel" : "+ New Field"}
      </button>

      {showCreate && (
        <form className="admin-form" onSubmit={handleCreate}>
          <input placeholder="Field name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="admin-btn primary" type="submit">Create Field</button>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>ID</th><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>
                  {editingId === f.id
                    ? <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    : f.name}
                </td>
                <td>
                  {editingId === f.id
                    ? <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                    : f.description || "-"}
                </td>
                <td className="action-cell">
                  {editingId === f.id ? (
                    <>
                      <button className="admin-btn small primary" onClick={() => handleUpdate(f.id)}>Save</button>
                      <button className="admin-btn small" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="admin-btn small" onClick={() => { setEditingId(f.id); setEditForm({ name: f.name, description: f.description || "" }); }}>Edit</button>
                      <button className="admin-btn small danger" onClick={() => handleDelete(f.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {fields.length === 0 && <tr><td colSpan="4" className="empty-row">No fields configured</td></tr>}
          </tbody>
        </table>
      </div>
      {Dialog}
    </div>
  );
}

/* ===================== MANAGE EVENTS ===================== */
function ManageEvents({ session }) {
  const [events, setEvents] = useState([]);
  const [fieldsData, setFieldsData] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", fieldId: "", status: "DRAFT" });
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useAdminDialog();
  const nav = useNavigate();
  const cfg = authConfig(session.token);

  const load = useCallback(() => {
    api.get("/api/events", cfg).then((r) => setEvents(r.data)).catch(console.error);
    api.get("/api/fields", cfg).then((r) => setFieldsData(r.data)).catch(console.error);
  }, [session.token]);

  useEffect(load, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/events", { ...form, fieldId: Number(form.fieldId) }, cfg);
      setForm({ title: "", description: "", fieldId: "", status: "DRAFT" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create event");
    }
  };

  const handleStatusChange = async (ev, newStatus) => {
    try {
      await api.patch(`/api/events/${ev.id}/status`, { status: newStatus }, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this event and all its live news? This cannot be undone.", "Delete Event");
    if (!ok) return;
    try {
      await api.delete(`/api/events/${id}`, cfg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete event");
    }
  };

  const STATUS_LABELS = { DRAFT: "Draft", EDITOR_VISIBLE: "Open to Editors", PUBLIC: "Public" };
  const STATUS_COLORS = { DRAFT: "#64748b", EDITOR_VISIBLE: "#f59e0b", PUBLIC: "#22c55e" };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Live Event Management</h2>
        <p>Create and manage live news events. Click an event to view its details, manage publish requests, and live posts.</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <button className="admin-btn primary" onClick={() => setShowCreate(!showCreate)}>
        {showCreate ? "Cancel" : "+ New Event"}
      </button>

      {showCreate && (
        <form className="admin-form" onSubmit={handleCreate}>
          <input
            placeholder="Event title (e.g. Russia-Ukraine Conflict 2026)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Brief description of the event..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", resize: "vertical" }}
          />
          <select
            value={form.fieldId}
            onChange={(e) => setForm({ ...form, fieldId: e.target.value })}
            required
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }}
          >
            <option value="">- Select Field -</option>
            {fieldsData.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }}
          >
            <option value="DRAFT">Draft (admin-only)</option>
            <option value="EDITOR_VISIBLE">Open to Editors</option>
            <option value="PUBLIC">Public (all users)</option>
          </select>
          <button className="admin-btn primary" type="submit">Create Event</button>
        </form>
      )}

      <div className="event-grid">
        {events.map((ev) => (
          <div key={ev.id} className="event-card" onClick={() => nav(`/admin/events/${ev.id}`)}>
            <div className="event-card-header">
              <span className="event-field-badge">{ev.field?.name || "No Field"}</span>
              <span className="event-status-badge" style={{ background: STATUS_COLORS[ev.status] + "22", color: STATUS_COLORS[ev.status], border: `1px solid ${STATUS_COLORS[ev.status]}66` }}>
                {STATUS_LABELS[ev.status] || ev.status}
              </span>
            </div>
            <h3 className="event-card-title">{ev.title}</h3>
            <p className="event-card-desc">{ev.description || "No description provided."}</p>
            <div className="event-card-footer">
              <span className="event-card-meta">Created: {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : "-"}</span>
              <div className="event-card-actions" onClick={(e) => e.stopPropagation()}>
                {ev.status !== "EDITOR_VISIBLE" && (
                  <button className="admin-btn small" onClick={() => handleStatusChange(ev, "EDITOR_VISIBLE")}>Open Editors</button>
                )}
                {ev.status !== "PUBLIC" && (
                  <button className="admin-btn small primary" onClick={() => handleStatusChange(ev, "PUBLIC")}>Go Public</button>
                )}
                {ev.status !== "DRAFT" && (
                  <button className="admin-btn small" onClick={() => handleStatusChange(ev, "DRAFT")}>Revert Draft</button>
                )}
                <button className="admin-btn small danger" onClick={() => handleDelete(ev.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="event-empty-state">
            <p>No events yet. Create the first live news event to get started.</p>
          </div>
        )}
      </div>
      {Dialog}
    </div>
  );
}

/* ===================== TELEGRAM CRAWLER PANEL ===================== */
function TelegramCrawlerPanel({ session }) {
  const [status, setStatus]       = useState(null);
  const [health, setHealth]       = useState(null);
  const [logs, setLogs]           = useState([]);
  const [lastLogTs, setLastLogTs] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const [error, setError]         = useState("");
  const [busy, setBusy]           = useState(false);
  const [intervalInput, setIntervalInput] = useState("");
  const [autoScroll, setAutoScroll]       = useState(true);
  const [logEndEl, setLogEndEl]   = useState(null);

  const cfg        = authConfig(session.token);
  const canControl = hasRole(session, "CONTROL_TELEGRAM_CRAWLER");
  const isRunning  = status?.crawlRunning === true;
  const isOffline  = health === null;

  const BASE = "/api/admin/telegram-crawler";

  const fetchStatus = useCallback(async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        api.get(`${BASE}/status`, cfg),
        api.get(`${BASE}/health`, cfg),
      ]);
      setStatus(sRes.data);
      setHealth(hRes.data);
      setError("");
    } catch {
      setHealth(null);
      setError("Telegram crawler server unreachable");
    }
  }, [session.token]);

  const fetchLogs = useCallback(async () => {
    try {
      const url = `${BASE}/logs` + (lastLogTs ? `?since=${encodeURIComponent(lastLogTs)}` : "?limit=200");
      const res = await api.get(url, cfg);
      const entries = res.data.logs || [];
      if (entries.length > 0) {
        setLogs(prev => [...prev, ...entries].slice(-500));
        setLastLogTs(entries[entries.length - 1].ts);
      }
    } catch { /* best-effort */ }
  }, [session.token, lastLogTs]);

  useEffect(() => { fetchStatus(); fetchLogs(); }, []);

  useEffect(() => {
    const interval = isRunning ? 2000 : 8000;
    const id = setInterval(() => { fetchStatus(); fetchLogs(); }, interval);
    return () => clearInterval(id);
  }, [isRunning, fetchStatus, fetchLogs]);

  useEffect(() => {
    if (autoScroll && logEndEl) logEndEl.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll, logEndEl]);

  const control = async (path, label, isPost = true) => {
    setError(""); setBusy(true);
    try {
      if (isPost) await api.post(`${BASE}/${path}`, {}, cfg);
      else await api.delete(`${BASE}/${path}`, cfg);
      setActionMsg(`${label} - ${new Date().toLocaleTimeString()}`);
      await fetchStatus();
      if (path !== "logs") await fetchLogs();
      if (path === "logs") setLogs([]);
    } catch (err) {
      setError(err.response?.data?.message || `${label} failed`);
    } finally { setBusy(false); }
  };

  const handleSetInterval = async (e) => {
    e.preventDefault();
    const mins = parseInt(intervalInput, 10);
    if (!mins || mins < 1 || mins > 1440) { setError("Interval must be between 1 and 1440 minutes"); return; }
    setError(""); setBusy(true);
    try {
      await api.post(`${BASE}/interval`, { minutes: mins }, cfg);
      setActionMsg(`Interval set to ${mins} min - ${new Date().toLocaleTimeString()}`);
      setIntervalInput(""); await fetchStatus();
    } catch (err) { setError(err.response?.data?.message || "Failed to set interval"); }
    finally { setBusy(false); }
  };

  const levelClass = (lvl) => {
    if (!lvl) return "";
    const l = lvl.toUpperCase();
    if (l === "ERROR") return "log-error";
    if (l === "WARN") return "log-warn";
    return "log-info";
  };

  const schedulerState = status
    ? (status.paused ? "PAUSED" : "ACTIVE")
    : (isOffline ? "OFFLINE" : "-");
  const lastRun = status?.lastRun;

  return (
    <div className="crawler-sub-panel">
      {error && <div className="admin-error">{error}</div>}
      {actionMsg && <div className="crawler-action-toast">{actionMsg}</div>}

      <div className="crawler-status-grid">
        <div className={`crawler-status-card ${isOffline ? "card-offline" : health?.ok ? "card-ok" : "card-warn"}`}>
          <span className="card-label">Heartbeat</span>
          <span className="card-value">{isOffline ? "OFFLINE" : health?.ok ? "HEALTHY" : "WARN"}</span>
          <span className="card-sub">{health?.backendBaseUrl || "-"}</span>
        </div>
        <div className={`crawler-status-card ${schedulerState === "ACTIVE" ? "card-ok" : schedulerState === "OFFLINE" ? "card-offline" : "card-warn"}`}>
          <span className="card-label">Scheduler</span>
          <span className="card-value">{schedulerState}</span>
          <span className="card-sub">{status?.nextRunAt ? `Next: ${new Date(status.nextRunAt).toLocaleTimeString()}` : "-"}</span>
        </div>
        <div className={`crawler-status-card ${isRunning ? "card-running" : "card-ok"}`}>
          <span className="card-label">Crawl Status</span>
          <span className="card-value">{isRunning ? <><span className="pulse-dot" /> RUNNING</> : "IDLE"}</span>
          <span className="card-sub">
            {lastRun?.status && lastRun.status !== "never-run"
              ? `Last: ${lastRun.status} ${lastRun.finishedAt ? new Date(lastRun.finishedAt).toLocaleTimeString() : ""}`
              : "Never run"}
          </span>
        </div>
        <div className="crawler-status-card card-ok">
          <span className="card-label">Interval</span>
          <span className="card-value">{status?.intervalMinutes ?? "-"}<small> min</small></span>
          <span className="card-sub">Scheduled crawl frequency</span>
        </div>
      </div>

      {lastRun && lastRun.status && lastRun.status !== "never-run" && (
        <div className="crawler-run-stats">
          <h4>Last Run Summary</h4>
          <div className="run-stats-grid">
            {[
              ["Channels", lastRun.channelsProcessed ?? "-"],
              ["Scraped", lastRun.postsScraped ?? "-"],
              ["Created", lastRun.postsCreated ?? "-"],
              ["Skipped", lastRun.postsSkipped ?? "-"],
              ["Errors", lastRun.errors ?? "-"],
              ["Status", lastRun.status],
            ].map(([k, v]) => (
              <div key={k} className="run-stat-item">
                <span className="run-stat-label">{k}</span>
                <span className={`run-stat-value ${k === "Errors" && v > 0 ? "stat-bad" : k === "Created" && v > 0 ? "stat-good" : ""}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canControl && (
        <div className="crawler-command-bar">
          <button className="admin-btn primary" onClick={() => control("start", "Start scheduler")} disabled={busy || isOffline || (!status?.paused)}>Start</button>
          <button className="admin-btn danger" onClick={() => control("stop", "Stop scheduler")} disabled={busy || isOffline || status?.paused}>Stop</button>
          <button className="admin-btn accent" onClick={() => control("run-now", "Run now")} disabled={busy || isOffline || isRunning}>
            {isRunning ? <><span className="spinner-sm" /> Running...</> : "Run Now"}
          </button>
          <button className="admin-btn" onClick={() => { fetchStatus(); fetchLogs(); }} disabled={busy}>Refresh</button>
          <button className="admin-btn muted" onClick={() => control("logs", "Clear logs", false)} disabled={busy}>Clear Logs</button>
        </div>
      )}

      {canControl && (
        <form className="crawler-interval-form" onSubmit={handleSetInterval}>
          <label>Change Interval</label>
          <input type="number" min="1" max="1440" placeholder={`Current: ${status?.intervalMinutes ?? "?"} min`} value={intervalInput} onChange={e => setIntervalInput(e.target.value)} />
          <button className="admin-btn primary" type="submit" disabled={busy || !intervalInput}>Apply</button>
        </form>
      )}

      <div className="crawler-log-panel">
        <div className="log-panel-header">
          <span>Live Log Stream</span>
          <label className="log-autoscroll-toggle">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} /> Auto-scroll
          </label>
        </div>
        <div className="log-entries">
          {logs.length === 0
            ? <span className="log-empty">No log entries yet. Start the Telegram crawler or trigger a run.</span>
            : logs.map((entry, i) => (
              <div key={i} className={`log-entry ${levelClass(entry.level)}`}>
                <span className="log-ts">{entry.ts ? new Date(entry.ts).toLocaleTimeString() : ""}</span>
                <span className="log-lvl">{entry.level || "INFO"}</span>
                <span className="log-msg">{entry.msg}</span>
              </div>
            ))
          }
          <div ref={el => setLogEndEl(el)} />
        </div>
      </div>
    </div>
  );
}

/* ===================== MANAGE TELEGRAM ===================== */
function ManageTelegram({ session }) {
  const [channels, setChannels] = useState([]);
  const [posts, setPosts] = useState({ content: [], totalPages: 0, number: 0 });
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [error, setError] = useState("");
  const [postsPage, setPostsPage] = useState(0);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const { askConfirm, Dialog } = useAdminDialog();
  const cfg = authConfig(session.token);

  // â”€â”€ search modal state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const loadChannels = useCallback(() => {
    api.get("/api/telegram/channels", authConfig(session.token))
       .then(r => setChannels(r.data))
       .catch(console.error);
  }, [session.token]);

  const loadPosts = useCallback((channelId, page = 0) => {
    const url = channelId
      ? `/api/telegram/posts/channel/${channelId}?page=${page}&size=15`
      : `/api/telegram/posts?page=${page}&size=15`;
    api.get(url, authConfig(session.token))
       .then(r => setPosts(r.data))
       .catch(console.error);
  }, [session.token]);

  useEffect(loadChannels, [loadChannels]);
  useEffect(() => { loadPosts(selectedChannel, postsPage); }, [selectedChannel, postsPage, loadPosts]);

  // Debounced live search as user types
  useEffect(() => {
    if (!searchOpen) return;
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await api.get(
          `/api/admin/telegram-crawler/search?q=${encodeURIComponent(searchQuery.trim())}`,
          authConfig(session.token)
        );
        setSearchResults(res.data.results || []);
        if ((res.data.results || []).length === 0) {
          setSearchError(`No channels found for "${searchQuery.trim()}". Try a different keyword or the channel's username.`);
        }
      } catch (err) {
        setSearchError(err.response?.status === 502
          ? "Telegram crawler server is offline. Start it to enable channel search."
          : "Search failed. Please try again.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen, session.token]);

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  };

  const handleAddChannel = async (result) => {
    setError("");
    try {
      await api.post("/api/telegram/channels", {
        channelUsername: result.username,
        displayName: result.title || result.username,
        description: result.description || "",
        avatarUrl: result.avatarUrl || "",
      }, authConfig(session.token));
      closeSearch();
      loadChannels();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add channel");
    }
  };

  const handleStatusChange = async (ch, newStatus) => {
    try {
      await api.patch(`/api/telegram/channels/${ch.id}/status`, { status: newStatus }, authConfig(session.token));
      loadChannels();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this channel and all collected posts?", "Delete Channel");
    if (!ok) return;
    try {
      await api.delete(`/api/telegram/channels/${id}`, authConfig(session.token));
      if (selectedChannel === id) setSelectedChannel(null);
      loadChannels();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete channel");
    }
  };

  const handleEditPost = async (postId) => {
    try {
      await api.put(`/api/telegram/posts/${postId}/content`, { content: editContent }, authConfig(session.token));
      setEditingPostId(null);
      loadPosts(selectedChannel, postsPage);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to edit post");
    }
  };

  const handleDeletePost = async (postId) => {
    const ok = await askConfirm("Delete this Telegram post?");
    if (!ok) return;
    try {
      await api.delete(`/api/telegram/posts/${postId}`, authConfig(session.token));
      loadPosts(selectedChannel, postsPage);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete post");
    }
  };

  const STATUS_COLORS = { ACTIVE: "#22c55e", SUSPENDED: "#ef4444" };

  return (
    <div>
      <div className="admin-page-header">
        <h2>Telegram Channels</h2>
        <p>Add and manage Telegram channels, view collected posts</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <button className="admin-btn primary" onClick={openSearch}>+ Add Channel</button>

      {/* â”€â”€ Search Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {searchOpen && (
        <div className="tg-search-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeSearch(); }}>
          <div className="tg-search-modal">
            <div className="tg-search-modal-header">
              <h3>Add Telegram Channel</h3>
              <button className="tg-search-modal-close" onClick={closeSearch}>x</button>
            </div>
            <p className="tg-search-modal-hint">
              Search by channel name, topic, or username in any language (e.g. <code>bbc</code>, <code>reuters</code>, <code>الجزيرة</code>).
            </p>
            <div className="tg-search-bar">
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searching && <span className="spinner-sm tg-search-spinner" />}
            </div>

            {searchQuery.trim().length >= 2 && !searching && searchError && (
              <p className="tg-search-empty">{searchError}</p>
            )}

            {searchResults.length > 0 && (
              <div className="tg-search-results">
                {searchResults.map((r, i) => {
                  const alreadyAdded = channels.some(c => c.channelUsername.toLowerCase() === r.username.toLowerCase());
                  return (
                    <div key={i} className="tg-search-result-card">
                      <span className="tg-channel-avatar">
                        {r.avatarUrl
                          ? <img src={r.avatarUrl} alt="" />
                          : (r.title?.[0]?.toUpperCase() || "T")}
                      </span>
                      <div className="tg-search-result-info">
                        <span className="tg-channel-name">{r.title}</span>
                        <span className="tg-channel-handle">@{r.username}</span>
                        {r.description && (
                          <span className="tg-search-result-desc">{r.description.slice(0, 120)}</span>
                        )}
                        {r.subscribers && (
                          <span className="tg-search-result-subs">{r.subscribers.toLocaleString()} subscribers</span>
                        )}
                        {r.hasPublicPreview === false && (
                          <span className="tg-search-result-warn">⚠ No public preview — posts cannot be scraped</span>
                        )}
                      </div>
                      {alreadyAdded ? (
                        <span className="tg-search-added-badge">Added</span>
                      ) : (
                        <button className="admin-btn small primary" onClick={() => handleAddChannel(r)}>+ Add</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery.trim().length < 2 && (
              <p className="tg-search-empty" style={{ marginTop: "1rem" }}>
                Type a name or keyword to search…
              </p>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ Channel Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="tg-channel-grid">
        {channels.map(ch => (
          <div
            key={ch.id}
            className={`tg-channel-card ${selectedChannel === ch.id ? "selected" : ""}`}
            onClick={() => { setSelectedChannel(selectedChannel === ch.id ? null : ch.id); setPostsPage(0); }}
          >
            <div className="tg-channel-card-top">
              <span className="tg-channel-avatar">{ch.displayName?.[0]?.toUpperCase() || "T"}</span>
              <div className="tg-channel-info">
                <span className="tg-channel-name">{ch.displayName || ch.channelUsername}</span>
                <span className="tg-channel-handle">@{ch.channelUsername}</span>
              </div>
              <span className="tg-channel-status-badge" style={{
                background: (STATUS_COLORS[ch.status] || "#64748b") + "22",
                color: STATUS_COLORS[ch.status] || "#64748b",
                border: `1px solid ${STATUS_COLORS[ch.status] || "#64748b"}66`
              }}>
                {ch.status}
              </span>
            </div>
            {ch.description && <p className="tg-channel-desc">{ch.description}</p>}
            <div className="tg-channel-stats">
              <span>{ch.totalPostsCollected} posts</span>
              <span>{ch.lastCrawledAt ? `Last: ${new Date(ch.lastCrawledAt).toLocaleString()}` : "Never crawled"}</span>
            </div>
            <div className="tg-channel-actions" onClick={e => e.stopPropagation()}>
              {ch.status === "ACTIVE" ? (
                <button className="admin-btn small danger" onClick={() => handleStatusChange(ch, "SUSPENDED")}>Suspend</button>
              ) : (
                <button className="admin-btn small primary" onClick={() => handleStatusChange(ch, "ACTIVE")}>Activate</button>
              )}
              <button className="admin-btn small danger" onClick={() => handleDelete(ch.id)}>Delete</button>
            </div>
          </div>
        ))}
        {channels.length === 0 && (
          <div className="event-empty-state"><p>No Telegram channels added yet. Click "+ Add Channel" to get started.</p></div>
        )}
      </div>

      {/* â”€â”€ Posts Feed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="tg-posts-section">
        <h3 className="tg-posts-title">
          {selectedChannel
            ? `Posts from @${channels.find(c => c.id === selectedChannel)?.channelUsername || "..."}`
            : "All Telegram Posts"}
        </h3>
        <div className="tg-posts-list">
          {(posts.content || []).map(p => (
            <div key={p.id} className="tg-post-card">
              <div className="tg-post-header">
                <span className="tg-post-channel">@{p.channelUsername}</span>
                <span className="tg-post-date">{p.messageDate ? new Date(p.messageDate).toLocaleString() : "-"}</span>
                <span className="tg-post-views">{p.viewCount > 0 ? `${p.viewCount} views` : ""}</span>
              </div>
              {editingPostId === p.id ? (
                <div className="tg-post-edit">
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} />
                  <div className="tg-post-edit-actions">
                    <button className="admin-btn small primary" onClick={() => handleEditPost(p.id)}>Save</button>
                    <button className="admin-btn small" onClick={() => setEditingPostId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="tg-post-content">{p.content || <em>No text content</em>}</p>
              )}
              {p.mediaUrl && (
                <div className="tg-post-media">
                  {p.mediaType === "photo"
                    ? <img src={p.mediaUrl} alt="Telegram media" />
                    : p.mediaType === "video"
                    ? <video src={p.mediaUrl} controls />
                    : null}
                </div>
              )}
              <div className="tg-post-actions">
                <button className="admin-btn small" onClick={() => { setEditingPostId(p.id); setEditContent(p.content || ""); }}>Edit</button>
                <button className="admin-btn small danger" onClick={() => handleDeletePost(p.id)}>Delete</button>
                {p.edited && <span className="tg-post-edited-badge">edited</span>}
              </div>
            </div>
          ))}
          {(posts.content || []).length === 0 && (
            <div className="event-empty-state"><p>No posts collected yet. Start the Telegram crawler to begin collecting.</p></div>
          )}
        </div>
        {posts.totalPages > 1 && (
          <div className="tg-posts-pagination">
            <button className="admin-btn small" disabled={postsPage === 0} onClick={() => setPostsPage(p => p - 1)}>{"<- Prev"}</button>
            <span>Page {postsPage + 1} of {posts.totalPages}</span>
            <button className="admin-btn small" disabled={postsPage >= posts.totalPages - 1} onClick={() => setPostsPage(p => p + 1)}>{"Next ->"}</button>
          </div>
        )}
      </div>

      {Dialog}
    </div>
  );
}
