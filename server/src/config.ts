import path from 'node:path';
import 'dotenv/config';

const port = Number(process.env.PORT ?? 8000);

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
  storageRoot: path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? '../data'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*'
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
