import { useEffect, useState } from "react";
import { IndianRupee, TrendingUp, CheckCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import DataTable, { type Column } from "@/components/DataTable";
import PageLoader from "@/components/PageLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminAPI } from "@/services/api";
import { downloadCSV } from "@/lib/csv";
import { errorMessage, formatDate, formatINR } from "@/lib/format";
import { axisProps, chartTooltipStyle, gridProps } from "@/lib/chart";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { type Status } from "@/components/StatusBadge";

interface Transaction {
  _id: string;
  transactionId: string;
  amount: number;
  platformFee: number;
  status: string;
  createdAt: string;
  userId?: { name: string; email: string };
  providerId?: { name: string };
  bookingId?: { bookingId: string; stationName: string };
}

interface TransactionData {
  totalRevenue: number;
  platformRevenue: number;
  completedPayments: number;
  monthly: { label: string; total: number }[];
  transactions: Transaction[];
}

const Transactions = () => {
  const [data, setData] = useState<TransactionData | null>(null);

  useEffect(() => {
    adminAPI.getTransactions({ limit: 200 }).then(({ data }) => setData(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load transactions")));
  }, []);

  if (!data) return <PageLoader label="Loading transactions..." />;

  const exportCSV = () =>
    downloadCSV(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, data.transactions.map((t) => ({
      "Transaction ID": t.transactionId,
      Date: formatDate(t.createdAt),
      Booking: t.bookingId?.bookingId,
      Station: t.bookingId?.stationName,
      User: t.userId?.name,
      Provider: t.providerId?.name,
      Amount: t.amount,
      "Platform fee": t.platformFee,
      Status: t.status,
    })));

  const columns: Column<Transaction>[] = [
    { header: "ID", cell: (t) => <span className="font-mono text-xs">{t.transactionId}</span> },
    { header: "Station", cell: (t) => t.bookingId?.stationName || "—", className: "hidden md:table-cell" },
    { header: "User", cell: (t) => t.userId?.name || "Deleted user", className: "hidden sm:table-cell" },
    { header: "Provider", cell: (t) => t.providerId?.name || "Deleted provider", className: "hidden lg:table-cell" },
    { header: "Amount", cell: (t) => <span className="font-semibold text-primary">{formatINR(t.amount)}</span> },
    { header: "Fee", cell: (t) => formatINR(t.platformFee), className: "hidden md:table-cell" },
    { header: "Date", cell: (t) => formatDate(t.createdAt), className: "hidden sm:table-cell" },
    { header: "Status", cell: (t) => <StatusBadge status={t.status as Status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Payments collected at stations and platform fees."
        actions={
          <Button onClick={exportCSV} disabled={!data.transactions.length} variant="outline">
            <Download /> Download CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        <StatCard icon={IndianRupee} label="Total collected" value={formatINR(data.totalRevenue)} index={0} />
        <StatCard icon={TrendingUp} label="Platform fees" value={formatINR(data.platformRevenue)} tone="accent" index={1} />
        <StatCard icon={CheckCircle} label="Completed payments" value={data.completedPayments} tone="electric" index={2} />
      </div>

      <ChartCard title="Revenue per month" subtitle="Collected at stations">
        <BarChart data={data.monthly}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis width={52} {...axisProps} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} formatter={(value: number) => formatINR(value)} />
          <Bar dataKey="total" name="Revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ChartCard>

      <Card className="enter">
        <CardHeader className="pb-2">
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={data.transactions} rowKey={(t) => t._id} empty="No transactions yet" />
        </CardContent>
      </Card>
    </>
  );
};

export default Transactions;
