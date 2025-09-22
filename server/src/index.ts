import { createApp } from './app.js';
import { config } from './config.js';
import { storage } from './services/storage.js';
import { ensureDatabaseSchema } from './lib/database.js';

async function start() {
  await ensureDatabaseSchema();
  await storage.init();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`CloudDrive API запущена на порту ${config.port}`);
  });
}

start().catch((error) => {
  console.error('Ошибка запуска сервера', error);
  process.exit(1);
});
