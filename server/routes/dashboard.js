const express = require('express');
const { body, validationResult, query } = require('express-validator');

const storage = require('../services/storage');
const audit = require('../services/audit');
const logger = require('../utils/logger');

const { safeRedirectBack } = require('../utils/navigation');

const router = express.Router();

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function wantsJson(req) {
  const accept = req.get('Accept') || '';
  return req.xhr || accept.includes('application/json');
}

function formatBytes(bytes = 0) {
  if (!bytes) {
    return '0 Б';
  }
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${sizes[i]}`;
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function translateLevel(level) {
  switch (level) {
    case 'security':
      return 'Безопасность';
    case 'error':
      return 'Ошибка';
    case 'system':
      return 'Система';
    case 'action':
    default:
      return 'Действие';
  }
}

function assertValidPath(value) {
  try {
    storage.normalizePath(value);
  } catch {
    throw new Error('Некорректный путь.');
  }
  return true;
}

router.get(
  '/',
  [
    query('path').optional().custom(assertValidPath)
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Запрошен некорректный путь.');
      return res.redirect('/dashboard');
    }

    try {
      const userId = req.session.user.id;
      const currentPath = req.query.path ? storage.normalizePath(req.query.path) : '/';
      const { folders, files } = await storage.listItems(userId, currentPath);
      const breadcrumbs = await storage.getFolderBreadcrumbs(currentPath);
      const stats = await storage.getUserStorageStats(userId);
      const recentActivity = (await audit.getUserEvents(userId, 5)).map((event) => ({
        ...event,
        formattedTimestamp: formatTimestamp(event.timestamp || event.time),
        level: translateLevel(event.level || 'action')
      }));
      const uploadLimitMb = parsePositiveInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '20', 20);
      const uploadMaxFiles = parsePositiveInt(process.env.UPLOAD_MAX_FILES || '10', 10);

      folders.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      const preparedFiles = files
        .map((file) => ({
          ...file,
          readableSize: formatBytes(file.size || 0)
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

      res.render('dashboard/index', {
        title: 'Мой диск',
        folders,
        files: preparedFiles,
        breadcrumbs,
        currentPath,
        stats,
        recentActivity,
        uploadLimitMb,
        uploadMaxFiles
      });
    } catch (error) {
      logger.logError(error);
      req.flash('error', 'Не удалось загрузить содержимое диска.');
      res.redirect('/dashboard');
    }
  }
);

router.post(
  '/folders',
  [
    body('name').trim().notEmpty().withMessage('Введите название папки.'),
    body('parentPath').optional().custom(assertValidPath)
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array()[0].msg;
      if (wantsJson(req)) {
        return res.status(422).json({ success: false, message });
      }
      req.flash('error', message);
      return safeRedirectBack(req, res, '/dashboard', 303);
    }

    try {
      const parentPath = req.body.parentPath ? storage.normalizePath(req.body.parentPath) : '/';
      const folder = await storage.createFolder(req.session.user.id, req.body.name, parentPath);
      logger.logUserAction(req.session.user.id, 'create-folder', {
        folder: folder.fullPath
      });
      const successMessage = 'Папка успешно создана.';
      req.flash('success', successMessage);
      const redirectPath = parentPath === '/' ? '/dashboard' : `/dashboard?path=${encodeURIComponent(parentPath)}`;
      if (wantsJson(req)) {
        return res.json({ success: true, redirect: redirectPath, message: successMessage });
      }
      return res.redirect(redirectPath);
    } catch (error) {
      logger.logError(error);
      const message = error.message || 'Не удалось создать папку.';
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, message });
      }
      req.flash('error', message);
      return safeRedirectBack(req, res, '/dashboard', 303);
    }
  }
);

router.get(
  '/search',
  [
    query('q').trim().isLength({ min: 2 }).withMessage('Для поиска введите минимум 2 символа.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const queryValue = req.query.q || '';
    if (!errors.isEmpty()) {
      return res.status(422).render('dashboard/search', {
        title: 'Поиск',
        results: [],
        query: queryValue,
        errors: errors.array()
      });
    }

    try {
      const userId = req.session.user.id;
      const results = await storage.searchItems(userId, queryValue);
      res.render('dashboard/search', {
        title: 'Поиск',
        results,
        query: queryValue
      });
    } catch (error) {
      logger.logError(error);
      req.flash('error', 'Поиск временно недоступен.');
      res.redirect('/dashboard');
    }
  }
);

router.get('/activity', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const events = await audit.getUserEvents(userId, 20);
    res.render('dashboard/activity', {
      title: 'Журнал активности',
      events
    });
  } catch (error) {
    logger.logError(error);
    req.flash('error', 'Не удалось загрузить журнал активности.');
    res.redirect('/dashboard');
  }
});

module.exports = router;
