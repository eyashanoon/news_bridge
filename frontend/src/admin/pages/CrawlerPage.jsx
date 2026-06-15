import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { ManageCrawler } from "../features/ManageCrawler";
import { hasRole } from "../utils/roles";

export default function CrawlerPage() {
  const { session } = useSession();
  if (!hasRole(session, "VIEW_CRAWLER_LOGS", "CONTROL_CRAWLER")) return <AccessDenied />;
  return (
    <div className="admin-panel-container">
      <ManageCrawler session={session} />
    </div>
  );
}
