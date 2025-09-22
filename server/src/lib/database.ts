import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

let migratePromise: Promise<void> | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

const prismaBinaryName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';

function resolvePrismaBinary() {
  const localBinary = path.join(serverRoot, 'node_modules', '.bin', prismaBinaryName);
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }
  return null;
}

function runPrismaCommand(args: string[]) {
  const resolvedBinary = resolvePrismaBinary();
  const command = resolvedBinary ?? (process.platform === 'win32' ? 'npx.cmd' : 'npx');
  const finalArgs = resolvedBinary ? args : ['prisma', ...args];

  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, finalArgs, {
      cwd: serverRoot,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Prisma command failed with exit code ${code}`));
      }
    });
  });
}

export function ensureDatabaseSchema() {
  if (process.env.SKIP_MIGRATIONS === 'true') {
    return Promise.resolve();
  }

  if (!migratePromise) {
    migratePromise = runPrismaCommand(['migrate', 'deploy']).catch((error) => {
      migratePromise = null;
      throw error;
    });
  }

  return migratePromise;
}
