export interface LatLng {
  lat: number;
  lng: number;
}

const COORD_PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export class InvalidCoordinatesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCoordinatesError';
  }
}

export function parseLatLng(value: string, field: string): LatLng {
  const match = COORD_PAIR.exec(value);
  if (!match) {
    throw new InvalidCoordinatesError(
      `${field} must be in "lat,lng" format (example: -29.7600,-50.0200)`,
    );
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new InvalidCoordinatesError(`${field} latitude must be between -90 and 90`);
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new InvalidCoordinatesError(`${field} longitude must be between -180 and 180`);
  }

  return { lat, lng };
}

/** OSRM expects lon,lat — the public API receives lat,lng. */
export function toOsrmCoordinate(point: LatLng): string {
  return `${point.lng},${point.lat}`;
}
