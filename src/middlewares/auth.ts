import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from 'jose';
import type { AppEnv } from '../config/env.js';

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export interface AuthUser {
  uid: string;
  email?: string;
  payload: JWTPayload;
}

export function createAuthPreHandler(appEnv: AppEnv) {
  const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  const audience = appEnv.FIREBASE_PROJECT_ID;
  const issuer = appEnv.AUTH_ISSUER_URL.replace(/\/$/, '');

  return async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (appEnv.AUTH_DISABLED) {
      request.user = { uid: 'dev-user', payload: { sub: 'dev-user' } };
      return;
    }

    const header = request.headers.authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      return reply.code(401).send({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        message: 'Authorization Bearer token is required',
      });
    }

    const token = header.slice(7).trim();
    if (!token) {
      return reply.code(401).send({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        message: 'Authorization Bearer token is required',
      });
    }

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience,
        algorithms: ['RS256'],
      });

      if (!payload.sub) {
        return reply.code(401).send({
          error: 'Unauthorized',
          code: 'INVALID_TOKEN',
          message: 'Token is missing subject',
        });
      }

      request.user = {
        uid: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        payload,
      };
    } catch (error) {
      request.log.warn({ err: error }, 'JWT verification failed');

      const expired = error instanceof joseErrors.JWTExpired;
      return reply.code(401).send({
        error: 'Unauthorized',
        code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: expired ? 'Token has expired' : 'Invalid or malformed token',
      });
    }
  };
}

export function registerAuth(app: FastifyInstance, appEnv: AppEnv): void {
  app.decorateRequest('user', undefined);
  app.addHook('onRequest', createAuthPreHandler(appEnv));
}
