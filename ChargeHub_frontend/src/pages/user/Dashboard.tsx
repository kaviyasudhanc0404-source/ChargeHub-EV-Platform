import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Battery, Calendar, Car, Clock, MapPin, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import EmptyState from "@/components/EmptyState";
import PageLoader from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { userAPI } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { errorMessage, formatClock, formatDate, formatINR } from "@/lib/format";
import { AREA_FILL, areaGradient, axisProps, chartTooltipStyle, gridProps } from "@/lib/chart";

interface UserStats {
  upcomingBookings: number;
  totalSpent: number;
  totalCharges: number;
  hoursThisMonth: number;
  monthly: { label: string; count: number; total: number }[];
  upcoming: { _id: string; stationName: string; bookingDate: string; bookingTime: string; duration: number; pricing: { totalCost: number } }[];
}

const greeting = () => {
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

const Dashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    userAPI.getStats().then(({ data }) => setStats(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load dashboard")));
  }, []);

  if (!stats) return <PageLoader label="Loading dashboard..." />;

  const next = stats.upcoming[0];
  const cards = [
    { icon: Battery, label: "Upcoming bookings", value: stats.upcomingBookings },
    { icon: Wallet, label: "Amount spent", value: formatINR(stats.totalSpent), tone: "accent" as const },
    { icon: Car, label: "Total charges", value: stats.totalCharges, tone: "electric" as const },
    { icon: Clock, label: "Hours this month", value: `${stats.hoursThisMonth}h` },
  ];

  return (
    <>
      {/* Hero: greeting + next charge */}
      <section className="enter relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/20 via-card to-card p-6 md:p-8">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-medium text-primary">{greeting()},</p>
            <h1 className="mt-1 text-3xl font-bold md:text-4xl">{user?.name?.split(" ")[0]}</h1>
            <p className="mt-2 max-w-md text-muted-foreground">Find a charger near you, book a slot and pay at the station.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/user/map"><MapPin /> Find stations</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/user/bookings">My bookings <ArrowRight /></Link>
              </Button>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-border/70 bg-background/70 p-5 lg:w-80">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next charge</p>
            {next ? (
              <div className="mt-3 flex gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <div className="text-center leading-none">
                    <p className="font-display text-2xl font-bold">{new Date(next.bookingDate).getDate()}</p>
                    <p className="text-[11px] font-semibold uppercase">{new Date(next.bookingDate).toLocaleString("en-IN", { month: "short" })}</p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{next.stationName}</p>
                  <p className="text-sm text-muted-foreground">{formatClock(next.bookingTime)} · {next.duration}h</p>
                  <p className="text-sm font-semibold text-primary">{formatINR(next.pricing.totalCost)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nothing booked yet — your next session will show here.</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <ChartCard title="Charging activity" subtitle="Sessions over the last 6 months" className="lg:col-span-2" height={260}>
          <AreaChart data={stats.monthly}>
            {areaGradient()}
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} width={32} {...axisProps} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Area type="monotone" dataKey="count" name="Charges" stroke="hsl(var(--primary))" strokeWidth={2.5} fill={AREA_FILL} />
          </AreaChart>
        </ChartCard>

        <Card className="enter">
          <CardHeader className="pb-2">
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcoming.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No upcoming bookings"
                compact
                action={
                  <Button asChild size="sm">
                    <Link to="/user/map"><Zap /> Book a charger</Link>
                  </Button>
                }
              />
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {stats.upcoming.map((b) => (
                  <li key={b._id} className="relative">
                    <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                    <p className="text-sm font-semibold">{b.stationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(b.bookingDate)} · {formatClock(b.bookingTime)} · {b.duration}h · {formatINR(b.pricing.totalCost)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Dashboard;
