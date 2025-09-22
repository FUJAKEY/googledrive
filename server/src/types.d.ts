import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      apiKey?: {
        id: string;
        label?: string;
      };
    }
  }
}

export {};
