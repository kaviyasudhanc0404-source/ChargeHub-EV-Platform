import { useEffect, useState } from "react";
import { IndianRupee, TrendingUp, Percent, Download } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import DataTable, { type Column } from "@/components/DataTable";
import PageLoader from "@/components/PageLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { providerAPI } from "@/services/api";
import { downloadCSV } from "@/lib/csv";
import { errorMessage, formatDate, formatINR } from "@/lib/format";
import { axisProps, chartTooltipStyle, gridProps } from "@/lib/chart";
import PageHeader from "@/components/PageHeader";
import type { ProviderStats } from "./Dashboard";

type Payment = ProviderStats["payments"][number];

const columns: Column<Payment>[] = [
  { header: "Transaction", cell: (p) => <span className="font-mono text-xs">{p.transactionId}</span> },
  { header: "Date", cell: (p) => formatDate(p.createdAt) },
  { header: "Booking", cell: (p) => p.bookingId?.stationName || "—", className: "hidden sm:table-cell" },
  { header: "Collected", cell: (p) => <span className="font-semibold text-primary">{formatINR(p.amount)}</span> },
  { header: "Platform fee", cell: (p) => formatINR(p.platformFee), className: "hidden md:table-cell" },
  { header: "Your share", cell: (p) => formatINR(p.providerAmount), className: "hidden md:table-cell" },
];

const Earnings = () => {
  const [stats, setStats] = useState<ProviderStats | null>(null);

  useEffect(() => {
    providerAPI.getStats().then(({ data }) => setStats(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load earnings")));
  }, []);

  if (!stats) return <PageLoader label="Loading earnings..." />;

  const exportCSV = () =>
    downloadCSV(`earnings-${new Date().toISOString().slice(0, 10)}.csv`, stats.payments.map((p) => ({
      Transaction: p.transactionId,
      Date: formatDate(p.createdAt),
      Booking: p.bookingId?.bookingId,
      Station: p.bookingId?.stationName,
      Collected: p.amount,
      "Platform fee": p.platformFee,
      "Your share": p.providerAmount,
    })));

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Payments you collected at your stations."
        actions={
          <Button onClick={exportCSV} disabled={!stats.payments.length} variant="outline">
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        <StatCard icon={IndianRupee} label="Total collected" value={formatINR(stats.earnings.gross)} index={0} />
        <StatCard icon={TrendingUp} label="This month" value={formatINR(stats.earnings.thisMonth)} tone="electric" index={1} />
        <StatCard icon={Percent} label="Platform fee due" value={formatINR(stats.earnings.platformFee)} tone="accent" index={2} />
      </div>

      <ChartCard title="Monthly collections" subtitle="Last 6 months">
        <BarChart data={stats.monthly}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis width={48} {...axisProps} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} formatter={(value: number) => formatINR(value)} />
          <Bar dataKey="total" name="Collected" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ChartCard>

      <Card className="enter">
        <CardHeader className="pb-2">
          <CardTitle>Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={stats.payments} rowKey={(p) => p._id} empty="No completed sessions yet" />
        </CardContent>
      </Card>
    </>
  );
};

export default Earnings;
