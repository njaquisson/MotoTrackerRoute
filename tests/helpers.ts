import { loadEnv, type AppEnv } from '../src/config/env.js';
import type { OsrmClient, RouteResult } from '../src/services/osrmService.js';

export function testEnv(overrides: Record<string, string> = {}): AppEnv {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    AUTH_ISSUER_URL: 'https://securetoken.google.com/test-project',
    FIREBASE_PROJECT_ID: 'test-project',
    AUTH_DISABLED: 'true',
    OSRM_URL: 'http://osrm.test:5000',
    DEFAULT_PROFILE: 'motorcycle',
    PARAM_OVERVIEW: 'full',
    PARAM_GEOMETRIES: 'geojson',
    RATE_LIMIT_MAX: '1000',
    RATE_LIMIT_WINDOW: '1 minute',
    ...overrides,
  });
}

export const sampleGeometry = {
  type: 'LineString' as const,
  coordinates: [
    [-50.02, -29.76],
    [-51.23, -30.03],
  ],
};

export function stubOsrm(result?: Partial<RouteResult>): OsrmClient {
  return {
    async getRoute() {
      return {
        distance: 125500,
        duration: 5400,
        geometry: sampleGeometry,
        ...result,
      };
    },
  };
}
