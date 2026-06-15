import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageShell } from "../../design-system/PageShell";
import { Tabs } from "../../design-system/Tabs";
import { DiscoverySessionProvider } from "./DiscoverySessionManager";
import { RootsTab } from "./RootsTab";
import { DiscoveryTab } from "./DiscoveryTab";
import { EndpointsTab } from "./EndpointsTab";
import { AnalysisTab } from "./AnalysisTab";
import { useDiscoverySession } from "./DiscoverySessionManager";

const TABS = [
  { id: "roots", label: "Roots", path: "/admin/roots" },
  { id: "discovery", label: "Discovery", path: "/admin/roots" },
  { id: "endpoints", label: "Endpoints", path: "/admin/endpoints" },
  { id: "analysis", label: "Analysis", path: "/admin/roots" },
];

const TAB_FROM_SECTION = {
  roots: "roots",
  endpoints: "endpoints",
};

function SourcesTabsInner({ session, initialTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(initialTab || "roots");
  const { loading: discoveryLoading, hasSession } = useDiscoverySession();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    } else if (location.pathname === "/admin/endpoints") {
      setActiveTab("endpoints");
    }
  }, [location.pathname, location.search]);

  const tabItems = useMemo(() => TABS.map((t) => ({
    id: t.id,
    label: t.id === "discovery" && (discoveryLoading || hasSession)
      ? `${t.label} ●`
      : t.label,
  })), [discoveryLoading, hasSession]);

  const onTabChange = (id) => {
    setActiveTab(id);
    const path = id === "endpoints" ? "/admin/endpoints" : "/admin/roots";
    navigate(`${path}?tab=${id}`, { replace: true });
  };

  return (
    <PageShell
      title="Crawl Sources"
      subtitle="Manage roots, run discovery, configure endpoints, and analyze site structure"
      tabs={<Tabs items={tabItems} activeId={activeTab} onChange={onTabChange} />}
    >
      {activeTab === "roots" && (
        <RootsTab session={session} onNavigateDiscovery={() => onTabChange("discovery")} />
      )}
      {activeTab === "discovery" && <DiscoveryTab session={session} />}
      {activeTab === "endpoints" && <EndpointsTab session={session} />}
      {activeTab === "analysis" && <AnalysisTab session={session} />}
    </PageShell>
  );
}

export function SourcesControlCenter({ session, section }) {
  const initialTab = TAB_FROM_SECTION[section] || "roots";

  return (
    <DiscoverySessionProvider session={session}>
      <SourcesTabsInner session={session} initialTab={initialTab} />
    </DiscoverySessionProvider>
  );
}
