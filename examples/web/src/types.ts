export interface RouteResponse {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresIn: string;
  uid: string;
}

export interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
}

export type LatLngTuple = [number, number];
