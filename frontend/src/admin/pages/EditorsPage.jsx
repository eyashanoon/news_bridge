import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { ManageEditors } from "../features/editors/ManageEditors";
import { hasRole } from "../utils/roles";

export default function EditorsPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tab") === "editors") {
      navigate("/admin/editors", { replace: true });
    }
  }, [searchParams, navigate]);

  if (!hasRole(session, "MANAGE_USERS") && !hasRole(session, "VIEW_EDITOR_INFO")) {
    return <AccessDenied />;
  }

  return <ManageEditors session={session} />;
}
