import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { ManageTopics } from "../features/ManageTopics";
import { ManageFields } from "../features/ManageFields";
import { hasRole } from "../utils/roles";

/**
 * Unified content module shell. Routes still use /admin/topics and /admin/fields.
 */
export default function TopicsFieldsPage({ section = "topics" }) {
  const { session } = useSession();

  if (section === "fields") {
    if (!hasRole(session, "MANAGE_USERS", "APPROVE_EDITOR_REQUESTS")) return <AccessDenied />;
    return (
      <div className="admin-panel-container">
        <ManageFields session={session} />
      </div>
    );
  }

  if (!hasRole(session, "MANAGE_EVENTS", "MANAGE_USERS")) return <AccessDenied />;
  return (
    <div className="admin-panel-container">
      <ManageTopics session={session} />
    </div>
  );
}
