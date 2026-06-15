import { ChartFrame } from "./ChartFrame";
import { expandedPlotHeight } from "./chartSizing";
import {
  computeAxisLabelStep,
  formatChartAxisLabel,
  formatChartValue,
  shouldShowAxisLabel,
} from "./chartUtils";

export function LineChart({
  data,
  labelKey = "label",
  valueKey = "value",
  height = 200,
  color = "#0ea5e9",
  expanded = false,
  title,
  description,
}) {
  if (!data?.length) {
    return <div className="admin-chart-empty">No data available</div>;
  }

  const chartHeight = expanded ? expandedPlotHeight(height) : height;
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  const count = data.length;
  const vbWidth = 600;
  const padding = { top: 10, right: 10, bottom: 28, left: 10 };
  const plotW = vbWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;
  const stepX = count > 1 ? plotW / (count - 1) : 0;
  const labelStep = computeAxisLabelStep(count, expanded);
  const showAllValues = count <= 10;
  const labelSlice = expanded ? 12 : 10;

  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + plotH - ((d[valueKey] || 0) / max) * plotH,
    val: d[valueKey] || 0,
    label: formatChartAxisLabel(d[labelKey], labelKey, labelSlice),
    showLabel: shouldShowAxisLabel(i, count, labelStep),
    showValue: showAllValues || shouldShowAxisLabel(i, count, labelStep),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + plotH} L${points[0].x},${padding.top + plotH} Z`;

  const chart = (
    <div
      className={`admin-chart admin-line-chart${expanded ? " admin-chart-expanded" : ""}`}
      style={{ height: chartHeight }}
    >
      <svg
        viewBox={`0 0 ${vbWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", maxWidth: "100%", overflow: "visible" }}
      >
        <path d={areaPath} fill={color} opacity={0.08} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.showLabel ? 3.5 : 2.5} fill={color} stroke="#1e293b" strokeWidth="1.5" />
            {p.showLabel ? (
              <text x={p.x} y={chartHeight - 6} textAnchor="middle" fill="#94a3b8" fontSize={expanded ? 10 : 9}>
                {p.label}
              </text>
            ) : null}
            {p.showValue ? (
              <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="600">
                {formatChartValue(p.val)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );

  return (
    <ChartFrame title={title} description={description} expanded={expanded}>
      {chart}
    </ChartFrame>
  );
}
