import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const BASE = {
  AUTH_ISSUER_URL: 'https://securetoken.google.com/test-project',
};

describe('loadEnv', () => {
  it('rejects AUTH_DISABLED=true in production', () => {
    expect(() =>
      loadEnv({ ...BASE, NODE_ENV: 'production', AUTH_DISABLED: 'true' }),
    ).toThrow(/AUTH_DISABLED cannot be enabled/);
  });

  it('allows AUTH_DISABLED=true in development', () => {
    const env = loadEnv({ ...BASE, NODE_ENV: 'development', AUTH_DISABLED: 'true' });
    expect(env.AUTH_DISABLED).toBe(true);
  });

  it('allows auth enabled in production', () => {
    const env = loadEnv({ ...BASE, NODE_ENV: 'production', AUTH_DISABLED: 'false' });
    expect(env.AUTH_DISABLED).toBe(false);
  });
});