import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import SiteLayout from "./components/SiteLayout";
import { useSession } from "./context/SessionContext";
import AuthPage from "./pages/AuthPage";
import CmsPage from "./pages/CmsPage";
import DataPage from "./pages/DataPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ApplyEditorPage from "./pages/ApplyEditorPage";
import FeedPage from "./pages/FeedPage";
import ProfilePage from "./pages/ProfilePage";
import PresenterPage from "./pages/PresenterPage";

export default function App() {
  const { t } = useTranslation();
  const { booting, session } = useSession();
  const isRegistered = session?.type === "REGISTERED";
  const isEditor = session?.type === "EDITOR";

  if (booting) {
    return <div className="boot-screen">{t("initializingSecureConnection", "Initializing Secure Connection...")}</div>;
  }

  return (
    <Routes>
      {/* -------------------- PUBLIC & USER APP -------------------- */}
      <Route path="/" element={<SiteLayout />}>
        <Route index element={<Navigate to="/news" replace />} />
        <Route path="news" element={<HomePage />} />
        <Route path="feed" element={<Navigate to="/news" replace />} />
        <Route path="home" element={<Navigate to="/news" replace />} />
        <Route path="news/trending" element={<HomePage />} />
        <Route path="news/saved" element={<HomePage />} />
        <Route path="news/avatar" element={<HomePage />} />
        <Route path="news/apply-editor" element={<HomePage />} />
        <Route path="news/topics/:topicId" element={<HomePage />} />
        <Route path="news/category/:categoryName" element={<HomePage />} />
        <Route path="news/telegram" element={<HomePage />} />

        {/* Auth Pages */}
        <Route path="auth" element={<Navigate to="/auth/login" replace />} />
        <Route path="auth/signup" element={<AuthPage mode="signup" />} />
        <Route path="auth/login" element={<AuthPage mode="login" />} />

        {/* Dashboards */}
        <Route path="dashboard/notifications" element={isRegistered || isEditor ? <div className="sci-fi-panel" style={{padding: '2rem'}}><h3>{t("notificationsActive", "Neural Notifications Active")}</h3><p>{t("noNewAlerts", "No new alerts.")}</p></div> : <Navigate to="/auth/login" replace />} />
        <Route path="apply-editor" element={isRegistered ? <ApplyEditorPage /> : <Navigate to="/auth/login" replace />} />

        <Route path="editor/profile" element={isEditor ? <ProfilePage /> : <Navigate to="/auth/login" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/:username" element={<ProfilePage />} />


        {/* Legacy & Misc Pages */}
        <Route path="cms" element={<CmsPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
      {/* Full-screen AI Presenter (outside SiteLayout — no sidebar/header) */}
      <Route path="news/presenter" element={<PresenterPage />} />
    </Routes>
  );
}