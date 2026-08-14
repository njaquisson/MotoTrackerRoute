import type { ApiErrorBody, RouteResponse } from './types';

/**
 * Browser always calls a relative URL. Vite proxies `/api` → http://127.0.0.1:8888
 * (see vite.config.ts). Do not fetch localhost from the page — that breaks the preview.
 */
const ROUTE_PATH = '/api/v1/route';

export async function fetchRoute(origin: string, destination: string): Promise<RouteResponse> {
  const params = new URLSearchParams({ origin, destination });
  const response = await fetch(`${ROUTE_PATH}?${params.toString()}`);

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      detail = body.message ?? body.code ?? detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }

  return (await response.json()) as RouteResponse;
}
