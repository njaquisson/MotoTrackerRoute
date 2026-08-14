import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  OSRM_URL: z.string().url().default('http://localhost:5000'),
  OSRM_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  PARAM_OVERVIEW: z.enum(['full', 'simplified', 'false']).default('full'),
  PARAM_GEOMETRIES: z.enum(['geojson', 'polyline', 'polyline6']).default('geojson'),
  DEFAULT_PROFILE: z.string().min(1).default('motorcycle'),

  AUTH_ISSUER_URL: z.string().url(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_API_KEY: z.string().min(1),
  AUTH_DISABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
});

export type AppEnv = z.infer<typeof envSchema>;

function resolveFirebaseProjectId(raw: z.infer<typeof envSchema>): string {
  if (raw.FIREBASE_PROJECT_ID) {
    return raw.FIREBASE_PROJECT_ID;
  }

  const match = raw.AUTH_ISSUER_URL.match(
    /^https:\/\/securetoken\.google\.com\/([^/]+)\/?$/,
  );
  if (match?.[1]) {
    return match[1];
  }

  throw new Error(
    'FIREBASE_PROJECT_ID is required when AUTH_ISSUER_URL is not a Firebase issuer URL',
  );
}

export function loadEnv(overrides: Record<string, string | undefined> = {}): AppEnv {
  const parsed = envSchema.parse({ ...process.env, ...overrides });

  if (parsed.NODE_ENV === 'production' && parsed.AUTH_DISABLED) {
    throw new Error('AUTH_DISABLED cannot be enabled when NODE_ENV is production');
  }

  return {
    ...parsed,
    FIREBASE_PROJECT_ID: resolveFirebaseProjectId(parsed),
  };
}

export const env = loadEnv();
