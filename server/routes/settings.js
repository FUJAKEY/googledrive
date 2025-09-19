const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const storage = require('../services/storage');
const logger = require('../utils/logger');

const router = express.Router();

const passwordPolicy = body('newPassword')
  .isLength({ min: 8 })
  .withMessage('Пароль должен содержать минимум 8 символов.')
  .matches(/[A-ZА-Я]/)
  .withMessage('Добавьте хотя бы одну заглавную букву.')
  .matches(/[a-zа-я]/)
  .withMessage('Добавьте хотя бы одну строчную букву.')
  .matches(/[0-9]/)
  .withMessage('Добавьте хотя бы одну цифру.');

router.get('/', async (req, res) => {
  try {
    const user = await storage.getUserById(req.session.user.id);
    const stats = await storage.getUserStorageStats(req.session.user.id);

    res.render('settings/index', {
      title: 'Настройки безопасности',
      user,
      stats
    });
  } catch (error) {
    logger.logError(error);
    req.flash('error', 'Не удалось загрузить настройки.');
    res.redirect('/dashboard');
  }
});

router.post(
  '/profile',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Имя должно содержать минимум 2 символа.'),
    body('loginNotifications').optional().isIn(['on']).withMessage('Некорректное значение настройки уведомлений.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/settings');
    }

    try {
      const loginNotifications = req.body.loginNotifications === 'on';
      const updated = await storage.updateUser(req.session.user.id, {
        name: req.body.name.trim(),
        security: {
          loginNotifications
        }
      });

      req.session.user.name = updated.name;
      req.flash('success', 'Профиль успешно обновлён.');
      logger.logUserAction(req.session.user.id, 'update-profile', {
        loginNotifications
      });
      res.redirect('/settings');
    } catch (error) {
      logger.logError(error);
      req.flash('error', error.message || 'Не удалось обновить профиль.');
      res.redirect('/settings');
    }
  }
);

router.post(
  '/password',
  [
    body('currentPassword').notEmpty().withMessage('Введите текущий пароль.'),
    passwordPolicy,
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Подтверждение пароля не совпадает.');
      }
      return true;
    })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/settings');
    }

    try {
      const user = await storage.getUserById(req.session.user.id);
      if (!user) {
        req.flash('error', 'Пользователь не найден.');
        return res.redirect('/auth/login');
      }

      const isValid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!isValid) {
        req.flash('error', 'Текущий пароль введён неверно.');
        return res.redirect('/settings');
      }

      const newHash = await bcrypt.hash(req.body.newPassword, 12);
      await storage.updateUser(user.id, {
        passwordHash: newHash,
        security: {
          passwordUpdatedAt: new Date().toISOString()
        }
      });

      logger.logSecurityEvent('password-change', 'Пароль изменён пользователем', {
        userId: user.id
      });
      req.flash('success', 'Пароль успешно обновлён.');
      res.redirect('/settings');
    } catch (error) {
      logger.logError(error);
      req.flash('error', error.message || 'Не удалось изменить пароль.');
      res.redirect('/settings');
    }
  }
);

module.exports = router;
