import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { config } from '../config.js';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export const tokenUtils = {
  createAccessToken(user: User) {
    const payload: AccessTokenPayload = { userId: user.id, email: user.email };
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: `${config.accessTokenTtlMinutes}m`,
      subject: user.id
    });
  },
  verifyAccessToken(token: string) {
    return jwt.verify(token, config.jwtSecret) as JwtPayload & AccessTokenPayload;
  },
  generateRefreshToken() {
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.refreshTokenTtlDays);
    return { token, expiresAt, tokenHash: hashToken(token) };
  }
};

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sanitizeUser(user: User) {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
}
