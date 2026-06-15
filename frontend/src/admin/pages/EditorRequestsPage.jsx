import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { EditorRequests } from "../features/EditorRequests";
import { hasRole } from "../utils/roles";

export default function EditorRequestsPage() {
  const { session } = useSession();
  if (!hasRole(session, "VIEW_EDITOR_REQUESTS")) return <AccessDenied />;
  return (
    <div className="admin-panel-container">
      <EditorRequests session={session} />
    </div>
  );
}
