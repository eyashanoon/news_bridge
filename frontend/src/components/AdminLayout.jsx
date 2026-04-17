import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSession } from "../context/SessionContext";

export default function AdminLayout() {
  const { session, logout } = useSession();
  const nav = useNavigate();
  const location = useLocation();
  const roles = session?.roles || [];

  const handleLogout = () => {
    logout();
    nav("/admin/login");
    window.location.reload();
  };

  const links = [
    { to: "/admin", label: "Dashboard", roles: [] },
    { to: "/admin/admins", label: "Manage Admins", roles: ["CREATE_ADMIN"] },
    { to: "/admin/users", label: "Manage Users", roles: ["MANAGE_USERS"] },
    { to: "/admin/articles", label: "Manage Articles", roles: ["UPDATE_ANY_ARTICLE", "DELETE_ANY_ARTICLE"] },
    { to: "/admin/roots", label: "Manage Roots", roles: ["MANAGE_USERS", "OWNER"] },
    { to: "/admin/endpoints", label: "Manage Endpoints", roles: ["MANAGE_USERS", "OWNER"] },
    { to: "/admin/editor-requests", label: "Editor Requests", roles: ["VIEW_EDITOR_REQUESTS"] },
    { to: "/admin/crawler", label: "Manage Crawler", roles: ["VIEW_CRAWLER_LOGS", "CONTROL_CRAWLER"] },
    { to: "/admin/fields", label: "Manage Fields", roles: ["MANAGE_USERS", "APPROVE_EDITOR_REQUESTS"] },
    { to: "/admin/events", label: "Live Events", roles: ["MANAGE_EVENTS", "MANAGE_USERS"] },
    { to: "/admin/telegram", label: "Telegram", roles: ["MANAGE_TELEGRAM_CHANNELS", "VIEW_TELEGRAM_POSTS", "MANAGE_USERS"] },
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">Admin Console</div>
        <nav className="admin-nav">
          {links.map(link => {
            const hasAccess = link.roles.length === 0 || link.roles.some(r => roles.includes(r));
            if (!hasAccess) return null;
            const isActive = link.to === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(link.to);
            return (
              <Link key={link.to} to={link.to} className={isActive ? "active" : ""}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">{session?.email || "Admin"}</div>
          <button onClick={handleLogout} className="btn-admin-logout">Sign Out</button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
