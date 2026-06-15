import { useSession } from "../../context/SessionContext";
import { DashboardOverview } from "../features/DashboardOverview";

export default function DashboardPage() {
  const { session } = useSession();
  return <DashboardOverview session={session} />;
}
