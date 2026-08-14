import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { OsrmClient } from '../services/osrmService.js';
import { InvalidCoordinatesError, parseLatLng } from '../utils/coordinates.js';
import { AppError } from '../utils/errors.js';

const querySchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
});

export function createRouteController(osrm: OsrmClient) {
  return async function getRoute(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Bad Request',
        code: 'INVALID_QUERY',
        message: 'Query params origin and destination are required as lat,lng',
      });
    }

    try {
      const origin = parseLatLng(parsed.data.origin, 'origin');
      const destination = parseLatLng(parsed.data.destination, 'destination');
      const route = await osrm.getRoute(origin, destination);
      return reply.code(200).send(route);
    } catch (error) {
      if (error instanceof InvalidCoordinatesError) {
        return reply.code(400).send({
          error: 'Bad Request',
          code: 'INVALID_COORDINATES',
          message: error.message,
        });
      }

      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          error: error.statusCode === 404 ? 'Not Found' : 'Bad Gateway',
          code: error.code,
          message: error.message,
        });
      }

      request.log.error({ err: error }, 'Unexpected routing failure');
      return reply.code(500).send({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error while calculating the route',
      });
    }
  };
}
