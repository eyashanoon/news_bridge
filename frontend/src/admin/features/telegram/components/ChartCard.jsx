import { Card } from "../../../design-system/Card";
import { ExpandableChartArea } from "../../../analytics/ExpandableChartArea";

export function ChartCard({ title, subtitle, description, children, actions, expandable = true, className = "" }) {
  const chartDescription = description ?? subtitle;
  const body = expandable ? (
    <ExpandableChartArea title={title} description={chartDescription}>
      {children}
    </ExpandableChartArea>
  ) : (
    children
  );

  return (
    <Card className={`tg-chart-card ${className}`.trim()}>
      <div className="tg-chart-card-header">
        <div>
          <h4>{title}</h4>
          {subtitle && !expandable ? <p>{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="tg-chart-card-body">{body}</div>
    </Card>
  );
}
