import { Suspense, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Calendar, ChevronsLeft, CreditCard, FileText, IndianRupee, LayoutDashboard, LogOut, Map, Settings,
  ShieldCheck, User, UserPlus, Users, Zap, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/brand/Logo";
import PageLoader from "@/components/PageLoader";
import DashboardHeader from "./DashboardHeader";
import { ROLE_LABEL, homePath, useAuthStore, type Role } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

const NAV: Record<Role, NavItem[]> = {
  user: [
    { icon: LayoutDashboard, label: "Dashboard", path: "/user/dashboard" },
    { icon: Map, label: "Find Stations", path: "/user/map" },
    { icon: Calendar, label: "Bookings", path: "/user/bookings" },
    { icon: CreditCard, label: "Payments", path: "/user/payment" },
    { icon: User, label: "Profile", path: "/user/profile" },
  ],
  provider: [
    { icon: LayoutDashboard, label: "Dashboard", path: "/provider/dashboard" },
    { icon: Zap, label: "My Stations", path: "/provider/chargers" },
    { icon: Calendar, label: "Bookings", path: "/provider/bookings" },
    { icon: IndianRupee, label: "Earnings", path: "/provider/earnings" },
    { icon: BarChart3, label: "Analytics", path: "/provider/analytics" },
    { icon: User, label: "Profile", path: "/provider/profile" },
  ],
  admin: [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: ShieldCheck, label: "Providers", path: "/admin/providers" },
    { icon: Zap, label: "Stations", path: "/admin/stations" },
    { icon: IndianRupee, label: "Transactions", path: "/admin/transactions" },
    { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
    { icon: FileText, label: "Reports", path: "/admin/reports" },
    { icon: UserPlus, label: "Admins", path: "/admin/admins" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
  ],
};

const PROFILE_PATH: Record<Role, string> = { user: "/user/profile", provider: "/provider/profile", admin: "/admin/settings" };
const COLLAPSED_KEY = "sidebar-collapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

// Shared shell for the user, provider and admin areas; only the given role may enter. Each panel has its own colour.
const DashboardLayout = ({ role }: { role: Role }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  if (!user) return <Navigate to="/auth" replace state={{ from: pathname }} />;
  if (user.role !== role) return <Navigate to={homePath(user.role)} replace />;

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const current = NAV[role].find((item) => pathname.startsWith(item.path));
  const narrow = collapsed && !drawerOpen; // icon-only rail (desktop only)

  return (
    <div data-panel={role} className="min-h-screen bg-background bg-[radial-gradient(ellipse_80%_50%_at_100%_-10%,hsl(var(--primary)/0.10),transparent)]">
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in lg:hidden" onClick={() => setDrawerOpen(false)} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/70 bg-card transition-[transform,width] duration-300 lg:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[76px]" : "lg:w-64"
        )}
      >
        <div className={cn("flex h-16 items-center gap-3 border-b border-border/70 px-4", narrow && "lg:justify-center lg:px-0")}>
          <Logo showName={!narrow} />
          <span className={cn("ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary", narrow && "lg:hidden")}>
            {ROLE_LABEL[role]}
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV[role].map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={narrow ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  narrow && "lg:justify-center lg:px-0",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />}
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className={cn(narrow && "lg:hidden")}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-border/70 p-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex", narrow && "lg:justify-center lg:px-0")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronsLeft className={cn("h-[18px] w-[18px] transition-transform", collapsed && "rotate-180")} />
            <span className={cn(narrow && "lg:hidden")}>Collapse</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10", narrow && "lg:justify-center lg:px-0")}
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className={cn(narrow && "lg:hidden")}>Log out</span>
          </button>
        </div>
      </aside>

      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <DashboardHeader title={current?.label ?? ROLE_LABEL[role]} profilePath={PROFILE_PATH[role]} onLogout={handleLogout} onMenu={() => setDrawerOpen(true)} />
        {/* Bottom padding keeps the last buttons on a page clear of the floating Ask Me button */}
        <main className="flex-1 px-4 pb-24 pt-6 md:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
