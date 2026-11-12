import { useEffect, useState } from "react";
import { Star, TrendingUp, Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import DataTable, { type Column } from "@/components/DataTable";
import PageLoader from "@/components/PageLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { providerAPI } from "@/services/api";
import { errorMessage, formatINR } from "@/lib/format";
import { AREA_FILL, CHART_COLORS, areaGradient, axisProps, chartTooltipStyle, gridProps } from "@/lib/chart";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

interface StationRow {
  name: string;
  bookings: number;
  revenue: number;
  rating: number;
  approved: boolean;
}

interface AnalyticsData {
  monthlyBookings: { label: string; count: number }[];
  usage: { name: string; value: number }[];
  totalBookings: number;
  completionRate: number;
  cancellationRate: number;
  utilization: number;
  averageRating: number | null;
  mostBookedStation: string | null;
  topEarningDay: string | null;
  stations: StationRow[];
}

const columns: Column<StationRow>[] = [
  { header: "Station", cell: (s) => <span className="font-semibold">{s.name}</span> },
  { header: "Bookings", cell: (s) => s.bookings },
  { header: "Revenue", cell: (s) => formatINR(s.revenue) },
  { header: "Rating", cell: (s) => (s.rating ? s.rating.toFixed(1) : "—"), className: "hidden sm:table-cell" },
  { header: "Status", cell: (s) => <StatusBadge status={s.approved ? "live" : "pending"} />, className: "hidden sm:table-cell" },
];

const Analytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    providerAPI.getAnalytics().then(({ data }) => setData(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load analytics")));
  }, []);

  if (!data) return <PageLoader label="Loading analytics..." />;

  const insights = [
    { icon: Zap, label: "Most booked station", value: data.mostBookedStation || "—" },
    { icon: TrendingUp, label: "Top earning day", value: data.topEarningDay || "—", tone: "electric" as const },
    { icon: Clock, label: "Utilization (30 days)", value: `${data.utilization}%` },
    { icon: Star, label: "Average rating", value: data.averageRating ? `${data.averageRating}/5` : "No ratings", tone: "accent" as const },
  ];

  return (
    <>
      <PageHeader title="Analytics" description={`${data.totalBookings} bookings · ${data.completionRate}% completed · ${data.cancellationRate}% cancelled`} />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {insights.map((insight, index) => (
          <StatCard key={insight.label} {...insight} index={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <ChartCard title="Bookings per month" subtitle="Last 6 months">
          <AreaChart data={data.monthlyBookings}>
            {areaGradient()}
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} width={32} {...axisProps} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Area type="monotone" dataKey="count" name="Bookings" stroke="hsl(var(--primary))" strokeWidth={2.5} fill={AREA_FILL} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Bookings by time of day" empty={!data.usage.some((u) => u.value)}>
          <PieChart>
            <Pie data={data.usage} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">
              {data.usage.map((entry, index) => (
                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend />
          </PieChart>
        </ChartCard>
      </div>

      <Card className="enter">
        <CardHeader className="pb-2">
          <CardTitle>Station performance</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={data.stations} rowKey={(s) => s.name} empty="Add a station to see its performance" />
        </CardContent>
      </Card>
    </>
  );
};

export default Analytics;
