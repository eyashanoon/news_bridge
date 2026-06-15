import { ChartFrame } from "./ChartFrame";
import { expandedPlotHeight } from "./chartSizing";
import { formatChartValue } from "./chartUtils";

export function BarChart({
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
  const barArea = vbWidth - 20;
  const barWidth = Math.max(4, Math.min(48, (barArea / count) * 0.6));
  const gap = count > 1 ? (barArea - barWidth * count) / (count - 1) : 0;
  const labelSlice = expanded ? 18 : 10;

  const chart = (
    <div
      className={`admin-chart admin-bar-chart${expanded ? " admin-chart-expanded" : ""}`}
      style={{ height: chartHeight }}
    >
      <svg
        viewBox={`0 0 ${vbWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", maxWidth: "100%", overflow: "visible" }}
      >
        {data.map((item, i) => {
          const val = item[valueKey] || 0;
          const barH = (val / max) * (chartHeight - 40);
          const x = 10 + i * (barWidth + gap);
          const y = chartHeight - 24 - barH;
          return (
            <g key={item[labelKey] ?? i}>
              <rect x={x} y={y} width={barWidth} height={barH} rx={2} fill={color} opacity={0.85} />
              <text x={x + barWidth / 2} y={chartHeight - 6} textAnchor="middle" fill="#94a3b8" fontSize={expanded ? 11 : 9}>
                {String(item[labelKey] ?? "").slice(0, labelSlice)}
              </text>
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="600">
                {formatChartValue(val)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );

  return (
    <ChartFrame title={title} description={description} expanded={expanded}>
      {chart}
    </ChartFrame>
  );
}
