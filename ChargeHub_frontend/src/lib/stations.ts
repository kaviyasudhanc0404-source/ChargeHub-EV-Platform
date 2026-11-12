import type { LatLng } from "@/services/api";
import type { StationCardData } from "@/components/StationCard";
import { chargerLabel, formatDistance, formatDuration } from "@/lib/format";

// A public station as the API returns it (with `distance` when listed nearest-first)
export interface Station {
  _id: string;
  name: string;
  location: { address: string; city: string; coordinates: LatLng };
  chargerType: string;
  power: number;
  vehicleType: "car" | "bike" | "both";
  connectorTypes: string[];
  pricing: { ratePerHour: number };
  availability: { isAvailable: boolean };
  rating?: { average: number; count: number };
  distance?: { km: number; minutes: number | null; method: "road" | "estimate" | "straight" };
}

// "Near Prozone Mall, Bharathi Nagar, Coimbatore" → "near Prozone Mall": the start point stays one short phrase on cards
const shortPlace = (label?: string) => label?.split(",")[0].replace(/^(Near|Around) /, (word) => word.toLowerCase());

export const toCard = (s: Station, fromLabel?: string): StationCardData => ({
  id: s._id,
  name: s.name,
  location: [s.location.address, s.location.city].filter(Boolean).join(", "),
  type: chargerLabel(s.power),
  rate: s.pricing.ratePerHour,
  available: s.availability.isAvailable,
  lat: s.location.coordinates.lat,
  lng: s.location.coordinates.lng,
  distance: s.distance ? formatDistance(s.distance.km, s.distance.method) : undefined,
  duration: s.distance?.minutes != null ? formatDuration(s.distance.minutes) : undefined,
  distanceMethod: s.distance?.method,
  fromLabel: s.distance ? shortPlace(fromLabel) : undefined,
  vehicleType: s.vehicleType,
  connectorType: s.connectorTypes.join(", "),
  rating: s.rating,
});
