import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs } from "../design-system/Tabs";
import { AdminPageHeader } from "../layout/AdminPageHeader";
import { UsersListTab } from "./users/UsersListTab";
import { UserAnalyticsTab } from "./users/UserAnalyticsTab";
import { UserPreferencesTab } from "./users/UserPreferencesTab";

const TAB_ITEMS = [
  { id: "users", label: "Users List" },
  { id: "analytics", label: "User Analytics" },
  { id: "preferences", label: "Preferences & Intelligence" },
];

export function ManageUsers({ session }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") || "users";
  const initialTab = TAB_ITEMS.some((t) => t.id === requestedTab) ? requestedTab : "users";
  const [tab, setTab] = useState(initialTab);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("tab") === "editors") {
      navigate("/admin/editors", { replace: true });
    }
  }, [searchParams, navigate]);

  const handleTabChange = (id) => {
    setTab(id);
  };

  return (
    <div className="admin-management-center user-mgmt-page">
      <AdminPageHeader
        title="User Management"
        subtitle="Registered users and editors who use the news-feed app — segmentation, analytics, and preferences"
      />

      {error && <div className="admin-error">{error}</div>}

      <Tabs
        items={TAB_ITEMS}
        activeId={tab}
        onChange={handleTabChange}
        className="admin-mgmt-tabs"
      />

      {tab === "users" && (
        <UsersListTab session={session} onError={setError} />
      )}

      {tab === "analytics" && (
        <UserAnalyticsTab session={session} />
      )}

      {tab === "preferences" && (
        <UserPreferencesTab session={session} />
      )}
    </div>
  );
}
