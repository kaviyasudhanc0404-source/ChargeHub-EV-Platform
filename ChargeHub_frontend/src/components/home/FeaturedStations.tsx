import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, Car, Clock, ShieldCheck } from "lucide-react";
import { useAutoplay } from "@/hooks/useAutoplay";
import { VEHICLE_TEXT, chargerLabel, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import evBackground from "@/assets/ev-hero-background.webp";

export interface FeaturedStation {
  _id: string;
  name: string;
  location: { city: string };
  power: number;
  connectorTypes: string[];
  vehicleType: "car" | "bike" | "both";
  pricing: { ratePerHour: number };
}

const ROTATE_MS = 8000;
const RING = 2 * Math.PI * 70; // circumference of the charging ring

// Shown until real stations arrive (e.g. while the free backend wakes up) or when there are none
const EXAMPLE: FeaturedStation = {
  _id: "",
  name: "Sathy Bus Stand EV Hub",
  location: { city: "Sathyamangalam" },
  power: 50,
  connectorTypes: ["CCS"],
  vehicleType: "car",
  pricing: { ratePerHour: 120 },
};

// Estimated time for a typical battery from 20% to 80% (car ≈ 30 kWh → 18 kWh, bike ≈ 3 kWh → 1.8 kWh),
// assuming the charger delivers ~85% of its rated power
const minutesTo80 = ({ power, vehicleType }: FeaturedStation) => Math.max(1, Math.round(((vehicleType === "bike" ? 1.8 : 18) / (power * 0.85)) * 60));

/**
 * Home page showcase: one real station at a time, switching every 8 s. Data comes with the page's single stats
 * request; switching is done in the browser (see useAutoplay for when it pauses). The dots pick a station directly.
 */
const FeaturedStations = ({ stations }: { stations?: FeaturedStation[] }) => {
  const list = stations?.length ? stations : [EXAMPLE];
  const isExample = !stations?.length;
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setIndex(0), [stations]);

  // Next station every 8 s; the wait starts again after a dot click
  useAutoplay(ref, () => setIndex((i) => (i + 1) % list.length), ROTATE_MS, { enabled: list.length > 1, restartKey: index });

  const station = list[index % list.length];
  const VehicleIcon = station.vehicleType === "bike" ? Bike : Car;
  const minutes = minutesTo80(station);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md">
      <div className="absolute inset-0 -z-10 rounded-[2rem] bg-cover bg-center opacity-30 blur-[2px]" style={{ backgroundImage: `url(${evBackground})` }} />
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary/20 blur-3xl" />

      <Link
        to={isExample ? "/stations" : `/stations?focus=${station._id}`}
        className="block overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 shadow-2xl backdrop-blur-md transition-colors hover:border-primary/40"
        aria-label={`${station.name} — open on the station map`}
      >
        {/* key: each station re-runs the entrance and ring animations */}
        <div key={`${station._id}-${index}`} className="enter p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{isExample ? "Example station" : "Featured station"}</p>
              <p className="truncate font-display font-semibold">{station.name}</p>
              <p className="truncate text-xs text-muted-foreground">{station.location.city} · {chargerLabel(station.power)}</p>
            </div>
            {!isExample && (
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <span className="live-dot" /> Online
              </span>
            )}
          </div>

          <div className="relative mx-auto my-6 grid h-48 w-48 place-items-center">
            <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              <circle
                cx="80" cy="80" r="70" fill="none" stroke="url(#ring)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={RING} className="animate-charge"
                style={{ "--ring-length": RING * 0.8, "--ring-target": RING * 0.2 } as React.CSSProperties}
              />
              <defs>
                <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--electric))" />
                </linearGradient>
              </defs>
            </svg>
            <div className="text-center">
              <Clock className="mx-auto mb-1 h-6 w-6 text-primary" />
              <p className={cn("font-display font-bold", minutes < 60 ? "text-4xl" : "text-2xl")}>{formatDuration(minutes)}</p>
              <p className="text-xs text-muted-foreground">≈ 20% → 80% charge</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[[`${station.power} kW`, "power"], [station.connectorTypes[0] || "—", "connector"], [`₹${Math.round(station.pricing.ratePerHour)}`, "per hour"]].map(([value, unit]) => (
              <div key={unit} className="rounded-xl bg-muted/60 py-2.5">
                <p className="truncate px-1 font-display font-semibold">{value}</p>
                <p className="text-[11px] text-muted-foreground">{unit}</p>
              </div>
            ))}
          </div>
        </div>

      </Link>

      {list.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5" role="tablist" aria-label="Featured stations">
          {list.map((s, i) => (
            <button
              key={s._id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={s.name}
              onClick={() => setIndex(i)}
              className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground")}
            />
          ))}
        </div>
      )}

      <div className="absolute -left-6 top-1/2 hidden animate-float items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs shadow-xl sm:flex">
        <ShieldCheck className="h-4 w-4 text-primary" /> OTP verified
      </div>
      <div className="absolute -right-4 bottom-28 hidden animate-float items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs shadow-xl [animation-delay:1.5s] sm:flex">
        <VehicleIcon className="h-4 w-4 text-electric" /> {VEHICLE_TEXT[station.vehicleType]}
      </div>
    </div>
  );
};

export default FeaturedStations;
