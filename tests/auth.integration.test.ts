import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/utils/errors.js';
import { stubFirebaseAuth, testEnv } from './helpers.js';

const VALID_BODY = { email: 'rider@example.com', password: 'secret123' };

describe('POST /api/v1/auth', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('signup returns the token contract (public route)', async () => {
    app = await buildApp({ env: testEnv(), firebaseAuth: stubFirebaseAuth() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: VALID_BODY,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      token: 'id-token',
      refreshToken: 'refresh-token',
      expiresIn: '3600',
      uid: 'user-123',
    });
  });

  it('login returns the token contract', async () => {
    app = await buildApp({ env: testEnv(), firebaseAuth: stubFirebaseAuth() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: VALID_BODY,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      token: 'id-token',
      refreshToken: 'refresh-token',
      expiresIn: '3600',
      uid: 'user-123',
    });
  });

  it('signup rejects an existing email', async () => {
    app = await buildApp({
      env: testEnv(),
      firebaseAuth: {
        async signUp() {
          throw new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS');
        },
        async signIn() {
          throw new Error('unused');
        },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: VALID_BODY,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('EMAIL_EXISTS');
  });

  it('login rejects invalid credentials', async () => {
    app = await buildApp({
      env: testEnv(),
      firebaseAuth: {
        async signUp() {
          throw new Error('unused');
        },
        async signIn() {
          throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
        },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: VALID_BODY,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an invalid body', async () => {
    app = await buildApp({ env: testEnv(), firebaseAuth: stubFirebaseAuth() });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'not-an-email', password: '123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_BODY');
  });
});