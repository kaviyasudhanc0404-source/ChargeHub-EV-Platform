import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ReportIssueDialog from "@/components/ReportIssueDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { notificationAPI } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { avatarUrl, formatDateTime, getInitials } from "@/lib/format";
import { cn, iconButton } from "@/lib/utils";

interface Notification {
  id: string;
  message: string;
  time?: string;
  link?: string;
}

interface DashboardHeaderProps {
  title: string;
  profilePath: string;
  onLogout: () => void;
  onMenu: () => void;
}

const DashboardHeader = ({ title, profilePath, onLogout, onMenu }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Refresh notifications whenever the page changes
  useEffect(() => {
    notificationAPI.getAll().then(({ data }) => setNotifications(data.data)).catch(() => setNotifications([]));
  }, [pathname]);

  const avatar = avatarUrl(user);

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 px-4 md:px-6 lg:px-8">
      <button type="button" onClick={onMenu} className={cn(iconButton, "lg:hidden")} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <p className="truncate font-display text-lg font-semibold">{title}</p>

      <div className="ml-auto flex items-center gap-2">
        {user?.role !== "admin" && <ReportIssueDialog />}
        <ThemeToggle className="hidden sm:grid" />

        <Popover>
          <PopoverTrigger asChild>
            <button className={iconButton} aria-label="Notifications">
              <Bell className="h-[18px] w-[18px]" />
              {notifications.length > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {notifications.length}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-3" align="end">
            <p className="mb-2 px-1 font-display font-semibold">Notifications</p>
            {notifications.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">You're all caught up.</p>
            ) : (
              <div className="max-h-80 space-y-1.5 overflow-y-auto">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => n.link && navigate(n.link)}
                    className="w-full rounded-xl border-l-2 border-primary bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
                  >
                    <p className="text-sm">{n.message}</p>
                    {n.time && <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.time)}</p>}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Account menu">
              <Avatar className="h-10 w-10 ring-2 ring-primary/60 ring-offset-2 ring-offset-background transition-transform hover:scale-105">
                <AvatarImage src={avatar} />
                <AvatarFallback className="bg-energy font-display font-bold text-primary-foreground">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <div className="mb-3 flex items-center gap-3 px-1">
              <Avatar className="h-11 w-11">
                <AvatarImage src={avatar} />
                <AvatarFallback className="bg-energy font-display font-bold text-primary-foreground">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-1 border-t border-border pt-2">
              <button onClick={() => navigate(profilePath)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted">
                <UserIcon className="h-4 w-4" /> {user?.role === "admin" ? "Settings" : "Profile"}
              </button>
              <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};

export default DashboardHeader;
