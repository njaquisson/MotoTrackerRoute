export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class RouteNotFoundError extends AppError {
  constructor(message = 'No route found between the given coordinates') {
    super(404, message, 'ROUTE_NOT_FOUND');
  }
}

export class OsrmUnavailableError extends AppError {
  constructor(message = 'Routing engine is temporarily unavailable') {
    super(502, message, 'OSRM_UNAVAILABLE');
  }
}
