import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';
import { shareRouter } from './routes/share.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);

  const origins = config.corsOrigin.split(',').map((origin) => origin.trim());

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : origins,
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  const publicDirCandidates = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'server', 'public'),
    path.resolve(currentDir, '../public')
  ];

  const publicDir = publicDirCandidates.find((dir) => fs.existsSync(dir));
  const builtIndexPath = publicDir ? path.join(publicDir, 'index.html') : undefined;

  app.use('/api', apiRouter);
  app.use('/s', (req, res, next) => {
    const acceptHeader = req.get('accept') ?? '';
    const segments = req.path.split('/').filter(Boolean);
    const isPublicView = segments.length === 1;
    const targetsArchiveOrDownload = segments[1] === 'download' || segments[1] === 'archive';
    const hasIndex = builtIndexPath && fs.existsSync(builtIndexPath);

    if (
      req.method === 'GET' &&
      isPublicView &&
      !targetsArchiveOrDownload &&
      hasIndex &&
      acceptHeader.includes('text/html')
    ) {
      return res.sendFile(builtIndexPath);
    }

    return shareRouter(req, res, next);
  });

  if (publicDir) {
    app.use(express.static(publicDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/s')) {
        return next();
      }
      if (builtIndexPath && fs.existsSync(builtIndexPath)) {
        return res.sendFile(builtIndexPath);
      }
      return next();
    });
  }

  const sendLandingPage = (res: express.Response) => {
    res
      .type('html')
      .send(`<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CloudDrive API</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
        background: linear-gradient(145deg, #f8fafc, #e2e8f0);
        color: #0f172a;
      }
      .card {
        background: rgba(255, 255, 255, 0.85);
        border-radius: 24px;
        padding: 2.5rem;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.1);
        max-width: 520px;
        width: min(100%, 520px);
        text-align: center;
        backdrop-filter: blur(16px);
      }
      h1 {
        font-size: clamp(1.75rem, 2vw + 1rem, 2.75rem);
        margin-bottom: 1rem;
      }
      p {
        margin: 0 0 1.5rem;
        line-height: 1.6;
        color: rgba(15, 23, 42, 0.75);
      }
      code {
        background: rgba(148, 163, 184, 0.15);
        padding: 0.25rem 0.5rem;
        border-radius: 0.5rem;
      }
      a {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
        color: #2563eb;
        font-weight: 600;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <section class="card">
      <h1>CloudDrive API готова к работе</h1>
      <p>
        Production-сборка фронтенда пока не найдена. Запустите <code>npm run build</code> в корне
        проекта или развёртывайте клиент отдельно на Vite Dev Server.
      </p>
      <p>
        Основное API расположено по адресу <code>/api</code>, проверка состояния сервиса — по
        маршруту <code>/health</code>.
      </p>
      <a href="https://github.com/FUJAKEY/googledrive" target="_blank" rel="noreferrer">
        Перейти в документацию
      </a>
    </section>
  </body>
</html>`);
  };

  if (!builtIndexPath || !fs.existsSync(builtIndexPath)) {
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }

      if (req.path.startsWith('/api') || req.path.startsWith('/s')) {
        return next();
      }

      return sendLandingPage(res);
    });
  }

  app.use(errorHandler);

  return app;
}
