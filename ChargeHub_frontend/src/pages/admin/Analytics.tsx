import { useEffect, useState } from "react";
import { Users, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import PageLoader from "@/components/PageLoader";
import { adminAPI } from "@/services/api";
import { errorMessage } from "@/lib/format";
import { AREA_FILL, CHART_COLORS, areaGradient, axisProps, chartTooltipStyle, gridProps } from "@/lib/chart";
import PageHeader from "@/components/PageHeader";

interface AnalyticsData {
  userGrowth: { label: string; count: number }[];
  monthlyBookings: { label: string; count: number }[];
  topProviders: { name: string; bookings: number }[];
  chargerSplit: { name: string; value: number }[];
  insights: { userGrowth: number; providerGrowth: number; revenueGrowth: number; utilization: number };
}

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

const Analytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    adminAPI.getAnalytics().then(({ data }) => setData(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load analytics")));
  }, []);

  if (!data) return <PageLoader label="Loading analytics..." />;

  const insights = [
    { icon: Users, label: "New users vs last month", value: signed(data.insights.userGrowth) },
    { icon: ShieldCheck, label: "New providers vs last month", value: signed(data.insights.providerGrowth), tone: "electric" as const },
    { icon: TrendingUp, label: "Revenue vs last month", value: signed(data.insights.revenueGrowth), tone: "accent" as const },
    { icon: Zap, label: "Station utilization (30 days)", value: `${data.insights.utilization}%` },
  ];

  return (
    <>
      <PageHeader title="Analytics & insights" description="Platform performance over the last 6 months." />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {insights.map((insight, index) => (
          <StatCard key={insight.label} {...insight} index={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <ChartCard title="New user registrations">
          <AreaChart data={data.userGrowth}>
            {areaGradient()}
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} width={32} {...axisProps} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Area type="monotone" dataKey="count" name="Users" stroke="hsl(var(--primary))" strokeWidth={2.5} fill={AREA_FILL} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Bookings per month">
          <BarChart data={data.monthlyBookings}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} width={32} {...axisProps} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="count" name="Bookings" fill="hsl(var(--electric))" radius={[8, 8, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top providers by bookings" empty={!data.topProviders.length}>
          <BarChart data={data.topProviders} layout="vertical">
            <CartesianGrid {...gridProps} vertical horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="name" width={110} {...axisProps} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="bookings" fill="hsl(var(--accent))" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Live chargers by type" empty={!data.chargerSplit.length}>
          <PieChart>
            <Pie data={data.chargerSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">
              {data.chargerSplit.map((entry, index) => (
                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend />
          </PieChart>
        </ChartCard>
      </div>
    </>
  );
};

export default Analytics;
