import { useState } from "react";
import { Bike, Car, Check, Copy, Navigation, Plug, Star, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { cn, copyText } from "@/lib/utils";
import { VEHICLE_TEXT } from "@/lib/format";

export interface StationCardData {
  id: string;
  name: string;
  location: string;
  type: string;
  rate: number;
  available: boolean;
  lat: number;
  lng: number;
  distance?: string;
  duration?: string;
  distanceMethod?: "road" | "estimate" | "straight";
  vehicleType?: "car" | "bike" | "both";
  connectorType?: string;
  rating?: { average: number; count: number };
  fromLabel?: string; // where the distance is measured from
}

const DISTANCE_TEXT = { road: "by road", estimate: "by road (est.)", straight: "straight line" };

interface StationCardProps {
  station: StationCardData;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onBook: (id: string) => void;
  compact?: boolean; // same-size card for narrow spaces such as the assistant panel (fills its slot's height)
}

const StationCard = ({ station, selected, onSelect, onBook, compact }: StationCardProps) => {
  const { id, name, location, type, rate, available, lat, lng, distance, duration, distanceMethod = "road", fromLabel, vehicleType = "both", connectorType, rating } = station;
  const chips = [
    { icon: Zap, text: type },
    connectorType && { icon: Plug, text: connectorType },
    { icon: vehicleType === "bike" ? Bike : Car, text: VEHICLE_TEXT[vehicleType] },
    rating && rating.count > 0 && { icon: Star, text: `${rating.average.toFixed(1)} (${rating.count})` },
  ].filter(Boolean) as { icon: typeof Zap; text: string }[];
  const [copied, setCopied] = useState(false);

  const copyLocation = async (e: React.MouseEvent) => {
    e.stopPropagation(); // copying should not also select the card
    try {
      await copyText(location);
      setCopied(true);
      toast.success("Address copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the address");
    }
  };

  return (
    <article
      id={`station-${id}`}
      onClick={() => onSelect?.(id)}
      className={cn(
        "lift relative cursor-pointer rounded-2xl border bg-card p-4", // relative: keeps screen-reader-only text inside the card
        compact ? "flex h-full min-w-0 flex-col" : "sm:p-5",
        selected ? "border-primary/70 shadow-glow" : "border-border/70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={cn("truncate text-base font-semibold", !compact && "sm:text-lg")}>{name}</h3>
          {/* Tap or click to copy; the icon shows on hover/focus, and always on touch screens */}
          <button
            type="button"
            onClick={copyLocation}
            title="Copy address"
            aria-label={`Copy address: ${location}`}
            className="group/copy mt-0.5 flex max-w-full items-center gap-1.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="line-clamp-1">{location}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-100 group-focus-visible/copy:opacity-100 [@media(hover:none)]:opacity-70" />
            )}
          </button>
        </div>
        <StatusBadge status={available ? "online" : "offline"} />
      </div>

      {distance && (
        <div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-muted/50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="font-display text-2xl font-bold leading-none text-primary">{distance}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={fromLabel && `From ${fromLabel}`}>
              {DISTANCE_TEXT[distanceMethod]}
              {fromLabel && ` · from ${fromLabel}`}
            </p>
          </div>
          {duration && <p className="whitespace-nowrap text-sm font-semibold text-foreground">≈ {duration}</p>}
        </div>
      )}

      <div className={cn("mt-3 flex flex-wrap gap-1.5", compact && "pb-4")}>
        {chips.map((chip) => (
          <span key={chip.text} className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-xs text-muted-foreground">
            <chip.icon className="h-3.5 w-3.5 text-primary" /> {chip.text}
          </span>
        ))}
      </div>

      {/* In a compact card the price row sits at the bottom, so cards side by side line up */}
      <div className={cn("flex items-center justify-between gap-3 border-t border-border/60 pt-4", compact ? "mt-auto" : "mt-4")}>
        <p className="whitespace-nowrap text-sm">
          <span className="font-display text-lg font-bold">₹{Math.round(rate)}</span>
          <span className="text-muted-foreground">/hour</span>
        </p>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button asChild size="sm" variant="outline" title="Directions">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer">
              <Navigation /> <span className={compact ? "sr-only" : "hidden sm:inline"}>Directions</span>
            </a>
          </Button>
          <Button size="sm" onClick={() => onBook(id)} disabled={!available}>
            {available ? "Book slot" : "Offline"}
          </Button>
        </div>
      </div>
    </article>
  );
};

export default StationCard;
