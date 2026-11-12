import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leaflet.css";
import type { LatLng } from "@/services/api";

export const INDIA_BOUNDS = L.latLngBounds([6.5, 68.1], [35.7, 97.5]);

// Standard OpenStreetMap street map
export const createMap = (container: HTMLElement, options: L.MapOptions = {}) => {
  const map = L.map(container, { scrollWheelZoom: true, ...options });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
  if (!options.center) map.fitBounds(INDIA_BOUNDS);
  setTimeout(() => map.invalidateSize(), 150);
  return map;
};

// Draggable pin drawn with CSS (avoids Leaflet's default marker images, which bundlers break)
export const pinIcon = (variant: "user" | "station") =>
  L.divIcon({ className: "", html: `<div class="map-pin map-pin--${variant}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

export const toLatLng = (point: L.LatLng): LatLng => ({ lat: point.lat, lng: point.lng });
