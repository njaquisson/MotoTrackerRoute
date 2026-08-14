import type { ApiErrorBody, AuthResponse, RouteResponse } from './types';

/**
 * Browser always calls a relative URL. Vite proxies `/api` → http://127.0.0.1:8888
 * (see vite.config.ts). Do not fetch localhost from the page — that breaks the preview.
 */
const ROUTE_PATH = '/api/v1/route';
const SIGNUP_PATH = '/api/v1/auth/signup';
const LOGIN_PATH = '/api/v1/auth/login';

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.message ?? body.code ?? fallback;
  } catch {
    return fallback;
  }
}

async function postAuth(path: string, email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `HTTP ${response.status}`));
  }

  return (await response.json()) as AuthResponse;
}

export function signup(email: string, password: string): Promise<AuthResponse> {
  return postAuth(SIGNUP_PATH, email, password);
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return postAuth(LOGIN_PATH, email, password);
}

export async function fetchRoute(origin: string, destination: string, token: string): Promise<RouteResponse> {
  const params = new URLSearchParams({ origin, destination });
  const response = await fetch(`${ROUTE_PATH}?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `HTTP ${response.status}`));
  }

  return (await response.json()) as RouteResponse;
}