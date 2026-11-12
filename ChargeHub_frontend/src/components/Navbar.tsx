import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight, Home, LayoutDashboard, MapPin, PlugZap, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/brand/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { homePath, useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  short: string; // label in the phone dock
  icon: LucideIcon;
}

const LINKS: NavItem[] = [
  { to: "/", label: "Home", short: "Home", icon: Home },
  { to: "/stations", label: "Find Stations", short: "Stations", icon: MapPin },
  { to: "/#providers", label: "For Providers", short: "Providers", icon: PlugZap },
];

// Phones: app-style dock in thumb reach; the current page grows into a labelled pill
const MobileDock = ({ items, isActive }: { items: NavItem[]; isActive: (to: string) => boolean }) => (
  <nav
    aria-label="Main"
    data-mobile-dock
    className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md gap-1 rounded-2xl border border-border/70 p-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.6)] md:hidden"
  >
    {items.map(({ to, short, icon: Icon }) => {
      const active = isActive(to);
      return (
        <Link
          key={to}
          to={to}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-12 min-w-0 items-center justify-center rounded-xl px-3 text-xs font-semibold transition-all duration-300 active:scale-95",
            active ? "flex-[2] bg-primary text-primary-foreground shadow-glow" : "flex-1 text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-300", active ? "ml-1.5 max-w-[6rem] opacity-100" : "max-w-0 opacity-0")}>
            {short}
          </span>
        </Link>
      );
    })}
  </nav>
);

// Public pages: floating pill bar on top (links and account actions from tablet up) plus the dock on phones
const Navbar = () => {
  const { pathname, hash } = useLocation();
  const { user } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (to: string) => (to.includes("#") ? `${pathname}${hash}` === to : pathname === to && !hash);
  const account: NavItem = user
    ? { to: homePath(user.role), label: "Dashboard", short: "Dashboard", icon: LayoutDashboard }
    : { to: "/auth", label: "Sign in", short: "Sign in", icon: UserRound };

  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
        <nav
          className={cn(
            "mx-auto flex h-16 max-w-6xl items-center justify-between rounded-2xl border px-3 transition-all duration-300 sm:px-4",
            scrolled ? "glass border-border/70 shadow-[0_12px_40px_-20px_rgb(0_0_0/0.6)]" : "border-transparent"
          )}
        >
          <Logo />

          <div className="hidden items-center gap-1 rounded-xl bg-muted/50 p-1 md:flex">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                  isActive(link.to) ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 md:flex">
              {user ? (
                <Button asChild>
                  <Link to={account.to}>
                    <account.icon /> {account.label}
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost">
                    <Link to={account.to}>{account.label}</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/auth?mode=register">
                      Get started <ArrowRight />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      <MobileDock items={[...LINKS, account]} isActive={isActive} />
    </>
  );
};

export default Navbar;
