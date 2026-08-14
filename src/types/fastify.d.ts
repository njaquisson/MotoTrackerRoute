import type { AuthUser } from '../middlewares/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export {};
