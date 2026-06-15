/**
 * @deprecated Admin routes now use src/admin/pages/* modules.
 * Kept for backward compatibility during Phase 0 migration.
 */
import DashboardPage from "../admin/pages/DashboardPage";
import AdminsPage from "../admin/pages/AdminsPage";
import UsersPage from "../admin/pages/UsersPage";
import ArticlesPage from "../admin/pages/ArticlesPage";
import SourcesPage from "../admin/pages/SourcesPage";
import EditorRequestsPage from "../admin/pages/EditorRequestsPage";
import CrawlerPage from "../admin/pages/CrawlerPage";
import TopicsFieldsPage from "../admin/pages/TopicsFieldsPage";
import TelegramPage from "../admin/pages/TelegramPage";

const TARGET_PAGES = {
  admins: AdminsPage,
  users: UsersPage,
  articles: ArticlesPage,
  roots: () => <SourcesPage section="roots" />,
  endpoints: () => <SourcesPage section="endpoints" />,
  "editor-requests": EditorRequestsPage,
  crawler: CrawlerPage,
  fields: () => <TopicsFieldsPage section="fields" />,
  topics: () => <TopicsFieldsPage section="topics" />,
  telegram: TelegramPage,
};

export default function AdminPage({ target }) {
  if (!target) return <DashboardPage />;
  const Page = TARGET_PAGES[target];
  if (!Page) return null;
  return <Page />;
}