const express = require('express');

const { ensureAuthenticated, ensureRole, ensureTwoFactor } = require('../middleware/auth');
const {
  listUsers,
  updateUserRole,
  listAuditLogs,
  listAllFiles,
  logAudit
} = require('../services/database');
const { formatDate, formatBytes } = require('../utils/format');

const router = express.Router();

router.get('/admin/users', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), async (req, res, next) => {
  try {
    const users = await listUsers();
    return res.render('admin/users', {
      title: 'Управление пользователями',
      users: users.map((user) => ({
        ...user,
        created_at_formatted: formatDate(user.created_at)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/admin/users/:id/role', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
    await updateUserRole(id, role);
    await logAudit({ userId: req.session.user.id, action: 'admin.role.change', details: `${id}:${role}` });
    req.flash('success', 'Роль пользователя обновлена.');
    return res.redirect('/admin/users');
  } catch (error) {
    return next(error);
  }
});

router.get('/admin/audit', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), async (req, res, next) => {
  try {
    const logs = await listAuditLogs(200);
    return res.render('admin/audit', {
      title: 'Аудит действий',
      logs: logs.map((log) => ({
        ...log,
        created_at_formatted: formatDate(log.created_at)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin/files', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), async (req, res, next) => {
  try {
    const files = await listAllFiles();
    return res.render('admin/files', {
      title: 'Глобальный обзор файлов',
      files: files.map((file) => ({
        ...file,
        formattedSize: formatBytes(file.size),
        formattedDate: formatDate(file.created_at)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
