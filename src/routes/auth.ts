import type { FastifyInstance } from 'fastify';
import { createAuthController } from '../controllers/authController.js';
import type { FirebaseAuthClient } from '../services/firebaseAuthService.js';

export async function registerAuthRoutes(
  app: FastifyInstance,
  firebaseAuth: FirebaseAuthClient,
): Promise<void> {
  const controller = createAuthController(firebaseAuth);

  app.post('/api/v1/auth/signup', controller.signUp);
  app.post('/api/v1/auth/login', controller.login);
}