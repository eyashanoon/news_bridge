import { Link, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import SearchBar from "./SearchBar";

export default function SiteLayout() {
  const { session, logout } = useSession();
  const { darkMode, toggleDarkMode } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigate();

  const isLimited = session?.type === "PRIMITIVE" || !session?.type;
  const isRegistered = session?.type === "REGISTERED";
  const isEditor = session?.type === "EDITOR";

  const userTypeLabel = isLimited ? t("guest") : (isRegistered ? t("registered") : (isEditor ? t("editor") : ""));

  const handleLogout = () => {
    logout();
    nav("/");
    window.location.reload();
  };

  const renderNavLinks = () => {
    if (isLimited) {
      return (
        <nav className="app-nav">
          <Link to="/">{t("articlesHome")}</Link>
        </nav>
      );
    }

    if (isRegistered) {
      return (
        <nav className="app-nav">
          <Link to="/">Dashboard Home</Link>
          <Link to="/dashboard/notifications" className="nav-badge-link">Notifications</Link>
          <Link to="/apply-editor" className="nav-action-link">Apply to be an Editor</Link>
        </nav>
      );
    }

    if (isEditor) {
      return (
        <nav className="app-nav">
          <Link to="/">{t("editorDashboard")}</Link>
          <Link to="/editor/workspace">{t("workspace")}</Link>
          <Link to="/editor/profile">{t("profileInfo")}</Link>
        </nav>
      );
    }

    return null;
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">
            <Link to="/news">{t("appName")}</Link>
          </div>
          {renderNavLinks()}
        </div>

        <div className="app-user-type-bar">
          <span className="user-type-indicator">{userTypeLabel}</span>
        </div>

        <div className="app-header-center">
          <SearchBar />
        </div>

        <div className="app-header-right">
          {/* Language toggle */}
          <LanguageToggle />

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="theme-toggle-btn"
            title={darkMode ? t("switchToLight") : t("switchToDark")}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

          {isLimited ? (
            <div className="auth-buttons">
              <Link to="/auth/login" className="btn-login">{t("signIn")}</Link>
              <Link to="/auth/signup" className="btn-signup">{t("signUp")}</Link>
            </div>
          ) : (
            <div className="auth-user">
              <Link to="/profile" className="profile-link-btn">👤 Profile</Link>
              <span className="session-badge">{session?.type}</span>
              <button onClick={handleLogout} className="btn-logout">{t("signOut")}</button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
