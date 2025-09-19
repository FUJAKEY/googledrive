const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const { redirectIfAuthenticated } = require('../middleware/auth');
const storage = require('../services/storage');
const logger = require('../utils/logger');

const router = express.Router();

const passwordPolicy = body('password')
  .isLength({ min: 8 })
  .withMessage('Пароль должен содержать минимум 8 символов.')
  .matches(/[A-ZА-Я]/)
  .withMessage('Добавьте хотя бы одну заглавную букву.')
  .matches(/[a-zа-я]/)
  .withMessage('Добавьте хотя бы одну строчную букву.')
  .matches(/[0-9]/)
  .withMessage('Добавьте хотя бы одну цифру.');

router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Вход в систему',
    values: {
      email: ''
    }
  });
});

router.post(
  '/login',
  redirectIfAuthenticated,
  [
    body('email').trim().isEmail().withMessage('Укажите корректный e-mail.'),
    body('password').notEmpty().withMessage('Введите пароль.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('auth/login', {
        title: 'Вход в систему',
        errors: errors.array(),
        values: {
          email: req.body.email
        }
      });
    }

    try {
      const user = await storage.findUserByEmail(req.body.email);
      if (!user) {
        req.flash('error', 'Неверный e-mail или пароль.');
        return res.status(401).render('auth/login', {
          title: 'Вход в систему',
          values: {
            email: req.body.email
          }
        });
      }

      const passwordMatch = await bcrypt.compare(req.body.password, user.passwordHash);
      if (!passwordMatch) {
        req.flash('error', 'Неверный e-mail или пароль.');
        logger.logSecurityEvent('auth', 'Неуспешная попытка входа', {
          email: req.body.email,
          ip: req.ip
        });
        return res.status(401).render('auth/login', {
          title: 'Вход в систему',
          values: {
            email: req.body.email
          }
        });
      }

      await storage.ensureUserRootDirectory(user.id);

      await new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
          if (error) {
            reject(error);
            return;
          }
          req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email
          };
          req.session.lastActiveAt = Date.now();
          resolve();
        });
      });

      await storage.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
      logger.logUserAction(user.id, 'login', { ip: req.ip });

      return req.session.save(() => {
        req.flash('success', 'Добро пожаловать обратно!');
        res.redirect('/dashboard');
      });
    } catch (error) {
      logger.logError(error);
      req.flash('error', 'Не удалось выполнить вход. Попробуйте позже.');
      return res.status(500).render('auth/login', {
        title: 'Вход в систему',
        values: {
          email: req.body.email
        }
      });
    }
  }
);

router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Создание аккаунта',
    values: {
      name: '',
      email: ''
    }
  });
});

router.post(
  '/register',
  redirectIfAuthenticated,
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Имя должно содержать минимум 2 символа.'),
    body('email').trim().isEmail().withMessage('Укажите корректный e-mail.'),
    passwordPolicy,
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Пароли не совпадают.');
      }
      return true;
    })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('auth/register', {
        title: 'Создание аккаунта',
        errors: errors.array(),
        values: {
          name: req.body.name,
          email: req.body.email
        }
      });
    }

    try {
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      const user = await storage.createUser({
        name: req.body.name.trim(),
        email: req.body.email.toLowerCase(),
        passwordHash
      });

      await new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
          if (error) {
            reject(error);
            return;
          }
          req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email
          };
          resolve();
        });
      });

      logger.logUserAction(user.id, 'register', { ip: req.ip });
      req.flash('success', 'Аккаунт успешно создан. Добро пожаловать!');

      return req.session.save(() => {
        res.redirect('/dashboard');
      });
    } catch (error) {
      logger.logError(error);
      req.flash('error', error.message || 'Не удалось создать аккаунт.');
      return res.status(500).render('auth/register', {
        title: 'Создание аккаунта',
        values: {
          name: req.body.name,
          email: req.body.email
        }
      });
    }
  }
);

router.post('/logout', async (req, res, next) => {
  if (!req.session) {
    return res.redirect('/auth/login');
  }

  const { user } = req.session;
  req.session.regenerate((error) => {
    if (error) {
      logger.logError(error);
      return next(error);
    }

    if (user) {
      logger.logUserAction(user.id, 'logout', {});
    }

    req.flash('success', 'Вы успешно вышли из системы.');
    return req.session.save(() => {
      res.redirect('/auth/login');
    });
  });
});

module.exports = router;
