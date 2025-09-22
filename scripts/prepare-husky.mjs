import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '..');
const gitDir = resolve(repoRoot, '.git');

if (!existsSync(gitDir)) {
  console.log('[husky] .git каталог не найден, установка хуков пропущена.');
  process.exit(0);
}

const huskyBinary = resolve(repoRoot, 'node_modules', 'husky', 'bin.js');
const result = spawnSync(process.execPath, [huskyBinary], {
  cwd: repoRoot,
  stdio: 'inherit'
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
