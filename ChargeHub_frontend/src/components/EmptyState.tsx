import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

const EmptyState = ({ icon: Icon, title, description, action, compact }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center text-center", compact ? "py-4" : "py-12 md:py-16")}>
    <span className="relative mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-muted/60">
      <span className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
      <Icon className="relative h-6 w-6 text-primary" />
    </span>
    <p className="font-display font-semibold text-foreground">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
