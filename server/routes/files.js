const fs = require('fs');
const express = require('express');
const multer = require('multer');
const path = require('path');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { body, param, validationResult } = require('express-validator');

const storage = require('../services/storage');
const logger = require('../utils/logger');

const { safeRedirectBack } = require('../utils/navigation');

const router = express.Router();

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

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const uploadLimitMb = parsePositiveInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '20', 20);
const uploadMaxFiles = parsePositiveInt(process.env.UPLOAD_MAX_FILES || '10', 10);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const userDir = path.join(__dirname, '..', '..', 'uploads', req.session.user.id);
      cb(null, userDir);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname);
      cb(null, `${uuidv4()}${extension}`);
    }
  }),
  limits: {
    fileSize: uploadLimitMb * 1024 * 1024,
    files: uploadMaxFiles
  },
  fileFilter: (_req, file, cb) => {
    const disallowedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.scr'];
    const extension = path.extname(file.originalname).toLowerCase();
    if (disallowedExtensions.includes(extension)) {
      return cb(new Error('Недопустимый тип файла.'));
    }
    cb(null, true);
  }
});

const ensureUserDirectory = async (req, _res, next) => {
  try {
    await storage.ensureUserRootDirectory(req.session.user.id);
    next();
  } catch (error) {
    next(error);
  }
};

const validateParentPath = [
  body('parentPath')
    .optional()
    .custom((value) => {
      try {
        storage.normalizePath(value);
      } catch {
        throw new Error('Некорректный путь.');
      }
      return true;
    })
  ];

router.get('/upload', async (req, res) => {
  const parentPath = req.query.path ? req.query.path : '/';
  res.render('files/upload', {
    title: 'Загрузка файлов',
    parentPath,
    uploadLimitMb,
    uploadMaxFiles
  });
});

router.post(
  '/upload',
  validateParentPath,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array()[0].msg;
      if (wantsJson(req)) {
        return res.status(422).json({ success: false, message });
      }
      req.flash('error', message);
      return safeRedirectBack(req, res, req.originalUrl || '/files/upload', 303);
    }
    return next();
  },
  ensureUserDirectory,
  (req, res, next) => {
    upload.array('files', uploadMaxFiles)(req, res, (error) => {
      if (error) {
        logger.logError(error);
        let message = error.message || 'Не удалось загрузить файлы.';
        if (error.code === 'LIMIT_FILE_SIZE') {
          message = `Файл превышает допустимый размер ${uploadLimitMb} МБ.`;
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          message = `За одну загрузку можно выбрать не более ${uploadMaxFiles} файлов.`;
        }
        if (wantsJson(req)) {
          return res.status(400).json({ success: false, message });
        }
        req.flash('error', message);
        return safeRedirectBack(req, res, req.originalUrl || '/files/upload', 303);
      }
      return next();
    });
  },
  async (req, res) => {
    if (!req.files || !req.files.length) {
      const message = 'Выберите файлы для загрузки.';
      if (wantsJson(req)) {
        return res.status(400).json({ success: false, message });
      }
      req.flash('error', message);
      return safeRedirectBack(req, res, req.originalUrl || '/files/upload', 303);
    }

    try {
      const parentPath = req.body.parentPath ? storage.normalizePath(req.body.parentPath) : '/';
      const uploadedMetadata = [];

      for (const file of req.files) {
        const meta = await storage.registerFile(req.session.user.id, {
          originalName: file.originalname,
          storedName: file.filename,
          size: file.size,
          mimeType: file.mimetype,
          parentPath
        });

        uploadedMetadata.push(meta);

        logger.logUserAction(req.session.user.id, 'upload-file', {
          file: meta.fullPath,
          size: file.size
        });
      }

      const successMessage =
        uploadedMetadata.length === 1 ? 'Файл успешно загружен.' : 'Файлы успешно загружены.';
      req.flash('success', successMessage);
      const redirectPath = parentPath === '/' ? '/dashboard' : `/dashboard?path=${encodeURIComponent(parentPath)}`;
      if (wantsJson(req)) {
        return res.json({
          success: true,
          redirect: redirectPath,
          message: successMessage,
          uploaded: uploadedMetadata.map((meta) => ({ id: meta.id, name: meta.name }))
        });
      }
      return res.redirect(redirectPath);
    } catch (error) {
      logger.logError(error);
      const message = error.message || 'Не удалось сохранить файлы.';
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, message });
      }
      req.flash('error', message);
      return safeRedirectBack(req, res, req.originalUrl || '/files/upload', 303);
    }
  }
);

router.get(
  '/:id',
  [param('id').isUUID().withMessage('Некорректный идентификатор файла.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Запрошен недопустимый файл.');
      return res.redirect('/dashboard');
    }

    try {
      const item = await storage.getItemById(req.params.id);
      if (!item || item.ownerId !== req.session.user.id) {
        req.flash('error', 'Файл не найден.');
        return res.redirect('/dashboard');
      }

      res.render('files/detail', {
        title: item.name,
        item: {
          ...item,
          readableSize: formatBytes(item.size || 0)
        }
      });
    } catch (error) {
      logger.logError(error);
      req.flash('error', 'Не удалось открыть файл.');
      res.redirect('/dashboard');
    }
  }
);

