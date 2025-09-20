import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const port = Number(process.env.PORT ?? 8000);

const appRoot = process.cwd();
const storageRoot = path.resolve(appRoot, process.env.STORAGE_ROOT ?? '../data');

const ensureDir = (dir: string) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
};

ensureDir(storageRoot);

const resolvedDatabaseUrl = (() => {
  const fallbackPath = path.resolve(
    storageRoot,
    process.env.DATABASE_FILE ?? 'clouddrive.db'
  );
  const provided = process.env.DATABASE_URL;
  return provided && provided.length > 0
    ? provided
    : `file:${fallbackPath}`;
})();

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.length === 0) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

if (resolvedDatabaseUrl.startsWith('file:')) {
  const dbAbsolutePath = path.resolve(resolvedDatabaseUrl.slice('file:'.length));
  ensureDir(path.dirname(dbAbsolutePath));
}

const trustProxyEnv = process.env.TRUST_PROXY;
let trustProxy: boolean | number | string =
  process.env.NODE_ENV === 'production' ? 1 : false;

if (trustProxyEnv !== undefined) {
  const normalized = trustProxyEnv.trim().toLowerCase();
  if (normalized === 'true') {
    trustProxy = true;
  } else if (normalized === 'false') {
    trustProxy = false;
  } else if (/^\d+$/.test(normalized)) {
    trustProxy = Number(normalized);
  } else {
    trustProxy = trustProxyEnv;
  }
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port,
  baseUrl: process.env.BASE_URL ?? `http://localhost:${port}`,
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-too',
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES ?? 15),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 25),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 200),
  storageRoot,
  databaseUrl: process.env.DATABASE_URL ?? resolvedDatabaseUrl,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  trustProxy
};

export const constants = {
  refreshCookieName: 'clouddrive.refresh',
  refreshCookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/api/auth'
  } as const
};
