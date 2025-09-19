const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const { ensureAuthenticated, ensureTwoFactor } = require('../middleware/auth');
const {
  storeFileRecord,
  getFileById,
  deleteFile,
  createShare,
  listSharesForFile,
  removeShare,
  logAudit
} = require('../services/database');
const { canAccessClassification, getAvailableClassificationsForRole } = require('../utils/access');
const { formatBytes, formatDate } = require('../utils/format');

const router = express.Router();

const uploadDirectory = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    cb(null, `${uuid()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла.'));
    }
  }
});

router.get('/files/upload', ensureAuthenticated, ensureTwoFactor, (req, res) => {
  const classifications = getAvailableClassificationsForRole(req.session.user.role);
  res.render('files/upload', {
    title: 'Загрузка документа',
    classifications
  });
});

router.post('/files/upload', ensureAuthenticated, ensureTwoFactor, upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      req.flash('error', 'Файл обязателен для загрузки.');
      return res.redirect('/files/upload');
    }

    const { classification, description } = req.body;
    const available = getAvailableClassificationsForRole(req.session.user.role).map((item) => item.value);
    if (!available.includes(classification)) {
      req.flash('error', 'Недоступный уровень классификации.');
      return res.redirect('/files/upload');
    }

    if ((classification === 'confidential' || classification === 'topsecret') && !req.session.user.twoFactorEnabled) {
      req.flash('error', 'Для работы с конфиденциальными файлами включите двухфакторную защиту.');
      return res.redirect('/profile/security');
    }

    const record = await storeFileRecord({
      ownerId: req.session.user.id,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      classification,
      description
    });

    await logAudit({ userId: req.session.user.id, action: 'files.upload', details: `${record.id}:${classification}` });

    req.flash('success', 'Документ успешно загружен.');
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('upload error', error);
    req.flash('error', error.message || 'Не удалось загрузить файл.');
    return res.redirect('/files/upload');
  }
});

router.get('/files/:id', ensureAuthenticated, ensureTwoFactor, async (req, res, next) => {
  const { id } = req.params;
  try {
    const file = await getFileById(id);
    if (!file) {
      req.flash('error', 'Файл не найден.');
      return res.redirect('/dashboard');
    }

    const user = req.session.user;
    const isOwner = file.owner_id === user.id;
    const classificationAllowed = canAccessClassification(user.role, file.classification);

    if (!isOwner && !classificationAllowed) {
      req.flash('error', 'Нет доступа к данному уровню файла.');
      return res.redirect('/dashboard');
    }

    if ((file.classification === 'confidential' || file.classification === 'topsecret') && !user.twoFactorEnabled) {
      req.flash('error', 'Для просмотра требуется включенная двухфакторная защита.');
      return res.redirect('/profile/security');
    }

    const shares = isOwner ? await listSharesForFile(file.id) : [];

    return res.render('files/detail', {
      title: 'Карточка документа',
      file: {
        ...file,
        formattedSize: formatBytes(file.size),
        formattedDate: formatDate(file.created_at)
      },
      isOwner,
      shares
    });
  } catch (error) {
    console.error('detail error', error);
    req.flash('error', 'Не удалось открыть карточку файла.');
    return res.redirect('/dashboard');
  }
});

router.post('/files/:id/share', ensureAuthenticated, ensureTwoFactor, async (req, res, next) => {
  const { id } = req.params;
  const { email, permission } = req.body;
  try {
    const file = await getFileById(id);
    if (!file || file.owner_id !== req.session.user.id) {
      req.flash('error', 'Возможность обмена доступна только владельцу.');
      return res.redirect('/dashboard');
    }

    await createShare({ fileId: id, targetEmail: email, permission: permission || 'viewer' });
    await logAudit({ userId: req.session.user.id, action: 'files.share', details: `${id}:${email}` });
    req.flash('success', 'Доступ предоставлен.');
    return res.redirect(`/files/${id}`);
  } catch (error) {
    console.error('share error', error);
    req.flash('error', error.message || 'Не удалось предоставить доступ.');
    return res.redirect(`/files/${id}`);
  }
});

router.post('/files/:id/delete', ensureAuthenticated, ensureTwoFactor, async (req, res, next) => {
  const { id } = req.params;
  try {
    const file = await getFileById(id);
    if (!file || file.owner_id !== req.session.user.id) {
      req.flash('error', 'Удалять файл может только владелец.');
      return res.redirect('/dashboard');
    }

    await deleteFile(id);
    const filepath = path.join(uploadDirectory, file.stored_name);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    await logAudit({ userId: req.session.user.id, action: 'files.delete', details: id });
    req.flash('info', 'Файл удалён.');
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('delete error', error);
    req.flash('error', 'Не удалось удалить файл.');
    return res.redirect('/dashboard');
  }
});

router.post('/shares/:shareId/delete', ensureAuthenticated, ensureTwoFactor, async (req, res, next) => {
  const { shareId } = req.params;
  const { fileId } = req.body;
  try {
    const file = await getFileById(fileId);
    if (!file || file.owner_id !== req.session.user.id) {
      req.flash('error', 'Только владелец может отзывать доступ.');
      return res.redirect('/dashboard');
    }

    await removeShare(shareId);
    await logAudit({ userId: req.session.user.id, action: 'files.share.revoke', details: `${shareId}:${fileId}` });
    req.flash('info', 'Доступ отозван.');
    return res.redirect(`/files/${fileId}`);
  } catch (error) {
    console.error('share revoke error', error);
    req.flash('error', 'Не удалось отозвать доступ.');
    return res.redirect(`/files/${fileId}`);
  }
});

module.exports = router;
