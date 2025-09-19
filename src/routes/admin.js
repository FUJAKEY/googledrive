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

router.get('/api/admin/users', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), async (req, res, next) => {
  try {
    const users = await listUsers();
    return res.json({
      success: true,
      users: users.map((user) => ({
        ...user,
        created_at_formatted: formatDate(user.created_at)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/api/admin/users/:id/role', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ success: false, message: 'Роль обязательна.' });
  }
  try {
    await updateUserRole(id, role);
    await logAudit({ userId: req.session.user.id, action: 'admin.role.change', details: `${id}:${role}` });
    return res.json({ success: true, message: 'Роль пользователя обновлена.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/api/admin/audit', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), async (req, res, next) => {
  try {
    const logs = await listAuditLogs(200);
    return res.json({
      success: true,
      logs: logs.map((log) => ({
        ...log,
        created_at_formatted: formatDate(log.created_at)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/api/admin/files', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), async (req, res, next) => {
  try {
    const files = await listAllFiles();
    return res.json({
      success: true,
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
