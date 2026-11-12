import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Crosshair, Loader2, LocateFixed, MapPin, Save, SlidersHorizontal, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import StationMap from "@/components/StationMap";
import StationCard from "@/components/StationCard";
import LocationSearch from "@/components/LocationSearch";
import EmptyState from "@/components/EmptyState";
import BookingDialog from "@/components/BookingDialog";
import { stationAPI } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useOrigin, type Origin } from "@/hooks/useOrigin";
import { useBookStation } from "@/hooks/useBookStation";
import { toCard, type Station } from "@/lib/stations";
import { errorMessage, formatAccuracy } from "@/lib/format";
import { cn } from "@/lib/utils";

const SOURCE_TEXT: Record<Origin["source"], string> = {
  default: "your default location",
  gps: "your current location",
  search: "searched place",
  map: "pinned on the map",
};

const SORTERS: Record<string, (a: Station, b: Station) => number> = {
  distance: (a, b) => (a.distance?.km ?? Infinity) - (b.distance?.km ?? Infinity),
  price: (a, b) => a.pricing.ratePerHour - b.pricing.ratePerHour,
  availability: (a, b) => Number(b.availability.isAvailable) - Number(a.availability.isAvailable) || SORTERS.distance(a, b),
};

const FILTERS: { value: string; label: string; test: (s: Station) => boolean }[] = [
  { value: "all", label: "All", test: () => true },
  { value: "car", label: "Car", test: (s) => s.vehicleType !== "bike" },
  { value: "bike", label: "Bike", test: (s) => s.vehicleType !== "car" },
  { value: "online", label: "Online now", test: (s) => s.availability.isAvailable },
];

