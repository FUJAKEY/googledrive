process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';

const workerId = process.env.VITEST_WORKER_ID ?? '0';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:./test-${workerId}.db`;
}

if (!process.env.STORAGE_ROOT) {
  process.env.STORAGE_ROOT = `./data-test-${workerId}`;
}

process.env.BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000';

import { beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { PrismaClient } from '@prisma/client';

execSync('npx prisma generate --schema prisma/schema.prisma', { stdio: 'inherit' });

let prisma: PrismaClient;
let storage: { init(): Promise<void> };
let config: typeof import('../src/config.js').config;

beforeAll(async () => {
  execSync('npx prisma db push --force-reset --schema prisma/schema.prisma', { stdio: 'inherit' });
  ({ config } = await import('../src/config.js'));
  ({ prisma } = await import('../src/lib/prisma.js'));
  ({ storage } = await import('../src/services/storage.js'));
  await storage.init();
});

beforeEach(async () => {
  await prisma.activity.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.driveItem.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  await fs.mkdir(config.storageRoot, { recursive: true });
  const entries = await fs.readdir(config.storageRoot);
  await Promise.all(
    entries.map((entry) => fs.rm(path.join(config.storageRoot, entry), { recursive: true, force: true }))
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  await fs.rm(config.storageRoot, { recursive: true, force: true }).catch(() => undefined);
  const dbUrl = process.env.DATABASE_URL ?? 'file:./test.db';
  if (dbUrl.startsWith('file:')) {
    const dbRelativePath = dbUrl.slice('file:'.length);
    const dbPath = path.resolve(dbRelativePath);
    await fs.rm(dbPath, { force: true }).catch(() => undefined);
    await fs.rm(`${dbPath}-journal`, { force: true }).catch(() => undefined);
  }
});
