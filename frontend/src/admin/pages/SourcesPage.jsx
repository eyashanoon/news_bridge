import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { SourcesControlCenter } from "../features/sources/SourcesControlCenter";
import { hasRole } from "../utils/roles";

/**
 * Unified crawl-sources module shell with Roots, Discovery, Endpoints, and Analysis tabs.
 * Legacy routes: /admin/roots and /admin/endpoints (section prop selects initial tab).
 */
export default function SourcesPage({ section = "roots" }) {
  const { session } = useSession();
  if (!hasRole(session, "MANAGE_USERS", "OWNER", "VIEW_CRAWLER_LOGS", "CONTROL_CRAWLER")) {
    return <AccessDenied />;
  }

  return <SourcesControlCenter session={session} section={section} />;
}
