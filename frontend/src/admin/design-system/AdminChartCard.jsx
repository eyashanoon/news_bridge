import { Card } from "./Card";
import { ExpandableChartArea } from "../analytics/ExpandableChartArea";

export function AdminChartCard({ title, subtitle, description, children, className = "" }) {
  const chartDescription = description ?? subtitle;
  return (
    <Card className={`admin-chart-card ${className}`.trim()}>
      <h3>{title}</h3>
      <ExpandableChartArea title={title} description={chartDescription}>
        {children}
      </ExpandableChartArea>
    </Card>
  );
}
