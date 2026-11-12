import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  to?: string;
  showName?: boolean;
  className?: string;
}

// Brand mark: a bolt in an energy-gradient tile (static — no blinking) plus the wordmark
const Logo = ({ to = "/", showName = true, className }: LogoProps) => (
  <Link to={to} className={cn("group inline-flex items-center gap-2.5 font-display", className)} aria-label="ChargeHub home">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-energy shadow-glow transition-transform duration-300 group-hover:rotate-[-8deg]">
      <Zap className="h-5 w-5 fill-primary-foreground text-primary-foreground" strokeWidth={2.4} />
    </span>
    {showName && (
      <span className="text-lg font-bold tracking-tight text-foreground">
        Charge<span className="text-primary">Hub</span>
      </span>
    )}
  </Link>
);

export default Logo;
