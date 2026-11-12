import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Calendar, ChevronRight, FileText, IndianRupee, ShieldCheck, TrendingUp, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import PageLoader from "@/components/PageLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminAPI } from "@/services/api";
import { errorMessage, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalUsers: number;
  totalProviders: number;
  totalStations: number;
  pendingStations: number;
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  todayBookings: number;
  totalRevenue: number;
  platformRevenue: number;
  todayRevenue: number;
  pendingReports: number;
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const RING = 2 * Math.PI * 34;

const Gauge = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col items-center gap-2 text-center">
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" strokeDasharray={RING}
          className="animate-charge" style={{ "--ring-length": RING, "--ring-target": RING * (1 - value / 100) } as React.CSSProperties} />
      </svg>
      <p className="absolute inset-0 grid place-items-center font-display text-xl font-bold">{value}%</p>
    </div>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    adminAPI.getDashboardStats().then(({ data }) => setStats(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load dashboard")));
  }, []);

  if (!stats) return <PageLoader label="Loading dashboard..." />;

  const cards = [
    { icon: Users, label: "Active users", value: stats.totalUsers },
    { icon: ShieldCheck, label: "Active providers", value: stats.totalProviders, tone: "electric" as const },
    { icon: Zap, label: "Live stations", value: stats.totalStations },
    { icon: IndianRupee, label: "Platform revenue", value: formatINR(stats.platformRevenue), tone: "accent" as const },
    { icon: Calendar, label: "Total bookings", value: stats.totalBookings, tone: "electric" as const },
    { icon: TrendingUp, label: "Upcoming bookings", value: stats.activeBookings },
  ];

  const attention = [
    { icon: Zap, label: "Stations awaiting approval", count: stats.pendingStations, to: "/admin/stations" },
    { icon: FileText, label: "Pending reports", count: stats.pendingReports, to: "/admin/reports" },
    { icon: ShieldCheck, label: "Review providers", to: "/admin/providers" },
  ];

  return (
    <>
      <PageHeader eyebrow="Admin console" title="Platform overview" description="Everything happening on ChargeHub right now." />

      {/* Today strip */}
      <section className="enter relative grid gap-4 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/20 via-card to-card p-6 sm:grid-cols-3 md:p-8">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
        {[
          { icon: Activity, label: "Bookings today", value: stats.todayBookings },
          { icon: IndianRupee, label: "Platform revenue today", value: formatINR(stats.todayRevenue) },
          { icon: TrendingUp, label: "Collected at stations (all time)", value: formatINR(stats.totalRevenue) },
        ].map((item) => (
          <div key={item.label} className="relative flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <item.icon className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-2xl font-bold md:text-3xl">{item.value}</p>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="enter">
          <CardHeader className="pb-2">
            <CardTitle>Platform health</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 pt-4">
            <Gauge label="Bookings completed" value={percent(stats.completedBookings, stats.totalBookings)} />
            <Gauge label="Stations approved" value={percent(stats.totalStations, stats.totalStations + stats.pendingStations)} />
            <Gauge label="Platform share" value={percent(stats.platformRevenue, stats.totalRevenue)} />
          </CardContent>
        </Card>

        <Card className="enter">
          <CardHeader className="pb-2">
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {attention.map((item) => (
              <Link key={item.label} to={item.to} className="group flex items-center justify-between rounded-xl border border-border/70 p-3.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <span className="flex items-center gap-3 text-sm font-medium">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><item.icon className="h-4 w-4" /></span>
                  {item.label}
                </span>
                <span className="flex items-center gap-2">
                  {item.count != null && (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", item.count ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground")}>{item.count}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Dashboard;
