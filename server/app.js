const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const csrf = require('csurf');
const hpp = require('hpp');
const nocache = require('nocache');
const dotenv = require('dotenv');

const { ensureAuthenticated } = require('./middleware/auth');
const flash = require('./middleware/flash');
const {
  generalRateLimiter,
  authRateLimiter,
  attachSecurityHeaders
} = require('./middleware/security');
const { initStorage } = require('./services/storage');
const logger = require('./utils/logger');
const { safeRedirectBack } = require('./utils/navigation');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const filesRoutes = require('./routes/files');
const settingsRoutes = require('./routes/settings');

dotenv.config();

const app = express();
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

initStorage();

if (!fs.existsSync(path.join(dataDir, 'sessions'))) {
  fs.mkdirSync(path.join(dataDir, 'sessions'), { recursive: true });
}

const sessionStore = new FileStore({
  path: path.join(dataDir, 'sessions'),
  retries: 1,
  fileExtension: '.session'
});

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'change_this_secret';

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(rootDir, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(hpp());
app.use(nocache());
app.use(generalRateLimiter);
app.use(compression());
app.use(morgan('combined'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(rootDir, 'public'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.use(session({
  name: 'secureDrive.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 2
  }
}));

app.use(flash());
app.use(attachSecurityHeaders);

const csrfProtection = csrf();
app.use(csrfProtection);
app.use((req, res, next) => {
  if (typeof res.locals.csrfToken === 'undefined') {
    try {
      res.locals.csrfToken = req.csrfToken();
    } catch {
      res.locals.csrfToken = '';
    }
  }
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.flash();
  res.locals.appName = 'SecureDrive';
  res.locals.currentPath = req.path;
  next();
});

app.use('/', (req, res, next) => {
  if (req.path === '/') {
    if (req.session.user) {
      return res.redirect('/dashboard');
    }
    return res.redirect('/auth/login');
  }
  return next();
});

app.use('/auth', authRateLimiter, authRoutes);
app.use('/dashboard', ensureAuthenticated, dashboardRoutes);
app.use('/files', ensureAuthenticated, filesRoutes);
app.use('/settings', ensureAuthenticated, settingsRoutes);

app.use((req, res) => {
  res.status(404);
  return res.render('404', {
    title: 'Страница не найдена'
  });
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.logSecurityEvent('csrf', 'Неверный CSRF токен', {
      ip: req.ip,
      userId: req.session.user ? req.session.user.id : null
    });
    const message = 'Проверка безопасности формы не пройдена. Попробуйте ещё раз.';
    if (req.xhr || req.accepts('json')) {
      return res.status(403).json({
        status: 'error',
        message
      });
    }
    req.flash('error', message);
    return safeRedirectBack(req, res, req.originalUrl || '/');
  }

  logger.logError(err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).render('500', {
    title: 'Внутренняя ошибка',
    message: 'Произошла непредвиденная ошибка. Мы уже работаем над её устранением.'
  });
});

module.exports = app;
