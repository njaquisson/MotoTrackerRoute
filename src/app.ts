import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppEnv } from './config/env.js';
import { createAuthPreHandler } from './middlewares/auth.js';
import { registerRouteRoutes } from './routes/route.js';
import { createOsrmService, type OsrmClient } from './services/osrmService.js';

export interface BuildAppOptions {
  env: AppEnv;
  osrm?: OsrmClient;
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
    keyGenerator: (request) => request.user?.uid ?? request.ip,
    allowList: (request) => request.url.startsWith('/health'),
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      code: 'RATE_LIMITED',
      message: `Rate limit exceeded. Retry in ${Math.ceil(context.ttl / 1000)}s`,
    }),
  });

  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    service: 'motor-route',
    profile: env.DEFAULT_PROFILE,
  }));

  await app.register(async (protectedApi) => {
    protectedApi.addHook('onRequest', createAuthPreHandler(env));
    const osrm = options.osrm ?? createOsrmService(env);
    await registerRouteRoutes(protectedApi, osrm);
  });

  return app;
}
