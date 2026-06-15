import { useEffect, useState } from "react";
import { BarChart } from "../../../analytics";
import { ChartFrame } from "../../../analytics/ChartFrame";
import { ChartCard } from "../components/ChartCard";
import { getRecommendationInsights } from "../../../services/telegramService";

function chart(items) {
  return (items || []).map((d) => ({
    label: d.label,
    value: d.value ?? d.count ?? 0,
    count: d.count ?? d.value ?? 0,
  }));
}

export function ChannelSimilarityGraph({ graph, expanded = false, title, description }) {
  if (!graph?.nodes?.length) {
    return <div className="admin-chart-empty">Not enough channel profiles for similarity graph</div>;
  }

  const nodes = graph.nodes.slice(0, expanded ? 20 : 12);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = (graph.edges || []).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  const width = 640;
  const height = 360;
  const positions = {};
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.35;
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    positions[n.id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), label: n.label };
  });

  const graphDescription =
    description ||
    "Network of channels connected by tag-vector similarity. Thicker edges indicate stronger cosine similarity between merged channel tag profiles.";

  const chart = (
    <div className={`tg-similarity-graph${expanded ? " admin-chart-expanded" : ""}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="tg-similarity-svg" preserveAspectRatio="xMidYMid meet">
        {edges.map((e, i) => {
          const s = positions[e.source];
          const t = positions[e.target];
          if (!s || !t) return null;
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke="#38bdf8"
              strokeOpacity={0.25 + e.similarity * 0.5}
              strokeWidth={1 + e.similarity * 3}
            />
          );
        })}
        {nodes.map((n) => {
          const p = positions[n.id];
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r={expanded ? 20 : 18} fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
              <text x={p.x} y={p.y + (expanded ? 30 : 28)} textAnchor="middle" fill="#94a3b8" fontSize={expanded ? 10 : 9}>
                {String(p.label).slice(0, expanded ? 18 : 14)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );

  return (
    <ChartFrame title={title} description={graphDescription} expanded={expanded}>
      {chart}
    </ChartFrame>
  );
}

export function RecommendationInsightsTab({ session }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getRecommendationInsights(session.token)
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || "Failed to load recommendation insights"))
      .finally(() => setLoading(false));
  }, [session.token]);

  if (loading) return <div className="admin-loading-state">Loading recommendation insights…</div>;
  if (error) return <div className="admin-error">{error}</div>;

  return (
    <div className="tg-tab-panel">
      <div className="tg-charts-grid">
        <ChartCard
          title="Top Recommended Channels"
          description="Channels most frequently surfaced in recommendations, weighted by recent user views."
        >
          <BarChart data={chart(data?.topRecommendedChannels)} valueKey="count" color="#0ea5e9" />
        </ChartCard>
        <ChartCard
          title="Top Recommended Tags"
          description="Tags most often used when generating personalized content recommendations."
        >
          <BarChart data={chart(data?.topRecommendedTags)} valueKey="value" color="#8b5cf6" />
        </ChartCard>
        <ChartCard
          title="Top Recommended Topics"
          description="Topics with the highest recommendation frequency across the user base."
        >
          <BarChart data={chart(data?.topRecommendedTopics)} valueKey="value" color="#22c55e" />
        </ChartCard>
        <ChartCard
          title="Similar Channel Clusters"
          description="Channels clustered by cosine similarity of merged tag vectors (finalTagVector)."
          className="tg-chart-wide"
        >
          <ChannelSimilarityGraph graph={data?.similarityGraph} />
        </ChartCard>
      </div>
    </div>
  );
}
