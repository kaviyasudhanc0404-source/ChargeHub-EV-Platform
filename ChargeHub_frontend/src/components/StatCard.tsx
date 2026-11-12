import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-primary/15 text-primary ring-primary/25",
  accent: "bg-accent/15 text-accent ring-accent/25",
  electric: "bg-electric/15 text-electric ring-electric/25",
  rose: "bg-destructive/15 text-destructive ring-destructive/25",
};

export type StatTone = keyof typeof TONES;

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
  index?: number; // staggers the entrance
}

const StatCard = ({ icon: Icon, label, value, hint, tone = "primary", index = 0 }: StatCardProps) => (
  <Card className="enter lift relative overflow-hidden p-4 md:p-5" style={{ animationDelay: `${index * 70}ms` }}>
    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">{label}</p>
        <p className="mt-2 truncate font-display text-2xl font-bold text-foreground md:text-3xl">{value}</p>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 md:h-11 md:w-11", TONES[tone])}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
  </Card>
);

export default StatCard;
