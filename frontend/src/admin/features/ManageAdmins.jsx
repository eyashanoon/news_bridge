import { useState, useEffect, useCallback } from "react";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { hasRole } from "../utils/roles";
import { Tabs } from "../design-system/Tabs";
import { AdminPageHeader } from "../layout/AdminPageHeader";
import {
  listAdmins,
  createAdmin,
  updateAdminRoles,
  updateAdminStatus,
  deleteAdmin,
} from "../services/adminsService";
import { CurrentAdminsTab } from "./admins/CurrentAdminsTab";
import { AddAdminTab } from "./admins/AddAdminTab";
import { ActivityLogsTab } from "./admins/ActivityLogsTab";
import { AnalyticsTab } from "./admins/AnalyticsTab";

const TAB_ITEMS = [
  { id: "current", label: "Current Admins" },
  { id: "add", label: "Add Admin" },
  { id: "logs", label: "Activity Logs" },
  { id: "analytics", label: "Analytics" },
];

export function ManageAdmins({ session }) {
  const [tab, setTab] = useState("current");
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [viewingAdmin, setViewingAdmin] = useState(null);
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useConfirmDialog();

  const canCreate = hasRole(session, "CREATE_ADMIN");
  const canViewActivity = hasRole(session, "VIEW_ADMIN_ACTIVITY") || canCreate;

  const visibleTabs = TAB_ITEMS.filter((t) => {
    if (t.id === "add") return canCreate;
    if (t.id === "logs" || t.id === "analytics") return canViewActivity;
    return true;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdmins(session.token);
      setAdmins(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load administrators");
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (body) => {
    setError("");
    try {
      await createAdmin(session.token, body);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create admin");
      throw err;
    }
  };

  const handleUpdateRoles = async (id) => {
    setError("");
    try {
      await updateAdminRoles(session.token, id, editRoles);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update roles");
    }
  };

  const handleDelete = async (id) => {
    const ok = await askConfirm("Delete this admin account?");
    if (!ok) return;
    setError("");
    try {
      await deleteAdmin(session.token, id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete admin");
    }
  };

  const handleUpdateStatus = async (id) => {
    setError("");
    try {
      await updateAdminStatus(session.token, id, editStatus);
      setEditingStatusId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const toggleRole = (role) => {
    setEditRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  return (
    <div className="admin-management-center">
      <AdminPageHeader
        title="Admin Management"
        subtitle="Enterprise administration center for roles, permissions, activity, and analytics"
      />

      <Tabs
        items={visibleTabs}
        activeId={tab}
        onChange={setTab}
        className="admin-mgmt-tabs"
      />

      {tab === "current" && (
        <CurrentAdminsTab
          admins={admins}
          loading={loading}
          error={error}
          editingId={editingId}
          editRoles={editRoles}
          editingStatusId={editingStatusId}
          editStatus={editStatus}
          viewingAdmin={viewingAdmin}
          onToggleRole={toggleRole}
          onStartEditRoles={(a) => { setEditingId(a.id); setEditRoles([...(a.roles || [])]); }}
          onCancelEditRoles={() => setEditingId(null)}
          onSaveRoles={handleUpdateRoles}
          onStartEditStatus={(a) => { setEditingStatusId(a.id); setEditStatus(a.status || "ACTIVE"); }}
          onCancelEditStatus={() => setEditingStatusId(null)}
          onSaveStatus={handleUpdateStatus}
          onSetEditStatus={setEditStatus}
          onView={setViewingAdmin}
          onCloseView={() => setViewingAdmin(null)}
          onDelete={handleDelete}
        />
      )}

      {tab === "add" && canCreate && (
        <AddAdminTab
          onCreate={handleCreate}
          error={error}
          onClearError={() => setError("")}
        />
      )}

      {tab === "logs" && canViewActivity && (
        <ActivityLogsTab session={session} />
      )}

      {tab === "analytics" && canViewActivity && (
        <AnalyticsTab session={session} />
      )}

      {Dialog}
    </div>
  );
}
