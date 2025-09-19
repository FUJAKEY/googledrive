const express = require('express');
const fs = require('fs');
const path = require('path');

const { ensureAuthenticated, ensureTwoFactor, ensureRole } = require('../middleware/auth');

const router = express.Router();
const pagesDir = path.join(__dirname, '../../public/pages');
const pageCache = new Map();
const CSRF_PLACEHOLDER = '__CSRF_TOKEN__';

async function loadPage(page) {
  if (!pageCache.has(page)) {
    const filePath = path.join(pagesDir, page);
    const contents = await fs.promises.readFile(filePath, 'utf8');
    pageCache.set(page, contents);
  }
  return pageCache.get(page);
}

async function sendPage(req, res, page) {
  try {
    const template = await loadPage(page);
    if (template.includes(CSRF_PLACEHOLDER)) {
      if (typeof req.csrfToken !== 'function') {
        throw new Error('CSRF middleware недоступно для страницы');
      }
      const token = req.csrfToken();
      if (!token) {
        throw new Error('Не удалось получить CSRF-токен для страницы');
      }
      const html = template.replace(new RegExp(CSRF_PLACEHOLDER, 'g'), token);
      res.type('html').send(html);
      return;
    }
    res.type('html').send(template);
  } catch (error) {
    console.error(`Не удалось отдать страницу ${page}`, error);
    return res.status(500).sendFile(path.join(pagesDir, '500.html'));
  }
}

router.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return sendPage(req, res, 'index.html');
});

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return sendPage(req, res, 'login.html');
});

router.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return sendPage(req, res, 'register.html');
});

router.get('/support', (req, res) => sendPage(req, res, 'support.html'));
router.get('/security', (req, res) => sendPage(req, res, 'security.html'));

router.get('/dashboard', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(req, res, 'dashboard.html')
);

router.get('/files/upload', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(req, res, 'upload.html')
);

router.get('/files/:id', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(req, res, 'file.html')
);

router.get('/profile', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(req, res, 'profile.html')
);

router.get('/profile/security', ensureAuthenticated, ensureTwoFactor, (req, res) =>
  sendPage(req, res, 'profile-security.html')
);

router.get('/admin/users', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), (req, res) =>
  sendPage(req, res, 'admin-users.html')
);

router.get('/admin/files', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), (req, res) =>
  sendPage(req, res, 'admin-files.html')
);

router.get('/admin/audit', ensureAuthenticated, ensureTwoFactor, ensureRole('admin'), (req, res) =>
  sendPage(req, res, 'admin-audit.html')
);

router.get('/2fa', (req, res) => {
  if (!req.session.pendingTwoFactor) {
    if (req.session.userId) {
      return res.redirect('/dashboard');
    }
    return res.redirect('/login');
  }
  return sendPage(req, res, 'two-factor.html');
});

module.exports = router;
