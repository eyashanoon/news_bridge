import { ChartFrame } from "./ChartFrame";
import { expandedDonutSize } from "./chartSizing";
import { formatChartValue } from "./chartUtils";

export function DonutChart({
  data,
  labelKey = "label",
  valueKey = "value",
  size = 160,
  expanded = false,
  title,
  description,
}) {
  if (!data?.length) {
    return <div className="admin-chart-empty">No data available</div>;
  }

  const chartSize = expanded ? expandedDonutSize(size) : size;
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0) || 1;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const strokeW = expanded ? 24 : 20;
  const radius = expanded ? 72 : 60;

  let cumulative = 0;
  const segments = data.map((d) => {
    const val = d[valueKey] || 0;
    const start = cumulative;
    cumulative += val;
    return { ...d, startAngle: (start / total) * 360, endAngle: (cumulative / total) * 360 };
  });

  const palette = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

  function describeArc(cx, cy, r, startDeg, endDeg) {
    const start = polarToCartesian(cx, cy, r, endDeg);
    const end = polarToCartesian(cx, cy, r, startDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return [`M ${start.x} ${start.y}`, `A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`].join(" ");
  }

  function polarToCartesian(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const chart = (
    <div className={`admin-donut-wrap${expanded ? " admin-chart-expanded" : ""}`}>
      <svg viewBox={`0 0 ${chartSize} ${chartSize}`} style={{ maxWidth: "100%", height: "auto", width: "100%" }}>
        {segments.map((d, i) => (
          <path
            key={d[labelKey] ?? i}
            d={describeArc(cx, cy, radius, d.startAngle, d.endAngle)}
            fill="none"
            stroke={palette[i % palette.length]}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#e2e8f0" fontSize={expanded ? 22 : 18} fontWeight="700">
          {total}
        </text>
        <text x={cx} y={cy + (expanded ? 16 : 14)} textAnchor="middle" fill="#64748b" fontSize={expanded ? 11 : 10}>
          Total
        </text>
      </svg>
      <ul className="admin-donut-legend">
        {data.map((d, i) => (
          <li key={d[labelKey] ?? i}>
            <span className="legend-dot" style={{ background: palette[i % palette.length] }} />
            <span className="legend-label">{d[labelKey]}</span>
            <span className="legend-value">{formatChartValue(d[valueKey] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <ChartFrame title={title} description={description} expanded={expanded}>
      {chart}
    </ChartFrame>
  );
}
