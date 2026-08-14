import type { AppEnv } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

export interface FirebaseAuthResult {
  uid: string;
  token: string;
  refreshToken: string;
  expiresIn: string;
}

export interface FirebaseAuthClient {
  signUp(email: string, password: string): Promise<FirebaseAuthResult>;
  signIn(email: string, password: string): Promise<FirebaseAuthResult>;
}

interface FirebaseAuthResponse {
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  localId?: string;
  error?: { message?: string };
}

function mapFirebaseError(message: string): AppError {
  switch (message) {
    case 'EMAIL_EXISTS':
      return new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS');
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
      return new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    case 'INVALID_EMAIL':
      return new AppError(400, 'Email is invalid', 'INVALID_EMAIL');
    case 'WEAK_PASSWORD':
      return new AppError(400, 'Password must be at least 6 characters', 'WEAK_PASSWORD');
    case 'USER_DISABLED':
      return new AppError(403, 'User account is disabled', 'USER_DISABLED');
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return new AppError(429, 'Too many attempts. Try again later', 'TOO_MANY_ATTEMPTS');
    default:
      return new AppError(502, 'Firebase Auth is temporarily unavailable', 'FIREBASE_UNAVAILABLE', message);
  }
}

async function requestIdentityToolkit(
  action: 'signUp' | 'signInWithPassword',
  appEnv: AppEnv,
  payload: { email: string; password: string },
): Promise<FirebaseAuthResult> {
  let response: Response;

  try {
    response = await fetch(`${IDENTITY_TOOLKIT_URL}:${action}?key=${appEnv.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, returnSecureToken: true }),
      signal: AbortSignal.timeout(appEnv.OSRM_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AppError(
      502,
      'Firebase Auth is temporarily unavailable',
      'FIREBASE_UNAVAILABLE',
      error instanceof Error ? error.message : 'Failed to reach Firebase Auth',
    );
  }

  const body = (await response.json().catch(() => ({}))) as FirebaseAuthResponse;

  if (!response.ok) {
    const message = body.error?.message ?? `Firebase Auth HTTP ${response.status}`;
    throw mapFirebaseError(message);
  }

  if (!body.idToken || !body.localId) {
    throw new AppError(
      502,
      'Firebase Auth returned an invalid response',
      'FIREBASE_UNAVAILABLE',
      body,
    );
  }

  return {
    uid: body.localId,
    token: body.idToken,
    refreshToken: body.refreshToken ?? '',
    expiresIn: body.expiresIn ?? '3600',
  };
}

export function createFirebaseAuthService(appEnv: AppEnv): FirebaseAuthClient {
  return {
    signUp: (email, password) =>
      requestIdentityToolkit('signUp', appEnv, { email, password }),
    signIn: (email, password) =>
      requestIdentityToolkit('signInWithPassword', appEnv, { email, password }),
  };
}