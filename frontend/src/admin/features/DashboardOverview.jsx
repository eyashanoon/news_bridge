import { useState, useEffect } from "react";
import { getDashboardStats } from "../services/dashboardService";
import { StatCard } from "../design-system/StatCard";

/* ===================== DASHBOARD OVERVIEW ===================== */
export function DashboardOverview({ session }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDashboardStats(session.token).then(setStats)
      .catch(console.error);
  }, [session.token]);

  return (
    <div>
      <div className="admin-page-header">
        <h2>Dashboard</h2>
        <p>System overview and quick stats</p>
      </div>
      <div className="admin-stats-grid">
        <StatCard label="Total Articles" value={stats?.totalArticles ?? "-"} color="var(--brand)" />
        <StatCard label="Registered Users" value={stats?.totalRegisteredUsers ?? "-"} color="#0f766e" />
        <StatCard label="Editors" value={stats?.totalEditors ?? "-"} color="#7c3aed" />
        <StatCard label="Admins" value={stats?.totalAdmins ?? "-"} color="#b45309" />
        <StatCard label="Pending Requests" value={stats?.pendingEditorRequests ?? "-"} color="#dc2626" />
        <StatCard label="Active Session" value={session?.email || "-"} color="#475569" small />
      </div>
    </div>
  );
}
