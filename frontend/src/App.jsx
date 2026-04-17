import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import SiteLayout from "./components/SiteLayout";
import AdminLayout from "./components/AdminLayout";
import { useSession } from "./context/SessionContext";
import AdminPage from "./pages/AdminPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AuthPage from "./pages/AuthPage";
import CmsPage from "./pages/CmsPage";
import DataPage from "./pages/DataPage";
import EditorPage from "./pages/EditorPage";
import FeedPage from "./pages/FeedPage";
import NotFoundPage from "./pages/NotFoundPage";
import ApplyEditorPage from "./pages/ApplyEditorPage";
import EventDetailPage from "./pages/EventDetailPage";

export default function App() {
  const { booting, session } = useSession();
  const isAdmin = session?.type === "ADMIN";
  const isRegistered = session?.type === "REGISTERED";
  const isEditor = session?.type === "EDITOR";

  if (booting) {
    return <div className="boot-screen">Initializing Secure Connection...</div>;
  }

  return (
    <Routes>
      {/* -------------------- ADMIN PORTAL (ISOLATED) -------------------- */}
      <Route path="/admin">
        <Route path="login" element={<AdminLoginPage />} />
        <Route element={isAdmin ? <AdminLayout /> : <Navigate to="/admin/login" replace />}>
            <Route index element={<AdminPage />} />
            <Route path="admins" element={<AdminPage target="admins" />} />
            <Route path="users" element={<AdminPage target="users" />} />
            <Route path="articles" element={<AdminPage target="articles" />} />
            <Route path="roots" element={<AdminPage target="roots" />} />
            <Route path="endpoints" element={<AdminPage target="endpoints" />} />
            <Route path="editor-requests" element={<AdminPage target="editor-requests" />} />
            <Route path="crawler" element={<AdminPage target="crawler" />} />
            <Route path="fields" element={<AdminPage target="fields" />} />
            <Route path="events" element={<AdminPage target="events" />} />
        <Route path="telegram" element={<AdminPage target="telegram" />} />
            <Route path="events/:id" element={<EventDetailPage />} />
        </Route>
      </Route>

      {/* -------------------- PUBLIC & USER APP -------------------- */}
      <Route path="/" element={<SiteLayout />}>
        <Route index element={<FeedPage />} />

        {/* Auth Pages */}
        <Route path="auth" element={<Navigate to="/auth/login" replace />} />
        <Route path="auth/signup" element={<AuthPage mode="signup" />} />
        <Route path="auth/login" element={<AuthPage mode="login" />} />

        {/* Dashboards */}
        <Route path="dashboard/notifications" element={isRegistered || isEditor ? <div className="sci-fi-panel" style={{padding: '2rem'}}><h3>Neural Notifications Active</h3><p>No new alerts.</p></div> : <Navigate to="/auth/login" replace />} />
        <Route path="apply-editor" element={isRegistered ? <ApplyEditorPage /> : <Navigate to="/auth/login" replace />} />

        <Route path="editor/workspace" element={isEditor ? <EditorPage /> : <Navigate to="/auth/login" replace />} />
        <Route path="editor/profile" element={isEditor ? <div className="sci-fi-panel" style={{padding: '2rem'}}><h3>Editor Profile</h3><p>Identity confirmed.</p></div> : <Navigate to="/auth/login" replace />} />

        {/* Legacy & Misc Pages */}
        <Route path="cms" element={<CmsPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
