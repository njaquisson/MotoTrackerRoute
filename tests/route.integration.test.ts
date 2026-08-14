import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { RouteNotFoundError } from '../src/utils/errors.js';
import { sampleGeometry, stubOsrm, testEnv } from './helpers.js';

const ORIGIN = '-29.7608,-50.0200';
const DESTINATION = '-30.0346,-51.2177';

async function injectRoute(
  app: FastifyInstance,
  query: string,
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: 'GET',
    url: `/api/v1/route?${query}`,
    headers,
  });
}

describe('GET /health', () => {
  it('is public and reports the motorcycle profile', async () => {
    const app = await buildApp({ env: testEnv(), osrm: stubOsrm() });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', profile: 'motorcycle' });
    await app.close();
  });
});

describe('GET /api/v1/route', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('returns the standardized contract', async () => {
    app = await buildApp({ env: testEnv(), osrm: stubOsrm() });
    const res = await injectRoute(app, `origin=${ORIGIN}&destination=${DESTINATION}`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      distance: 125500,
      duration: 5400,
      geometry: sampleGeometry,
    });
  });

  it('rejects missing coordinates', async () => {
    app = await buildApp({ env: testEnv(), osrm: stubOsrm() });
    const res = await injectRoute(app, 'origin=-29.76,-50.02');
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_QUERY');
  });

  it('rejects malformed coordinates', async () => {
    app = await buildApp({ env: testEnv(), osrm: stubOsrm() });
    const res = await injectRoute(app, 'origin=abc&destination=-30.03,-51.23');
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_COORDINATES');
  });

  it('returns 404 when OSRM cannot find a route', async () => {
    app = await buildApp({
      env: testEnv(),
      osrm: {
        async getRoute() {
          throw new RouteNotFoundError();
        },
      },
    });

    const res = await injectRoute(app, `origin=${ORIGIN}&destination=${DESTINATION}`);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('ROUTE_NOT_FOUND');
  });

  it('rejects missing bearer token when auth is enabled', async () => {
    app = await buildApp({
      env: testEnv({ AUTH_DISABLED: 'false' }),
      osrm: stubOsrm(),
    });

    const res = await injectRoute(app, `origin=${ORIGIN}&destination=${DESTINATION}`);
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('MISSING_TOKEN');
  });

  it('rejects an invalid token when auth is enabled', async () => {
    app = await buildApp({
      env: testEnv({ AUTH_DISABLED: 'false' }),
      osrm: stubOsrm(),
    });

    const res = await injectRoute(app, `origin=${ORIGIN}&destination=${DESTINATION}`, {
      authorization: 'Bearer not-a-valid-jwt',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_TOKEN');
  });

  it('rate limits per IP when auth is disabled', async () => {
    app = await buildApp({
      env: testEnv({
        AUTH_DISABLED: 'true',
        RATE_LIMIT_MAX: '2',
        RATE_LIMIT_WINDOW: '1 minute',
      }),
      osrm: stubOsrm(),
    });

    const url = `/api/v1/route?origin=${ORIGIN}&destination=${DESTINATION}`;

    const a1 = await app.inject({ method: 'GET', url, remoteAddress: '10.0.0.1' });
    const a2 = await app.inject({ method: 'GET', url, remoteAddress: '10.0.0.1' });
    expect(a1.statusCode).toBe(200);
    expect(a2.statusCode).toBe(200);

    const b1 = await app.inject({ method: 'GET', url, remoteAddress: '10.0.0.2' });
    expect(b1.statusCode).toBe(200);

    const a3 = await app.inject({ method: 'GET', url, remoteAddress: '10.0.0.1' });
    expect(a3.statusCode).toBe(429);
    expect(a3.json().code).toBe('RATE_LIMITED');
  });
});
