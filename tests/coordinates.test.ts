import { describe, expect, it } from 'vitest';
import {
  InvalidCoordinatesError,
  parseLatLng,
  toOsrmCoordinate,
} from '../src/utils/coordinates.js';

describe('parseLatLng', () => {
  it('parses a valid RS coordinate pair', () => {
    expect(parseLatLng('-29.7608,-50.0200', 'origin')).toEqual({
      lat: -29.7608,
      lng: -50.02,
    });
  });

  it('rejects missing comma pairs', () => {
    expect(() => parseLatLng('-29.76', 'origin')).toThrow(InvalidCoordinatesError);
  });

  it('rejects latitude out of range', () => {
    expect(() => parseLatLng('91,0', 'origin')).toThrow(/latitude/);
  });

  it('rejects longitude out of range', () => {
    expect(() => parseLatLng('0,181', 'destination')).toThrow(/longitude/);
  });
});

describe('toOsrmCoordinate', () => {
  it('swaps to lon,lat for OSRM', () => {
    expect(toOsrmCoordinate({ lat: -29.76, lng: -50.02 })).toBe('-50.02,-29.76');
  });
});
