const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { body, param, validationResult } = require('express-validator');

const storage = require('../services/storage');
const logger = require('../utils/logger');

const router = express.Router();

function formatBytes(bytes = 0) {
  if (!bytes) {
    return '0 Б';
  }
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${sizes[i]}`;
}

const uploadLimitMb = parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '20', 10);
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
    fileSize: uploadLimitMb * 1024 * 1024
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
      } catch (error) {
        throw new Error('Некорректный путь.');
      }
      return true;
    })
];

router.get('/upload', async (req, res) => {
  const parentPath = req.query.path ? req.query.path : '/';
  res.render('files/upload', {
    title: 'Загрузка файла',
    parentPath,
    uploadLimitMb
  });
});

router.post(
  '/upload',
  validateParentPath,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.status(422).redirect('back');
    }
    return next();
  },
  ensureUserDirectory,
  (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (error) {
        logger.logError(error);
        req.flash('error', error.message || 'Не удалось загрузить файл.');
        return res.redirect('back');
      }
      return next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      req.flash('error', 'Выберите файл для загрузки.');
      return res.redirect('back');
    }

    try {
      const parentPath = req.body.parentPath ? storage.normalizePath(req.body.parentPath) : '/';
      const meta = await storage.registerFile(req.session.user.id, {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
        parentPath
      });

      logger.logUserAction(req.session.user.id, 'upload-file', {
        file: meta.fullPath,
        size: req.file.size
      });

      req.flash('success', 'Файл успешно загружен.');
      const redirectPath = parentPath === '/' ? '/dashboard' : `/dashboard?path=${encodeURIComponent(parentPath)}`;
      return res.redirect(redirectPath);
    } catch (error) {
      logger.logError(error);
      req.flash('error', error.message || 'Не удалось сохранить файл.');
      return res.redirect('back');
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

router.post(
  '/:id/delete',
  [
    param('id').isUUID(),
    body('parentPath')
      .optional()
      .custom((value) => {
        try {
          storage.normalizePath(value);
        } catch (error) {
          throw new Error('Некорректный путь.');
        }
        return true;
      })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Некорректный запрос на удаление.');
      return res.redirect('back');
    }

    try {
      const item = await storage.getItemById(req.params.id);
      if (!item || item.ownerId !== req.session.user.id) {
        req.flash('error', 'Элемент не найден.');
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

      req.flash('success', 'Элемент удалён.');
      const parentPath = req.body.parentPath ? storage.normalizePath(req.body.parentPath) : '/';
      const redirectPath = parentPath === '/' ? '/dashboard' : `/dashboard?path=${encodeURIComponent(parentPath)}`;
      return res.redirect(redirectPath);
    } catch (error) {
      logger.logError(error);
      req.flash('error', error.message || 'Не удалось удалить элемент.');
      return res.redirect('back');
    }
  }
);

module.exports = router;
