import { useParams } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { EditorDetailWorkspace } from "../features/editors/EditorDetailWorkspace";
import { hasRole } from "../utils/roles";

export default function EditorDetailPage() {
  const { session } = useSession();
  const { id } = useParams();

  if (!hasRole(session, "MANAGE_USERS") && !hasRole(session, "VIEW_EDITOR_INFO")) {
    return <AccessDenied />;
  }

  return <EditorDetailWorkspace session={session} editorId={id} />;
}
