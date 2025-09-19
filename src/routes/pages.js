const express = require('express');
const path = require('path');

const { ensureAuthenticated, ensureTwoFactor, ensureRole } = require('../middleware/auth');

const router = express.Router();
const pagesDir = path.join(__dirname, '../../public/pages');

function sendPage(res, page) {
  return res.sendFile(path.join(pagesDir, page));
}

router.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return sendPage(res, 'index.html');
});

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return sendPage(res, 'login.html');
});

router.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return sendPage(res, 'register.html');
});

router.get('/support', (req, res) => sendPage(res, 'support.html'));
router.get('/security', (req, res) => sendPage(res, 'security.html'));

router.get('/dashboard', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(res, 'dashboard.html')
);

router.get('/files/upload', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(res, 'upload.html')
);

router.get('/files/:id', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(res, 'file.html')
);

router.get('/profile', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(res, 'profile.html')
);

router.get('/profile/security', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(res, 'profile-security.html')
);

router.get('/admin/users', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), (req, res) =>
  sendPage(res, 'admin-users.html')
);

router.get('/admin/files', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), (req, res) =>
  sendPage(res, 'admin-files.html')
);

router.get('/admin/audit', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), (req, res) =>
  sendPage(res, 'admin-audit.html')
);

router.get('/2fa', (req, res) => {
  if (!req.session.pendingTwoFactor) {
    if (req.session.userId) {
      return res.redirect('/dashboard');
    }
    return res.redirect('/login');
  }
  return sendPage(res, 'two-factor.html');
});

module.exports = router;
