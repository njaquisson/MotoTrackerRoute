import type { FastifyInstance } from 'fastify';
import { createRouteController } from '../controllers/routeController.js';
import type { OsrmClient } from '../services/osrmService.js';

export async function registerRouteRoutes(
  app: FastifyInstance,
  osrm: OsrmClient,
): Promise<void> {
  const handler = createRouteController(osrm);

  app.get(
    '/api/v1/route',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['origin', 'destination'],
          properties: {
            origin: {
              type: 'string',
              description: 'Origin as lat,lng',
              examples: ['-29.7608,-50.0200'],
            },
            destination: {
              type: 'string',
              description: 'Destination as lat,lng',
              examples: ['-30.0346,-51.2177'],
            },
          },
        },
      },
    },
    handler,
  );
}
