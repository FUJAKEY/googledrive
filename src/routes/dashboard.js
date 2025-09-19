const express = require('express');
const { ensureAuthenticated, ensureTwoFactor } = require('../middleware/auth');
const { listFilesForUser } = require('../services/database');
const { formatBytes, formatDate } = require('../utils/format');
const { canAccessClassification } = require('../utils/access');

const router = express.Router();

router.get('/api/dashboard/files', ensureAuthenticated, ensureTwoFactor, async (req, res, next) => {
  try {
    const user = req.session.user;
    const files = await listFilesForUser(user);
    const accessible = files.filter((file) => {
      const isOwner = file.owner_id === user.id;
      const classificationAllowed = canAccessClassification(user.role, file.classification);
      if (!isOwner && !classificationAllowed) {
        return false;
      }
      if ((file.classification === 'confidential' || file.classification === 'topsecret') && !user.twoFactorEnabled) {
        return false;
      }
      return true;
    });
    const enriched = accessible.map((file) => ({
      ...file,
      formattedSize: formatBytes(file.size),
      formattedDate: formatDate(file.created_at)
    }));

    return res.json({ success: true, files: enriched });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
