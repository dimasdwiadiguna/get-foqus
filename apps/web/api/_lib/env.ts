/**
 * Environment access.
 *
 * Every secret is read here and nowhere else, so it is provable by inspection that nothing
 * secret can reach the client (§15). `.env.example` lists all of these.
 */

export interface Env {
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SESSION_SECRET: string;
  TOKEN_ENC_KEY: string;
  CRON_SECRET: string;
  APP_URL: string;
}

const REQUIRED: (keyof Env)[] = [
  'DATABASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'SESSION_SECRET',
  'TOKEN_ENC_KEY',
  'APP_URL',
];

export function readEnv(): Env {
  const env = process.env as Record<string, string | undefined>;
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Environment variable belum diisi: ${missing.join(', ')}. Lihat .env.example.`);
  }
  return {
    DATABASE_URL: env.DATABASE_URL ?? '',
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? '',
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? '',
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI ?? '',
    SESSION_SECRET: env.SESSION_SECRET ?? '',
    TOKEN_ENC_KEY: env.TOKEN_ENC_KEY ?? '',
    CRON_SECRET: env.CRON_SECRET ?? '',
    APP_URL: env.APP_URL ?? '',
  };
}

export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}
