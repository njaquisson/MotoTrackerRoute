import type { LatLngTuple, RouteResponse } from './types';

/** GeoJSON is [lng, lat]; Leaflet needs [lat, lng]. */
export function geoJsonToLeaflet(coordinates: [number, number][]): LatLngTuple[] {
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  }
  return `${Math.round(meters).toLocaleString('pt-BR')} m`;
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  return `${Math.max(minutes, 1)} min`;
}

export function parseCoordinatePair(value: string): LatLngTuple | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

export function routePoints(route: RouteResponse): LatLngTuple[] {
  return geoJsonToLeaflet(route.geometry.coordinates);
}
