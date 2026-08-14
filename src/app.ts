import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppEnv } from './config/env.js';
import { createAuthPreHandler } from './middlewares/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerRouteRoutes } from './routes/route.js';
import { createFirebaseAuthService, type FirebaseAuthClient } from './services/firebaseAuthService.js';
import { createOsrmService, type OsrmClient } from './services/osrmService.js';

export interface BuildAppOptions {
  env: AppEnv;
  osrm?: OsrmClient;
  firebaseAuth?: FirebaseAuthClient;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = options;
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    trustProxy: true,
  });

  await app.register(sensible);
  await app.register(helmet);
  await app.register(cors, { origin: false });

  app.decorateRequest('user', undefined);

  app.setErrorHandler((error: unknown, request, reply) => {
    const validation =
      typeof error === 'object' && error !== null && 'validation' in error
        ? (error as { validation?: unknown }).validation
        : undefined;

    if (validation) {
      return reply.code(400).send({
        error: 'Bad Request',
        code: 'INVALID_QUERY',
        message: 'Query params origin and destination are required as lat,lng',
      });
    }

    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;

    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      const e = error as { code?: string; error?: string; message?: string };
      return reply.code(statusCode).send({
        error: e.error ?? 'Error',
        code: e.code ?? 'ERROR',
        message: e.message ?? 'Request failed',
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
    });
  });

  await app.register(rateLimit, {
    global: true,
    hook: 'preHandler',
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    keyGenerator: (request) =>
      env.AUTH_DISABLED ? request.ip : (request.user?.uid ?? request.ip),
    allowList: (request) => request.url.startsWith('/health'),
    errorResponseBuilder: (_request, context) => {
      const err = new Error(
        `Rate limit exceeded. Retry in ${Math.ceil(context.ttl / 1000)}s`,
      ) as Error & { statusCode: number; code: string; error: string };
      err.statusCode = 429;
      err.code = 'RATE_LIMITED';
      err.error = 'Too Many Requests';
      return err;
    },
  });

  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    service: 'motor-route',
    profile: env.DEFAULT_PROFILE,
  }));

  const firebaseAuth = options.firebaseAuth ?? createFirebaseAuthService(env);
  await registerAuthRoutes(app, firebaseAuth);

  await app.register(async (protectedApi) => {
    protectedApi.addHook('onRequest', createAuthPreHandler(env));
    const osrm = options.osrm ?? createOsrmService(env);
    await registerRouteRoutes(protectedApi, osrm);
  });

  return app;
}
