import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import SiteLayout from "./components/SiteLayout";
import { useSession } from "./context/SessionContext";
import AuthPage from "./pages/AuthPage";
import CmsPage from "./pages/CmsPage";
import DataPage from "./pages/DataPage";
import EditorPage from "./pages/EditorPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ApplyEditorPage from "./pages/ApplyEditorPage";
import FeedPage from "./pages/FeedPage";

export default function App() {
  const { booting, session } = useSession();
  const isRegistered = session?.type === "REGISTERED";
  const isEditor = session?.type === "EDITOR";

  if (booting) {
    return <div className="boot-screen">Initializing Secure Connection...</div>;
  }

  return (
    <Routes>
      {/* -------------------- PUBLIC & USER APP -------------------- */}
      <Route path="/" element={<SiteLayout />}>
        <Route index element={<Navigate to="/news" replace />} />
        <Route path="news" element={<HomePage />} />
        <Route path="feed" element={<Navigate to="/news" replace />} />
        <Route path="home" element={<Navigate to="/news" replace />} />

        {/* Auth Pages */}
        <Route path="auth" element={<Navigate to="/auth/login" replace />} />
        <Route path="auth/signup" element={<AuthPage mode="signup" />} />
        <Route path="auth/login" element={<AuthPage mode="login" />} />

        {/* Dashboards */}
        <Route path="dashboard/notifications" element={isRegistered || isEditor ? <div className="sci-fi-panel" style={{padding: '2rem'}}><h3>Neural Notifications Active</h3><p>No new alerts.</p></div> : <Navigate to="/auth/login" replace />} />
        <Route path="apply-editor" element={isRegistered ? <ApplyEditorPage /> : <Navigate to="/auth/login" replace />} />

        <Route path="editor/workspace" element={isEditor ? <EditorPage /> : <Navigate to="/auth/login" replace />} />
        <Route path="editor/profile" element={isEditor ? <div className="sci-fi-panel" style={{padding: '2rem'}}><h3>Editor Profile</h3><p>Identity confirmed.</p></div> : <Navigate to="/auth/login" replace />} />

        <Route path="news" element={<FeedPage />} />

        {/* Legacy & Misc Pages */}
        <Route path="cms" element={<CmsPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}