import { useSession } from "../../context/SessionContext";
import { AccessDenied } from "../components/AccessDenied";
import { TelegramControlCenter } from "../features/telegram/TelegramControlCenter";
import { hasRole } from "../utils/roles";

export default function TelegramPage() {
  const { session } = useSession();
  if (!hasRole(session, "MANAGE_TELEGRAM_CHANNELS", "VIEW_TELEGRAM_POSTS", "MANAGE_USERS")) {
    return <AccessDenied />;
  }
  return <TelegramControlCenter session={session} />;
}
