import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authAPI, geoAPI, type LatLng } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { APPROXIMATE_M, LOCATE_ERRORS, useCurrentLocation } from "@/hooks/useCurrentLocation";
import { errorMessage } from "@/lib/format";

export interface Origin extends LatLng {
  label?: string;
  accuracy?: number | null;
  source: "default" | "gps" | "search" | "map";
}

// ~100 m cell: refetch and rename only when the location really moves
export const cellOf = (p: LatLng) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
// A device location known only roughly: never replaces a saved location on its own, and is named by its area
const isRough = (o: Pick<Origin, "source" | "accuracy"> | null) => o?.source === "gps" && (o.accuracy ?? 0) > APPROXIMATE_M;

/**
 * Where distances are measured from: the saved default at first, then the device location (like map apps), or a
 * searched / pinned place chosen by the user.
 */
export const useOrigin = () => {
  const { user, updateUser } = useAuthStore();
  const gps = useCurrentLocation();
  const locateMode = useRef<"auto" | "manual" | null>(null); // why the device location was requested
  const [origin, setOrigin] = useState<Origin | null>(null);
  const originRef = useRef(origin);
  originRef.current = origin;
  const [picking, setPicking] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);

  // Keeps the place name while a location is only being refined within the same ~100 m cell
  const setLocation = (place: LatLng & { label?: string }, source: Origin["source"], accuracy?: number) => {
    setOrigin((current) => ({
      lat: place.lat,
      lng: place.lng,
      // keep the name while it still fits: same ~100 m cell and still as rough (or as precise) as before
      label: place.label ?? (current && cellOf(current) === cellOf(place) && isRough(current) === isRough({ source, accuracy }) ? current.label : undefined),
      source,
      accuracy,
    }));
    setPicking(false);
  };

  // A searched or pinned place wins over a device location that is still arriving
  const chooseOrigin = (place: LatLng & { label?: string }, source: "search" | "map") => {
    if (locateMode.current) {
      locateMode.current = null;
      gps.cancel();
    }
    setLocation(place, source);
  };

  // "My location": start, or cancel while it is running
  const locateMe = () => {
    if (gps.status === "locating" && locateMode.current === "manual") {
      locateMode.current = null;
      gps.cancel();
      return;
    }
    locateMode.current = "manual";
    gps.locate();
  };

  // On open: show the saved default location at once (if any), then look for the device's current location
  useEffect(() => {
    let active = true;
    const name = user?.defaultLocation?.trim();
    const saved = user?.defaultCoordinates;
    const findDefault: Promise<(LatLng & { label?: string }) | undefined> =
      saved?.lat != null
        ? Promise.resolve({ ...saved, label: name })
        : name
          ? geoAPI.search(name).then(({ data }) => data.data[0] && { ...data.data[0], label: name }).catch(() => undefined)
          : Promise.resolve(undefined);
    findDefault.then((place) => {
      if (!active || originRef.current || locateMode.current) return; // the user has already chosen
      if (place) setLocation(place, "default");
      locateMode.current = "auto";
      gps.locate();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each improving device reading moves the location. Opening the page uses only a precise one when a location is
  // already shown (so a laptop's rough guess never replaces your default); the button always uses it.
  useEffect(() => {
    const mode = locateMode.current;
    if (!mode || !gps.fix) return;
    const current = originRef.current;
    if (mode === "manual" || gps.fix.accuracy <= APPROXIMATE_M || !current || current.source === "gps") {
      setLocation(gps.fix, "gps", gps.fix.accuracy);
    }
  }, [gps.fix]);

  useEffect(() => {
    if (gps.status === "locating" || gps.status === "idle") return;
    const mode = locateMode.current;
    locateMode.current = null;
    if (mode === "manual" && gps.status !== "done") toast.error(LOCATE_ERRORS[gps.status]);
  }, [gps.status]);

  // Place name for device/map locations (ignored if the location moved meanwhile)
  const originKey = origin ? cellOf(origin) : "";
  const needsLabel = !!origin && !origin.label;
  useEffect(() => {
    if (!origin || origin.label) return;
    const requested = originKey;
    geoAPI
      .reverse(origin, isRough(origin))
      .then(({ data }) => setOrigin((current) => (current && !current.label && cellOf(current) === requested ? { ...current, label: data.data.label } : current)))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey, needsLabel]);

  const saveAsDefault = async () => {
    if (!origin) return;
    setSavingDefault(true);
    try {
      const defaultLocation = origin.label || `${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}`;
      const defaultCoordinates = { lat: origin.lat, lng: origin.lng };
      await authAPI.updateProfile({ defaultLocation, defaultCoordinates });
      updateUser({ defaultLocation, defaultCoordinates });
      setOrigin({ ...origin, source: "default" });
      toast.success("Saved as your default location");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the default location"));
    } finally {
      setSavingDefault(false);
    }
  };

  return {
    origin,
    originKey,
    picking,
    setPicking,
    chooseOrigin,
    locateMe,
    locating: gps.status === "locating",
    roughFix: isRough(origin),
    saveAsDefault,
    savingDefault,
  };
};
