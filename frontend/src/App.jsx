import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import SiteLayout from "./components/SiteLayout";
import AdminLayout from "./admin/layout/AdminLayout";
import { useSession } from "./context/SessionContext";
import DashboardPage from "./admin/pages/DashboardPage";
import AdminsPage from "./admin/pages/AdminsPage";
import UsersPage from "./admin/pages/UsersPage";
import ArticlesPage from "./admin/pages/ArticlesPage";
import SourcesPage from "./admin/pages/SourcesPage";
import EditorRequestsPage from "./admin/pages/EditorRequestsPage";
import EditorsPage from "./admin/pages/EditorsPage";
import EditorDetailPage from "./admin/pages/EditorDetailPage";
import CrawlerPage from "./admin/pages/CrawlerPage";
import TopicsFieldsPage from "./admin/pages/TopicsFieldsPage";
import TelegramPage from "./admin/pages/TelegramPage";
import TelegramChannelDetailPage from "./admin/pages/TelegramChannelDetailPage";
import TelegramPostDetailPage from "./admin/pages/TelegramPostDetailPage";
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
            <Route index element={<DashboardPage />} />
            <Route path="admins" element={<AdminsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="editors" element={<EditorsPage />} />
            <Route path="editors/:id" element={<EditorDetailPage />} />
            <Route path="articles" element={<ArticlesPage />} />
            <Route path="roots" element={<SourcesPage section="roots" />} />
            <Route path="endpoints" element={<SourcesPage section="endpoints" />} />
            <Route path="editor-requests" element={<EditorRequestsPage />} />
            <Route path="crawler" element={<CrawlerPage />} />
            <Route path="fields" element={<TopicsFieldsPage section="fields" />} />
            <Route path="topics" element={<TopicsFieldsPage section="topics" />} />
            <Route path="telegram" element={<TelegramPage />} />
            <Route path="telegram/channels/:channelId" element={<TelegramChannelDetailPage />} />
            <Route path="telegram/posts/:postId" element={<TelegramPostDetailPage />} />
            <Route path="topics/:id" element={<EventDetailPage />} />
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
