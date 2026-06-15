import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { ManageUsers } from "../features/ManageUsers";
import { hasRole } from "../utils/roles";

export default function UsersPage() {
  const { session } = useSession();
  if (!hasRole(session, "MANAGE_USERS")) {
    return <AccessDenied />;
  }
  return (
    <div className="admin-panel-container">
      <ManageUsers session={session} />
    </div>
  );
}
