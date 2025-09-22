import type { Request } from 'express';
import { config } from '../config.js';

function pickFirstHeader(value?: string | string[]) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value.split(',')[0];
}

export function getRequestOrigin(req: Request): string {
  const forwardedProto = pickFirstHeader(req.headers['x-forwarded-proto']);
  const forwardedHost = pickFirstHeader(req.headers['x-forwarded-host']);
  const host = forwardedHost ?? req.headers.host;
  if (host) {
    const protocol = forwardedProto?.trim() || req.protocol || 'http';
    return `${protocol}://${host}`;
  }
  return config.baseUrl;
}