// Map + list of charging stations. Open to everyone at /stations; booking needs a driver account.
const StationFinder = ({ publicPage = false }: { publicPage?: boolean }) => {
  const [params, setParams] = useSearchParams();
  const { user } = useAuthStore();
  const { origin, originKey, picking, setPicking, chooseOrigin, locateMe, locating, roughFix, saveAsDefault, savingDefault } = useOrigin();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("distance");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { bookingStation, book, closeBooking } = useBookStation();

  // Nearest first with road distances when a location is known (latest request wins)
  useEffect(() => {
    let current = true;
    setLoading(true);
    const request = origin ? stationAPI.getNearby(origin) : stationAPI.getAllStations();
    request
      .then(({ data }) => current && setStations(data.data))
      .catch((error) => current && toast.error(errorMessage(error, "Failed to load charging stations")))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey]);

  const openBooking = (id: string) => {
    const station = stations.find((s) => s._id === id);
    if (station) book(station);
  };

  const selectStation = (id: string) => {
    setSelectedId(id);
    document.getElementById(`station-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // Links into the map: "?book=<id>" (back from sign-in) opens that booking, "?focus=<id>" (home page) highlights it
  const bookParam = params.get("book");
  const focusParam = params.get("focus");
  useEffect(() => {
    if ((!bookParam && !focusParam) || !stations.length) return;
    setParams({}, { replace: true });
    if (bookParam) openBooking(bookParam);
    else if (focusParam) selectStation(focusParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookParam, focusParam, stations]);

  // After the first device reading, the location keeps sharpening for a few seconds
  const refining = locating && origin?.source === "gps" && origin.accuracy != null;
  const cards = useMemo(() => {
    const test = FILTERS.find((f) => f.value === filter)!.test;
    return stations.filter(test).sort(SORTERS[sortBy]).map((s) => toCard(s, origin?.label));
  }, [stations, filter, sortBy, origin?.label]);

  return (
    <div className={cn("space-y-5", publicPage && "container py-6 md:py-10")}>
      <PageHeader
        eyebrow="Station finder"
        title="Find charging stations"
        description="Road distance and drive time to EV chargers in Tamil Nadu and across India."
      />

      <Card className="relative z-10 space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <LocationSearch
            near={origin}
            onSelect={(place) => chooseOrigin(place, "search")}
            placeholder="Search a village, town, landmark or plus code (e.g. C6FH+9XW Ukkaram)"
            className="flex-1"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="outline" onClick={locateMe} title={locating ? "Click to cancel" : "Use where you are now"} className="h-11">
              {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
              {refining ? `Refining ${formatAccuracy(origin?.accuracy ?? 0)}…` : locating ? "Locating…" : "My location"}
            </Button>
            <Button type="button" variant={picking ? "default" : "outline"} onClick={() => setPicking(!picking)} className="h-11">
              <Crosshair /> {picking ? "Click the map…" : "Set on map"}
            </Button>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="col-span-2 sm:w-44" aria-label="Sort stations">
                <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Nearest first</SelectItem>
                <SelectItem value="price">Price (low to high)</SelectItem>
                <SelectItem value="availability">Online first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-2 px-1 text-sm sm:flex-row sm:items-center">
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {origin ? (
              <span>
                Distances from <span className="font-medium text-foreground">{origin.label || `${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}`}</span>
                {` · ${SOURCE_TEXT[origin.source]}`}
                {origin.source === "gps" && origin.accuracy ? ` (${formatAccuracy(origin.accuracy)})` : ""}
              </span>
            ) : locating ? (
              "Finding your location… allow location access if your browser asks."
            ) : (
              "Search your place, use My location or set it on the map to see distances."
            )}
          </p>
          {origin && origin.source !== "default" && !roughFix && user?.role === "user" && (
            <Button size="sm" variant="ghost" onClick={saveAsDefault} disabled={savingDefault} className="self-start text-primary sm:self-auto">
              {savingDefault ? <Loader2 className="animate-spin" /> : <Save />}
              Save as my default location
            </Button>
          )}
        </div>
        {roughFix && (
          <div className="flex flex-col gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent sm:flex-row sm:items-center">
            <p className="flex flex-1 items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your device could only estimate your area (within {formatAccuracy(origin?.accuracy ?? 0)}), so distances are approximate. Laptops
                without GPS find you through nearby Wi-Fi; on a phone hotspot or mobile data they can only guess. Search your place, set it on the
                map, or drag the blue pin.
              </span>
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)} className="shrink-0 self-start border-accent/40 text-accent hover:bg-accent/10 sm:self-auto">
              <Crosshair /> Set on map
            </Button>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter stations">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {picking ? "Click where you are on the map" : `${cards.length} station${cards.length !== 1 ? "s" : ""}${origin ? " · drag the blue pin to adjust" : ""}`}
        </p>
      </div>

      {/* The list always scrolls inside its own panel: beside the map in one screen-high row on laptops, below the map on
          phones (capped at ~2½ cards, so the page stays short however many stations there are). The padding/negative
          margin leaves room for the card hover glow. */}
      <div className="grid gap-4 lg:h-[calc(100vh-8rem)] lg:min-h-[520px] lg:grid-cols-[minmax(340px,0.85fr)_1.15fr] lg:grid-rows-1">
        <div className="scroll-thin order-last -m-3 max-h-[72dvh] space-y-3 overflow-y-auto p-3 lg:order-first lg:max-h-none">
          {loading && !cards.length ? (
            [0, 1, 2].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-muted/60" />)
          ) : cards.length === 0 ? (
            <Card>
              <EmptyState icon={Zap} title="No charging stations here yet" description="Try another filter, or check back soon — new stations appear once approved." />
            </Card>
          ) : (
            cards.map((card, i) => (
              <div key={card.id} className="enter" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                <StationCard station={card} selected={card.id === selectedId} onSelect={setSelectedId} onBook={openBooking} />
              </div>
            ))
          )}
        </div>

        <div className="h-[46vh] min-h-[300px] lg:h-full">
          <StationMap stations={cards} origin={origin} picking={picking} onPick={(point) => chooseOrigin(point, "map")} focusId={selectedId} onSelect={selectStation} />
        </div>
      </div>

      <BookingDialog station={bookingStation} onClose={closeBooking} />
    </div>
  );
};

export default StationFinder;
