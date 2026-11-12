import { useEffect, useState } from "react";
import { Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import ChartCard from "@/components/ChartCard";
import EmptyState from "@/components/EmptyState";
import PageLoader from "@/components/PageLoader";
import { userAPI } from "@/services/api";
import { errorMessage, formatDate, formatINR } from "@/lib/format";
import { axisProps, chartTooltipStyle, gridProps } from "@/lib/chart";

interface PaymentRow {
  _id: string;
  transactionId: string;
  amount: number;
  createdAt: string;
  bookingId?: { bookingId: string; stationName: string; vehicleInfo?: { vehicleName: string }; duration: number };
}

interface Stats {
  totalSpent: number;
  spentThisMonth: number;
  monthly: { label: string; total: number }[];
  payments: PaymentRow[];
}

const Payment = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    userAPI.getStats().then(({ data }) => setStats(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load payments")));
  }, []);

  if (!stats) return <PageLoader label="Loading payment history..." />;

  return (
    <>
      <PageHeader title="Payments" description="You pay at the station after each session — every payment is recorded here." />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Card-style spending summary */}
        <div className="enter relative overflow-hidden rounded-3xl bg-energy p-6 text-primary-foreground shadow-glow md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-44 w-44 rounded-full border-[20px] border-white/10" />
          <div className="relative flex items-center justify-between">
            <p className="text-sm font-semibold opacity-80">Total spent on charging</p>
            <Wallet className="h-6 w-6 opacity-80" />
          </div>
          <p className="relative mt-6 font-display text-4xl font-bold md:text-5xl">{formatINR(stats.totalSpent)}</p>
          <div className="relative mt-8 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="opacity-70">This month</p>
              <p className="font-display text-xl font-bold">{formatINR(stats.spentThisMonth)}</p>
            </div>
            <div>
              <p className="opacity-70">Payments</p>
              <p className="font-display text-xl font-bold">{stats.payments.length}</p>
            </div>
          </div>
        </div>

        <ChartCard title="Monthly spending" height={220}>
          <BarChart data={stats.monthly}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis width={48} {...axisProps} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} formatter={(value: number) => formatINR(value)} />
            <Bar dataKey="total" name="Spent" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ChartCard>
      </div>

      <Card className="enter">
        <CardHeader className="pb-2">
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.payments.length === 0 ? (
            <EmptyState icon={Receipt} title="No payments yet" description="Completed charging sessions will appear here." />
          ) : (
            <ul className="divide-y divide-border/60">
              {stats.payments.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Receipt className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.bookingId?.stationName || "Charging session"}
                        {p.bookingId?.vehicleInfo?.vehicleName ? ` · ${p.bookingId.vehicleInfo.vehicleName}` : ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{formatDate(p.createdAt)} · {p.transactionId}</p>
                    </div>
                  </div>
                  <p className="shrink-0 font-display text-lg font-bold text-primary">{formatINR(p.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default Payment;
