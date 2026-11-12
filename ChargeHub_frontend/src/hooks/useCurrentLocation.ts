import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/services/api";

export type LocateStatus = "idle" | "locating" | "done" | "denied" | "unavailable" | "insecure";
export interface DeviceFix extends LatLng {
  accuracy: number; // metres
}

// A reading less precise than this is only a network guess (no Wi-Fi or GPS fix): shown as an area, with a warning
export const APPROXIMATE_M = 1000;
const PRECISE_M = 30;     // a reading this good is final
const REFINE_MS = 5000;   // after the first reading, keep improving it this long
const ROUGH_REFINE_MS = 12000; // …longer when it is rough: a Wi-Fi based reading often follows the first network guess
const GIVE_UP_MS = 20000; // no reading at all (includes time spent on the browser's permission prompt)

export const LOCATE_ERRORS: Record<"denied" | "unavailable" | "insecure", string> = {
  denied: "Location is blocked for this site. Click the icon left of the address bar → Location → Allow, then try again.",
  unavailable: "Your device could not find its location. Search your place or set it on the map.",
  insecure: "Browsers share your location only with secure (https) sites.",
};

/**
 * The device's location, like the "my location" button in map apps: the first reading is reported at once and then
 * refined for a few seconds. Phones use GPS (a few metres); laptops estimate from Wi-Fi or the internet connection,
 * so their accuracy can be anywhere from ~50 m to ~100 km.
 */
export const useCurrentLocation = () => {
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const [status, setStatus] = useState<LocateStatus>("idle");
  const watchId = useRef<number | null>(null);
  const timer = useRef<number>();
  const best = useRef<DeviceFix | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    window.clearTimeout(timer.current);
  }, []);

  const finish = useCallback((next: LocateStatus) => {
    stop();
    setStatus(next);
  }, [stop]);

  const cancel = useCallback(() => finish("idle"), [finish]);

  const locate = useCallback(() => {
    stop();
    best.current = null;
    setFix(null);
    if (!window.isSecureContext) return setStatus("insecure");
    if (!("geolocation" in navigator)) return setStatus("unavailable");
    setStatus("locating");

    timer.current = window.setTimeout(() => finish(best.current ? "done" : "unavailable"), GIVE_UP_MS);
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (best.current && coords.accuracy >= best.current.accuracy) return;
        const first = !best.current;
        best.current = { lat: coords.latitude, lng: coords.longitude, accuracy: Math.round(coords.accuracy) };
        setFix(best.current);
        if (coords.accuracy <= PRECISE_M) return finish("done");
        if (first) {
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => finish("done"), coords.accuracy > APPROXIMATE_M ? ROUGH_REFINE_MS : REFINE_MS);
        }
      },
      (error) => finish(best.current ? "done" : error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: GIVE_UP_MS }
    );
  }, [stop, finish]);

  useEffect(() => stop, [stop]);

  return { fix, status, locate, cancel };
};
