import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { ManageAdmins } from "../features/ManageAdmins";
import { hasRole } from "../utils/roles";

export default function AdminsPage() {
  const { session } = useSession();
  const canAccess =
    hasRole(session, "CREATE_ADMIN") ||
    hasRole(session, "MANAGE_USERS") ||
    hasRole(session, "VIEW_ADMIN_ACTIVITY");
  if (!canAccess) return <AccessDenied />;
  return (
    <div className="admin-panel-container">
      <ManageAdmins session={session} />
    </div>
  );
}
