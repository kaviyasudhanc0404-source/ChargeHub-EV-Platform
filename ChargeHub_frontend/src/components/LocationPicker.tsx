import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { AlertTriangle, Loader2, LocateFixed, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import LocationSearch from "@/components/LocationSearch";
import { createMap, pinIcon, toLatLng } from "@/lib/leaflet";
import { LOCATE_ERRORS, useCurrentLocation } from "@/hooks/useCurrentLocation";
import { formatAccuracy } from "@/lib/format";
import { geoAPI, type LatLng, type PinCheck, type StationAddress } from "@/services/api";

interface LocationPickerProps {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  address: StationAddress; // the typed address the pin is checked against
}

// Pick an exact point: type a plus code in the address, search a place, use the device location, then click or drag
// the pin. The pin is checked against the address as both change.
const LocationPicker = ({ value, onChange, address }: LocationPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const gps = useCurrentLocation();
  const [check, setCheck] = useState<PinCheck | null>(null);
  const seenCode = useRef<string>(); // plus code the pin has already been moved to

  // A plus code, search, map click or drag is final: stop the device location from moving the pin afterwards
  const pick = ({ lat, lng }: LatLng) => {
    gps.cancel();
    onChangeRef.current({ lat, lng });
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = createMap(containerRef.current, value ? { center: [value.lat, value.lng], zoom: 16 } : {});
    map.getContainer().classList.add("picking");
    map.on("click", (e: L.LeafletMouseEvent) => pickRef.current(toLatLng(e.latlng)));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the draggable pin in sync with the selected point
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([value.lat, value.lng], { icon: pinIcon("station"), draggable: true })
        .on("dragend", (e) => pickRef.current(toLatLng((e.target as L.Marker).getLatLng())))
        .addTo(map);
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }
    if (!map.getBounds().contains([value.lat, value.lng]) || map.getZoom() < 14) map.setView([value.lat, value.lng], 16);
  }, [value]);

  // Check the pin against the address once typing and dragging settle. A newly typed plus code moves the pin to it.
  const addressKey = [address.address, address.city, address.state].map((part) => part.trim()).join("|");
  useEffect(() => {
    setCheck(null);
    if (!address.address.trim() && !address.city.trim()) return;
    let current = true;
    const timer = window.setTimeout(() => {
      geoAPI
        .checkPin(address, value)
        .then(({ data }) => {
          if (!current) return;
          const { target, mismatch } = data.data;
          if (target?.code && target.code !== seenCode.current) {
            seenCode.current = target.code;
            if (!value || mismatch) return pick(target); // re-checked at the new spot
          }
          setCheck(data.data);
        })
        .catch(() => undefined);
    }, 600);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressKey, value?.lat, value?.lng]);

  // Device location → move the pin there (each improving reading)
  useEffect(() => {
    if (gps.fix) onChangeRef.current({ lat: gps.fix.lat, lng: gps.fix.lng });
  }, [gps.fix]);

  useEffect(() => {
    if (gps.status === "denied" || gps.status === "unavailable" || gps.status === "insecure") toast.error(LOCATE_ERRORS[gps.status]);
  }, [gps.status]);

  const locating = gps.status === "locating";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <LocationSearch near={value} onSelect={pick} placeholder="Search the station's area or plus code" className="flex-1" />
        <Button type="button" variant="outline" onClick={locating ? gps.cancel : gps.locate} title={locating ? "Locating… click to cancel" : "Use my current location"}>
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
        </Button>
      </div>
      <div ref={containerRef} className="w-full h-60 rounded-lg overflow-hidden border border-border relative z-0" />
      <p className="text-xs text-muted-foreground">
        {value ? (
          <>
            Pin at <span className="font-medium text-foreground">{check?.place || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}</span>
            {gps.fix ? ` · device accuracy ${formatAccuracy(gps.fix.accuracy)}` : ""} — click the map or drag the pin to the exact charger spot.
            Tip: a plus code in the address (from Google Maps) places it exactly.
          </>
        ) : (
          "No pin yet — add the plus code to the address, search the area, use your location at the charger, or click the map."
        )}
      </p>
      {check?.mismatch && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-accent/10 px-3 py-2.5 text-xs text-accent sm:flex-row sm:items-center">
          <AlertTriangle className="hidden h-4 w-4 shrink-0 sm:block" />
          <span className="flex-1">{check.mismatch.message}</span>
          {check.mismatch.kind === "plusCode" && check.target && (
            <Button type="button" size="sm" variant="outline" onClick={() => pick(check.target!)} className="shrink-0">
              <MapPinned /> Move pin to {check.target.code}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
