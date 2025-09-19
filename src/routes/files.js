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
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла.'));
    }
  }
});

router.get('/api/files/classifications', ensureAuthenticated, (req, res) => {
  const classifications = getAvailableClassificationsForRole(req.session.user.role);
  res.json({ success: true, classifications });
});

router.post('/api/files', ensureAuthenticated, ensureTwoFactor, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Файл обязателен для загрузки.' });
    }

    const { classification, description } = req.body;
    const available = getAvailableClassificationsForRole(req.session.user.role).map((item) => item.value);
    if (!available.includes(classification)) {
      return res.status(403).json({ success: false, message: 'Недоступный уровень классификации.' });
    }

    if ((classification === 'confidential' || classification === 'topsecret') && !req.session.user.twoFactorEnabled) {
      return res.status(403).json({ success: false, message: 'Для работы с конфиденциальными файлами включите двухфакторную защиту.' });
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

    return res.json({
      success: true,
      message: 'Документ успешно загружен.',
      file: {
        ...record,
        formattedSize: formatBytes(record.size),
        formattedDate: formatDate(record.created_at)
      }
    });
  } catch (error) {
    console.error('upload error', error);
    return res.status(400).json({ success: false, message: error.message || 'Не удалось загрузить файл.' });
  }
});

router.get('/api/files/:id', ensureAuthenticated, ensureTwoFactor, async (req, res) => {
  const { id } = req.params;
  try {
    const file = await getFileById(id);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Файл не найден.' });
    }

    const user = req.session.user;
    const isOwner = file.owner_id === user.id;
    const classificationAllowed = canAccessClassification(user.role, file.classification);

    if (!isOwner && !classificationAllowed) {
      return res.status(403).json({ success: false, message: 'Нет доступа к данному уровню файла.' });
    }

    if ((file.classification === 'confidential' || file.classification === 'topsecret') && !user.twoFactorEnabled) {
      return res.status(403).json({ success: false, message: 'Для просмотра требуется включенная двухфакторная защита.' });
    }

    const shares = isOwner
      ? (await listSharesForFile(file.id)).map((share) => ({
          ...share,
          formattedDate: formatDate(share.created_at)
        }))
      : [];

    return res.json({
      success: true,
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
    return res.status(500).json({ success: false, message: 'Не удалось открыть карточку файла.' });
  }
});

router.get('/api/files/:id/download', ensureAuthenticated, ensureTwoFactor, async (req, res) => {
  const { id } = req.params;
  try {
    const file = await getFileById(id);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Файл не найден.' });
    }

    const user = req.session.user;
    const isOwner = file.owner_id === user.id;
    const classificationAllowed = canAccessClassification(user.role, file.classification);
    if (!isOwner && !classificationAllowed) {
      return res.status(403).json({ success: false, message: 'Нет доступа к данному уровню файла.' });
    }
    if ((file.classification === 'confidential' || file.classification === 'topsecret') && !user.twoFactorEnabled) {
      return res.status(403).json({ success: false, message: 'Для скачивания требуется включенная двухфакторная защита.' });
    }

    const filepath = path.join(uploadDirectory, file.stored_name);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, message: 'Файл недоступен на сервере.' });
    }

    await logAudit({ userId: user.id, action: 'files.download', details: id });
    return res.download(filepath, file.original_name);
  } catch (error) {
    console.error('download error', error);
    return res.status(500).json({ success: false, message: 'Не удалось подготовить файл к скачиванию.' });
  }
});

router.post('/api/files/:id/shares', ensureAuthenticated, ensureTwoFactor, async (req, res) => {
  const { id } = req.params;
  const { email, permission } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email получателя обязателен.' });
  }

  try {
    const file = await getFileById(id);
    if (!file || file.owner_id !== req.session.user.id) {
      return res.status(403).json({ success: false, message: 'Возможность обмена доступна только владельцу.' });
    }

    const share = await createShare({ fileId: id, targetEmail: email, permission: permission || 'viewer' });
    await logAudit({ userId: req.session.user.id, action: 'files.share', details: `${id}:${email}` });
    return res.json({ success: true, message: 'Доступ предоставлен.', share });
  } catch (error) {
    console.error('share error', error);
    return res.status(400).json({ success: false, message: error.message || 'Не удалось предоставить доступ.' });
  }
});

router.delete('/api/files/:id', ensureAuthenticated, ensureTwoFactor, async (req, res) => {
  const { id } = req.params;
  try {
    const file = await getFileById(id);
    if (!file || file.owner_id !== req.session.user.id) {
      return res.status(403).json({ success: false, message: 'Удалять файл может только владелец.' });
    }

    await deleteFile(id);
    const filepath = path.join(uploadDirectory, file.stored_name);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    await logAudit({ userId: req.session.user.id, action: 'files.delete', details: id });
    return res.json({ success: true, message: 'Файл удалён.' });
  } catch (error) {
    console.error('delete error', error);
    return res.status(500).json({ success: false, message: 'Не удалось удалить файл.' });
  }
});

router.delete('/api/files/:fileId/shares/:shareId', ensureAuthenticated, ensureTwoFactor, async (req, res) => {
  const { fileId, shareId } = req.params;
  try {
    const file = await getFileById(fileId);
    if (!file || file.owner_id !== req.session.user.id) {
      return res.status(403).json({ success: false, message: 'Только владелец может отзывать доступ.' });
    }

    await removeShare(shareId);
    await logAudit({ userId: req.session.user.id, action: 'files.share.revoke', details: `${shareId}:${fileId}` });
    return res.json({ success: true, message: 'Доступ отозван.' });
  } catch (error) {
    console.error('share revoke error', error);
    return res.status(500).json({ success: false, message: 'Не удалось отозвать доступ.' });
  }
});

module.exports = router;
