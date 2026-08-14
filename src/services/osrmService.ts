import type { AppEnv } from '../config/env.js';
import { OsrmUnavailableError, RouteNotFoundError } from '../utils/errors.js';
import { toOsrmCoordinate, type LatLng } from '../utils/coordinates.js';

export interface RouteResult {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
}

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      type: string;
      coordinates: number[][];
    };
  }>;
}

export interface OsrmClient {
  getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult>;
}

export function buildOsrmRouteUrl(
  appEnv: Pick<AppEnv, 'OSRM_URL' | 'DEFAULT_PROFILE' | 'PARAM_OVERVIEW' | 'PARAM_GEOMETRIES'>,
  origin: LatLng,
  destination: LatLng,
): string {
  const base = appEnv.OSRM_URL.replace(/\/$/, '');
  const coordinates = `${toOsrmCoordinate(origin)};${toOsrmCoordinate(destination)}`;
  const path = `/route/v1/${appEnv.DEFAULT_PROFILE}/${coordinates}`;
  const query = new URLSearchParams({
    overview: appEnv.PARAM_OVERVIEW,
    geometries: appEnv.PARAM_GEOMETRIES,
    steps: 'false',
    alternatives: 'false',
  });

  return `${base}${path}?${query.toString()}`;
}

export function mapOsrmResponse(payload: OsrmRouteResponse): RouteResult {
  if (payload.code === 'NoRoute' || !payload.routes?.length) {
    throw new RouteNotFoundError();
  }

  if (payload.code !== 'Ok') {
    throw new OsrmUnavailableError(payload.message ?? `OSRM returned ${payload.code}`);
  }

  const route = payload.routes[0];
  if (!route) {
    throw new RouteNotFoundError();
  }

  const geometry = route.geometry;
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    throw new OsrmUnavailableError('OSRM response is missing GeoJSON geometry');
  }

  return {
    distance: Math.round(route.distance),
    duration: Math.round(route.duration),
    geometry: {
      type: 'LineString',
      coordinates: geometry.coordinates,
    },
  };
}

export function createOsrmService(appEnv: AppEnv): OsrmClient {
  return {
    async getRoute(origin, destination) {
      const url = buildOsrmRouteUrl(appEnv, origin, destination);
      let response: Response;

      try {
        response = await fetch(url, {
          signal: AbortSignal.timeout(appEnv.OSRM_TIMEOUT_MS),
          headers: { Accept: 'application/json' },
        });
      } catch (error) {
        throw new OsrmUnavailableError(
          error instanceof Error ? error.message : 'Failed to reach OSRM',
        );
      }

      let payload: OsrmRouteResponse;
      try {
        payload = (await response.json()) as OsrmRouteResponse;
      } catch {
        throw new OsrmUnavailableError(`OSRM returned a non-JSON body (${response.status})`);
      }

      if (response.status === 400 || payload.code === 'InvalidQuery') {
        throw new RouteNotFoundError(payload.message ?? 'Invalid coordinates for routing');
      }

      if (!response.ok && payload.code !== 'NoRoute' && payload.code !== 'Ok') {
        throw new OsrmUnavailableError(`OSRM HTTP ${response.status}`);
      }

      return mapOsrmResponse(payload);
    },
  };
}
