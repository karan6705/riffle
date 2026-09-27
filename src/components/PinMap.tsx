import L from 'leaflet';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { GeoPoint, Site } from '../core/types';

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function ClickToPin({ onPick }: { onPick: (p: GeoPoint) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng, accuracy: 10 }) });
  return null;
}

function Recenter({ at }: { at: GeoPoint }) {
  const map = useMap();
  useEffect(() => {
    map.setView([at.lat, at.lng], Math.max(map.getZoom(), 14));
  }, [at.lat, at.lng, map]);
  return null;
}

/** Small map for choosing where a sample was taken. */
export function PinMap({ value, sites, onPick, onSite }: { value: GeoPoint; sites: Site[]; onPick: (p: GeoPoint) => void; onSite: (s: Site) => void }) {
  return (
    <MapContainer center={[value.lat, value.lng]} zoom={13} className="h-64 w-full" scrollWheelZoom={false} attributionControl>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <ClickToPin onPick={onPick} />
      <Recenter at={value} />
      {sites.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.location.lat, s.location.lng]}
          radius={7}
          pathOptions={{ color: '#0f3b3a', fillColor: '#a9d3c9', fillOpacity: 0.9, weight: 2 }}
          eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); onSite(s); } }}
        />
      ))}
      <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: '#d9622b', fillColor: '#d9622b', fillOpacity: 0.35, weight: 3 }} />
    </MapContainer>
  );
}
