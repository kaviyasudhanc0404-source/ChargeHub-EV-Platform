import { cn } from "@/lib/utils";

// Booking, station, account and report states share one look
const STYLES = {
  confirmed: "bg-primary/15 text-primary ring-primary/30",
  completed: "bg-electric/15 text-electric ring-electric/30",
  approved: "bg-primary/15 text-primary ring-primary/30",
  live: "bg-primary/15 text-primary ring-primary/30",
  active: "bg-primary/15 text-primary ring-primary/30",
  resolved: "bg-primary/15 text-primary ring-primary/30",
  online: "bg-primary/15 text-primary ring-primary/30",
  pending: "bg-accent/15 text-accent ring-accent/30",
  cancelled: "bg-destructive/15 text-destructive ring-destructive/30",
  blocked: "bg-destructive/15 text-destructive ring-destructive/30",
  offline: "bg-destructive/15 text-destructive ring-destructive/30",
  "no-show": "bg-muted text-muted-foreground ring-border",
  refunded: "bg-muted text-muted-foreground ring-border",
} as const;

export type Status = keyof typeof STYLES;

const LABELS: Partial<Record<Status, string>> = { "no-show": "Missed" };

const StatusBadge = ({ status, label, className }: { status: Status; label?: string; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset", STYLES[status], className)}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {label ?? LABELS[status] ?? status}
  </span>
);

export default StatusBadge;
