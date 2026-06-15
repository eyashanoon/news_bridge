import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import { AdminSidebar } from "./AdminSidebar";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { NavIcon } from "../constants/navIcons";
import { ROUTE_META } from "../constants/navConfig";
import "../design-system/tokens.css";
import "./admin-layout.css";

function buildBreadcrumbs(pathname) {
  if (pathname === "/admin") {
    return [{ label: "Dashboard", to: "/admin" }];
  }

  const meta = ROUTE_META[pathname];
  if (!meta) {
    if (pathname.startsWith("/admin/topics/")) {
      return [
        { label: "Dashboard", to: "/admin" },
        { label: "Content" },
        { label: "Topics & Fields", to: "/admin/topics" },
        { label: "Event Detail" },
      ];
    }
    if (pathname.startsWith("/admin/editors/")) {
      return [
        { label: "Dashboard", to: "/admin" },
        { label: "People & Access" },
        { label: "Editors", to: "/admin/editors" },
        { label: "Editor Profile" },
      ];
    }
    return [{ label: "Dashboard", to: "/admin" }];
  }

  return [
    { label: "Dashboard", to: "/admin" },
    { label: meta.group },
    { label: meta.title },
  ];
}

export default function AdminLayout() {
  const { session, logout } = useSession();
  const nav = useNavigate();
  const location = useLocation();
  const roles = session?.roles || [];
  const breadcrumbs = buildBreadcrumbs(location.pathname);
  const pageMeta = ROUTE_META[location.pathname];
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    nav("/admin/login");
    window.location.reload();
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar${sidebarCollapsed ? " admin-sidebar--collapsed" : ""}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <span className="admin-logo-text">Admin Console</span>
          </div>
          <button
            type="button"
            className="admin-sidebar-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <NavIcon name="panelLeft" />
          </button>
        </div>
        <AdminSidebar roles={roles} collapsed={sidebarCollapsed} />
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">{session?.email || "Admin"}</div>
          <button onClick={handleLogout} className="btn-admin-logout">
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-content">
          <AdminBreadcrumbs items={breadcrumbs} />
          {pageMeta?.title && location.pathname !== "/admin" && (
            <div className="admin-chrome-title">{pageMeta.title}</div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
