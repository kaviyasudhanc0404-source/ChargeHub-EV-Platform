import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, CheckCircle2, IndianRupee, Plus, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import PageLoader from "@/components/PageLoader";
import StatusBadge, { type Status } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { providerAPI } from "@/services/api";
import { errorMessage, formatClock, formatDate, formatINR } from "@/lib/format";
import { AREA_FILL, areaGradient, axisProps, chartTooltipStyle, gridProps } from "@/lib/chart";

export interface ProviderStats {
  totalStations: number;
  pendingStations: number;
  onlineStations: number;
  completedBookings: number;
  bookingsThisMonth: number;
  upcomingBookings: number;
  earnings: { gross: number; net: number; platformFee: number; thisMonth: number };
  daily: { label: string; total: number }[];
  monthly: { label: string; total: number; count: number }[];
  recentBookings: {
    _id: string;
    userId?: { name: string };
    stationName: string;
    vehicleInfo?: { vehicleName: string };
    bookingDate: string;
    bookingTime: string;
    status: Status;
    pricing: { totalCost: number };
  }[];
  payments: { _id: string; transactionId: string; amount: number; providerAmount: number; platformFee: number; createdAt: string; bookingId?: { bookingId: string; stationName: string } }[];
}

const RING = 2 * Math.PI * 42;

const Dashboard = () => {
  const [stats, setStats] = useState<ProviderStats | null>(null);

  useEffect(() => {
    providerAPI.getStats().then(({ data }) => setStats(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load dashboard")));
  }, []);

  if (!stats) return <PageLoader label="Loading dashboard..." />;

  const onlineShare = stats.totalStations ? stats.onlineStations / stats.totalStations : 0;
  const cards = [
    { icon: Calendar, label: "Upcoming bookings", value: stats.upcomingBookings },
    { icon: CheckCircle2, label: "Sessions completed", value: stats.completedBookings, tone: "electric" as const },
    { icon: TrendingUp, label: "Bookings this month", value: stats.bookingsThisMonth },
    { icon: IndianRupee, label: "Your share (net)", value: formatINR(stats.earnings.net), tone: "electric" as const },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Provider studio"
        title="Your charging business"
        description={stats.pendingStations > 0 ? `${stats.pendingStations} station(s) awaiting admin approval.` : "Stations, bookings and collections at a glance."}
        actions={
          <Button asChild>
            <Link to="/provider/chargers"><Plus /> Add charger</Link>
          </Button>
        }
      />

      {/* Earnings hero + network status */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="enter relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/20 via-card to-card p-6 md:p-8">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            <p className="text-sm font-medium text-muted-foreground">Total collected at your stations</p>
            <p className="mt-2 font-display text-4xl font-bold md:text-5xl">{formatINR(stats.earnings.gross)}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-xl bg-background/70 px-4 py-2 text-sm">
                This month <strong className="ml-1 text-primary">{formatINR(stats.earnings.thisMonth)}</strong>
              </span>
              <span className="rounded-xl bg-background/70 px-4 py-2 text-sm">
                Platform fee due <strong className="ml-1">{formatINR(stats.earnings.platformFee)}</strong>
              </span>
            </div>
          </div>
        </section>

        <Card className="enter flex items-center gap-6 p-6">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 100" className="-rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeLinecap="round" strokeDasharray={RING}
                className="animate-charge" style={{ "--ring-length": RING, "--ring-target": RING * (1 - onlineShare) } as React.CSSProperties} />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <p className="font-display text-2xl font-bold">{stats.onlineStations}<span className="text-base text-muted-foreground">/{stats.totalStations}</span></p>
            </div>
          </div>
          <div>
            <p className="flex items-center gap-2 font-semibold"><Zap className="h-4 w-4 text-primary" /> Chargers online</p>
            <p className="mt-1 text-sm text-muted-foreground">Switch chargers on or off from My Stations so drivers only book what's available.</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <ChartCard title="Last 7 days" subtitle="Amount collected per day" height={250}>
          <AreaChart data={stats.daily}>
            {areaGradient()}
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis width={48} {...axisProps} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => formatINR(value)} />
            <Area type="monotone" dataKey="total" name="Collected" stroke="hsl(var(--primary))" strokeWidth={2.5} fill={AREA_FILL} />
          </AreaChart>
        </ChartCard>

        <Card className="enter">
          <CardHeader className="pb-2">
            <CardTitle>Recent bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentBookings.length === 0 ? (
              <EmptyState icon={Calendar} title="No bookings yet" description="Bookings for your chargers will appear here." compact />
            ) : (
              <ul className="divide-y divide-border/60">
                {stats.recentBookings.map((b) => (
                  <li key={b._id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{b.userId?.name || "Deleted user"} · {b.vehicleInfo?.vehicleName}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.stationName} · {formatDate(b.bookingDate)} {formatClock(b.bookingTime)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-sm font-bold text-primary">{formatINR(b.pricing.totalCost)}</p>
                      <StatusBadge status={b.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Dashboard;
