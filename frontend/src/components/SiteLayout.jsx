import { Link, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";

export default function SiteLayout() {
  const { session, logout } = useSession();
  const nav = useNavigate();

  const isLimited = session?.type === "PRIMITIVE" || !session?.type;
  const isRegistered = session?.type === "REGISTERED";
  const isEditor = session?.type === "EDITOR";

  const handleLogout = () => {
    logout();
    nav("/");
    window.location.reload();
  };

  const renderNavLinks = () => {
    if (isLimited) {
      return (
        <nav className="app-nav">
          <Link to="/">Articles Home</Link>
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
          <Link to="/">Editor Dashboard</Link>
          <Link to="/editor/workspace">Workspace</Link>
          <Link to="/editor/profile">Profile Info</Link>
        </nav>
      );
    }
    
    return null;
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-logo">
            <Link to="/">News Platform</Link>
        </div>
        
        {renderNavLinks()}
        
        <div className="app-auth">
          {isLimited ? (
            <div className="auth-buttons">
              <Link to="/auth/login" className="btn-login">Sign In</Link>
              <Link to="/auth/signup" className="btn-signup">Sign Up</Link>
            </div>
          ) : (
            <div className="auth-user">
              <span className="session-badge">{session?.type}</span>
              <button onClick={handleLogout} className="btn-logout">Sign Out</button>
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
