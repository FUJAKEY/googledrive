const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const flash = require('connect-flash');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');

const { attachUser } = require('./middleware/auth');
const { CLASSIFICATION_MATRIX } = require('./utils/access');

const app = express();

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

app.use(helmet({
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
}));
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
      secure: false,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 4
    },
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: path.join(__dirname, '../data')
    })
  })
);

app.use(flash());
app.use(attachUser);

app.use((req, res, next) => {
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages = req.flash('error');
  res.locals.infoMessages = req.flash('info');
  res.locals.classificationMatrix = CLASSIFICATION_MATRIX;
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Слишком много попыток входа. Попробуйте позже.'
});

app.use('/login', loginLimiter);
app.use('/2fa', loginLimiter);

app.use(csrf());

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use('/', require('./routes/public'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/files'));
app.use('/', require('./routes/profile'));
app.use('/', require('./routes/admin'));

app.use((req, res) => {
  res.status(404);
  return res.render('error', { title: 'Страница не найдена', message: 'Запрошенный ресурс отсутствует.' });
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    req.flash('error', 'Сессия безопасности истекла. Повторите действие.');
    return res.redirect('back');
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    req.flash('error', 'Размер файла превышает допустимый лимит (50 МБ).');
    return res.redirect('/files/upload');
  }

  if (err.message && err.message.includes('Недопустимый тип файла')) {
    req.flash('error', err.message);
    return res.redirect('/files/upload');
  }

  console.error('Unhandled error', err);
  res.status(500);
  return res.render('error', { title: 'Ошибка', message: 'Произошла ошибка. Попробуйте позже.' });
});

module.exports = app;