router.get(
  '/:id/download',
  [param('id').isUUID()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Запрошен недопустимый файл.');
      return res.redirect('/dashboard');
    }

    try {
      const item = await storage.getItemById(req.params.id);
      if (!item || item.ownerId !== req.session.user.id || item.type !== 'file') {
        req.flash('error', 'Файл не найден.');
        return res.redirect('/dashboard');
      }

      const filePath = path.join(__dirname, '..', '..', 'uploads', item.ownerId, item.storedName);
      logger.logUserAction(req.session.user.id, 'download-file', {
        file: item.fullPath
      });

      return res.download(filePath, item.name, (error) => {
        if (error) {
          logger.logError(error);
          return next(error);
        }
        return null;
      });
    } catch (error) {
      logger.logError(error);
      req.flash('error', 'Не удалось скачать файл.');
      return res.redirect('/dashboard');
    }
  }
);

router.get(
  '/:id/archive',
  [param('id').isUUID()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Запрошен недопустимый идентификатор.');
      return res.redirect('/dashboard');
    }

    try {
      const folder = await storage.getItemById(req.params.id);
      if (!folder || folder.ownerId !== req.session.user.id || folder.type !== 'folder') {
        req.flash('error', 'Папка не найдена.');
        return res.redirect('/dashboard');
      }

      const { folders, files } = await storage.getFolderDescendants(folder.ownerId, folder.fullPath);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (error) => {
        logger.logError(error);
        next(error);
      });

      archive.on('warning', (error) => {
        if (error.code === 'ENOENT') {
          logger.logError(error);
          return;
        }
        next(error);
      });

      res.setHeader('Content-Type', 'application/zip');
      res.attachment(`${folder.name}.zip`);
      archive.pipe(res);

      const safePrefix = folder.name;
      archive.append('', { name: `${safePrefix}/`, type: 'directory' });

      folders
        .filter((child) => child.fullPath !== folder.fullPath)
        .sort((a, b) => a.fullPath.localeCompare(b.fullPath, 'ru'))
        .forEach((child) => {
          const relative = child.fullPath.slice(folder.fullPath.length + 1);
          if (relative) {
            archive.append('', { name: `${safePrefix}/${relative}/`, type: 'directory' });
          }
        });

      files
        .sort((a, b) => a.fullPath.localeCompare(b.fullPath, 'ru'))
        .forEach((file) => {
          const relative = file.fullPath.slice(folder.fullPath.length + 1);
          if (!relative) {
            return;
          }
          const absolutePath = path.join(__dirname, '..', '..', 'uploads', file.ownerId, file.storedName);
          if (!fs.existsSync(absolutePath)) {
            logger.logError(new Error(`Файл ${absolutePath} отсутствует при архивировании.`));
            return;
          }
          archive.file(absolutePath, { name: `${safePrefix}/${relative}` });
        });

      logger.logUserAction(req.session.user.id, 'download-folder', {
        folder: folder.fullPath,
        files: files.length
      });

      await archive.finalize();
      return null;
    } catch (error) {
      logger.logError(error);
      if (!res.headersSent) {
        req.flash('error', 'Не удалось подготовить архив папки.');
        return res.redirect('/dashboard');
      }
      res.end();
    }
    return null;
  }
);

router.post(
  '/:id/delete',
  [
    param('id').isUUID(),
    body('parentPath')
      .optional()
      .custom((value) => {
        try {
          storage.normalizePath(value);
        } catch {
          throw new Error('Некорректный путь.');
        }
        return true;
      })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = 'Некорректный запрос на удаление.';
      if (wantsJson(req)) {
        return res.status(400).json({ success: false, message });
      }
      req.flash('error', message);
      return safeRedirectBack(req, res, '/dashboard', 303);
    }

    try {
      const item = await storage.getItemById(req.params.id);
      if (!item || item.ownerId !== req.session.user.id) {
        req.flash('error', 'Элемент не найден.');
        if (wantsJson(req)) {
          return res.status(404).json({ success: false, message: 'Элемент не найден.' });
        }
        return res.redirect('/dashboard');
      }

      if (item.type === 'folder') {
        await storage.deleteFolder(item);
        logger.logUserAction(req.session.user.id, 'delete-folder', {
          folder: item.fullPath
        });
      } else {
        await storage.deleteFile(item);
        logger.logUserAction(req.session.user.id, 'delete-file', {
          file: item.fullPath
        });
      }

      const successMessage = 'Элемент удалён.';
      req.flash('success', successMessage);
      const parentPath = req.body.parentPath ? storage.normalizePath(req.body.parentPath) : '/';
      const redirectPath = parentPath === '/' ? '/dashboard' : `/dashboard?path=${encodeURIComponent(parentPath)}`;
      if (wantsJson(req)) {
        return res.json({ success: true, redirect: redirectPath, message: successMessage });
      }
      return res.redirect(redirectPath);
    } catch (error) {
      logger.logError(error);
      const message = error.message || 'Не удалось удалить элемент.';
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, message });
      }
      req.flash('error', message);
      return safeRedirectBack(req, res, '/dashboard', 303);
    }
  }
);

module.exports = router;
