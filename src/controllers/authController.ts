import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { FirebaseAuthClient } from '../services/firebaseAuthService.js';
import { AppError } from '../utils/errors.js';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const INVALID_BODY = {
  error: 'Bad Request',
  code: 'INVALID_BODY',
  message: 'email (valid) and password (min 6 chars) are required',
};

function toAuthResponse(
  result: Awaited<ReturnType<FirebaseAuthClient['signIn']>>,
) {
  return {
    token: result.token,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    uid: result.uid,
  };
}

function sendAppError(reply: FastifyReply, error: AppError) {
  return reply.code(error.statusCode).send({
    error: error.statusCode === 401 ? 'Unauthorized' : 'Bad Request',
    code: error.code,
    message: error.message,
  });
}

export function createAuthController(firebaseAuth: FirebaseAuthClient) {
  return {
    async signUp(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(INVALID_BODY);
      }

      try {
        const result = await firebaseAuth.signUp(parsed.data.email, parsed.data.password);
        return reply.code(201).send(toAuthResponse(result));
      } catch (error) {
        if (error instanceof AppError) {
          return sendAppError(reply, error);
        }
        request.log.error({ err: error }, 'Unexpected signup failure');
        return reply.code(500).send({
          error: 'Internal Server Error',
          code: 'INTERNAL_ERROR',
          message: 'Unexpected error while creating the account',
        });
      }
    },

    async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(INVALID_BODY);
      }

      try {
        const result = await firebaseAuth.signIn(parsed.data.email, parsed.data.password);
        return reply.code(200).send(toAuthResponse(result));
      } catch (error) {
        if (error instanceof AppError) {
          return sendAppError(reply, error);
        }
        request.log.error({ err: error }, 'Unexpected login failure');
        return reply.code(500).send({
          error: 'Internal Server Error',
          code: 'INTERNAL_ERROR',
          message: 'Unexpected error while signing in',
        });
      }
    },
  };
}