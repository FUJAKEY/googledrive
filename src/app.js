const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');

const { attachUser } = require('./middleware/auth');

const app = express();

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET || 'aurora-drive-secret';
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 4
    },
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: dataDir
    })
  })
);

app.use(attachUser);

app.use(express.static(path.join(__dirname, '../public')));

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Слишком много попыток входа. Попробуйте позже.'
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/2fa', loginLimiter);
app.use('/auth/login', loginLimiter);
app.use('/auth/2fa', loginLimiter);

app.use(csrf());

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.get('/api/session', (req, res) => {
  if (!req.session.userId || !req.session.user) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: {
      id: req.session.user.id,
      email: req.session.user.email,
      name: req.session.user.name,
      role: req.session.user.role,
      twoFactorEnabled: !!req.session.user.twoFactorEnabled,
      twoFactorValidated: !!req.session.twoFactorValidated
    }
  });
});

app.use('/', require('./routes/pages'));
app.use('/', require('./routes/public'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/files'));
app.use('/', require('./routes/profile'));
app.use('/', require('./routes/admin'));

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Ресурс не найден.' });
  }
  return res.status(404).sendFile(path.join(__dirname, '../public/pages/404.html'));
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ success: false, message: 'Сессия безопасности истекла. Обновите страницу и повторите действие.' });
    }
    return res.status(403).sendFile(path.join(__dirname, '../public/pages/403.html'));
  }

  console.error('Unhandled error', err);
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(500).json({ success: false, message: 'Произошла ошибка. Попробуйте позже.' });
  }
  return res.status(500).sendFile(path.join(__dirname, '../public/pages/500.html'));
});

module.exports = app;
