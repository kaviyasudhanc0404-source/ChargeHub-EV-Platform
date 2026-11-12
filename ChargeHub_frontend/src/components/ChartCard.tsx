import type { ReactElement, ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactElement; // a single Recharts chart
  empty?: boolean;
  footer?: ReactNode;
  height?: number;
  className?: string;
}

// Card with a responsive chart area and an empty state
const ChartCard = ({ title, subtitle, children, empty, footer, height = 280, className }: ChartCardProps) => (
  <Card className={cn("enter", className)}>
    <CardHeader className="pb-2">
      <CardTitle>{title}</CardTitle>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </CardHeader>
    <CardContent className="px-2 sm:px-6">
      {empty ? (
        <div style={{ height }} className="grid place-items-center">
          <EmptyState icon={BarChart3} title="No data yet" compact />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      )}
      {footer}
    </CardContent>
  </Card>
);

export default ChartCard;
