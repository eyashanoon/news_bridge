import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { ManageArticles } from "../features/ManageArticles";
import { hasRole } from "../utils/roles";

export default function ArticlesPage() {
  const { session } = useSession();
  if (!hasRole(session, "UPDATE_ANY_ARTICLE", "DELETE_ANY_ARTICLE")) return <AccessDenied />;
  return (
    <div className="admin-panel-container">
      <ManageArticles session={session} />
    </div>
  );
}
