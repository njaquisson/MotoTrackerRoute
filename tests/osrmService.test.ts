import { describe, expect, it } from 'vitest';
import { buildOsrmRouteUrl, mapOsrmResponse } from '../src/services/osrmService.js';
import { RouteNotFoundError } from '../src/utils/errors.js';
import { testEnv } from './helpers.js';

describe('buildOsrmRouteUrl', () => {
  it('injects profile, overview and geometries from env', () => {
    const url = buildOsrmRouteUrl(testEnv(), { lat: -29.76, lng: -50.02 }, { lat: -30.03, lng: -51.23 });

    expect(url).toContain('http://osrm.test:5000/route/v1/motorcycle/');
    expect(url).toContain('-50.02,-29.76;-51.23,-30.03');
    expect(url).toContain('overview=full');
    expect(url).toContain('geometries=geojson');
  });
});

describe('mapOsrmResponse', () => {
  it('maps a successful OSRM payload to the public contract', () => {
    const mapped = mapOsrmResponse({
      code: 'Ok',
      routes: [
        {
          distance: 125500.4,
          duration: 5400.2,
          geometry: {
            type: 'LineString',
            coordinates: [
              [-50.02, -29.76],
              [-51.23, -30.03],
            ],
          },
        },
      ],
    });

    expect(mapped).toEqual({
      distance: 125500,
      duration: 5400,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-50.02, -29.76],
          [-51.23, -30.03],
        ],
      },
    });
  });

  it('throws RouteNotFoundError when OSRM has no route', () => {
    expect(() => mapOsrmResponse({ code: 'NoRoute', routes: [] })).toThrow(RouteNotFoundError);
  });
});
