import { useEffect, useRef } from "react";
import L from "leaflet";
import { createMap, pinIcon, toLatLng } from "@/lib/leaflet";
import { escapeHtml } from "@/lib/utils";
import type { LatLng } from "@/services/api";

export interface MapStation extends LatLng {
  id: string;
  name: string;
  location: string;
  type: string;
  rate: number;
  available: boolean;
  distance?: string;
}

export interface MapOrigin extends LatLng {
  accuracy?: number | null;
}

interface StationMapProps {
  stations: MapStation[];
  origin?: MapOrigin | null;
  picking?: boolean;                     // next click on the map sets the location
  onPick?: (point: LatLng) => void;      // map click while picking, or the blue pin dragged
  focusId?: string | null;               // station to highlight (opens its popup)
  onSelect?: (id: string) => void;       // a station marker was clicked
}

const popupHtml = (s: MapStation) => `
  <div style="min-width: 180px; font-size: 12px; line-height: 1.5;">
    <strong style="font-size: 14px;">${escapeHtml(s.name)}</strong><br/>
    <span style="color: #4b5563;">${escapeHtml(s.location)}</span><br/>
    ${escapeHtml(s.type)} · ₹${Math.round(s.rate)}/hour<br/>
    ${s.distance ? `📍 ${escapeHtml(s.distance)}<br/>` : ""}
    <span style="font-weight: 600; color: ${s.available ? "#059669" : "#dc2626"};">${s.available ? "Online" : "Offline"}</span>
  </div>`;

// OpenStreetMap street map with station markers and the user's location (blue pin + accuracy circle)
const StationMap = ({ stations, origin, picking = false, onPick, focusId, onSelect }: StationMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const stationLayer = useRef<L.LayerGroup | null>(null);
  const originLayer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const latest = useRef({ picking, onPick, onSelect });
  latest.current = { picking, onPick, onSelect };

  // Create the map once
  useEffect(() => {
    if (!containerRef.current) return;
    const map = createMap(containerRef.current);
    stationLayer.current = L.layerGroup().addTo(map);
    originLayer.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (latest.current.picking) latest.current.onPick?.(toLatLng(e.latlng));
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.getContainer().classList.toggle("picking", picking);
  }, [picking]);

  // Station markers
  useEffect(() => {
    const layer = stationLayer.current;
    if (!layer) return;
    layer.clearLayers();
    markers.current.clear();
    stations.forEach((s) => {
      const marker = L.circleMarker([s.lat, s.lng], { radius: 9, fillColor: s.available ? "#10b981" : "#ef4444", color: "#ffffff", weight: 2, fillOpacity: 1 })
        .bindPopup(popupHtml(s))
        .on("click", () => latest.current.onSelect?.(s.id))
        .addTo(layer);
      markers.current.set(s.id, marker);
    });
  }, [stations]);

  // Highlighted station: open its popup and bring it into view
  useEffect(() => {
    const marker = focusId ? markers.current.get(focusId) : undefined;
    const map = mapRef.current;
    if (!marker || !map) return;
    marker.openPopup();
    if (!map.getBounds().pad(-0.1).contains(marker.getLatLng())) map.panTo(marker.getLatLng());
  }, [focusId, stations]);

  // User location: draggable blue pin + accuracy circle
  useEffect(() => {
    const layer = originLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (!origin) return;
    if (origin.accuracy && origin.accuracy > 30) {
      L.circle([origin.lat, origin.lng], { radius: origin.accuracy, color: "#2563eb", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(layer);
    }
    L.marker([origin.lat, origin.lng], { icon: pinIcon("user"), draggable: true, zIndexOffset: 1000, title: "Your location — drag to adjust" })
      .on("dragend", (e) => latest.current.onPick?.(toLatLng((e.target as L.Marker).getLatLng())))
      .addTo(layer);
  }, [origin?.lat, origin?.lng, origin?.accuracy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frame the user and their nearest stations (or all stations when no location is set)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngExpression[] = [...(origin ? [[origin.lat, origin.lng] as [number, number]] : []), ...(origin ? stations.slice(0, 3) : stations).map((s) => [s.lat, s.lng] as [number, number])];
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    // Re-frame only when the location or the set of stations changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat.toFixed(3), origin?.lng.toFixed(3), stations.map((s) => s.id).join()]);

  return <div ref={containerRef} className="relative z-0 h-full min-h-[300px] w-full overflow-hidden rounded-2xl border border-border/70" />;
};

export default StationMap;
