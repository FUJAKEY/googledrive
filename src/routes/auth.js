const express = require('express');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');

const {
  createUser,
  findUserByEmail,
  findUserById,
  logAudit
} = require('../services/database');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return res.render('login', { title: 'Вход' });
});

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      req.flash('error', 'Неверный email или пароль.');
      return res.redirect('/login');
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await logAudit({ userId: user.id, action: 'auth.failed', details: 'Неверный пароль' });
      req.flash('error', 'Неверный email или пароль.');
      return res.redirect('/login');
    }

    if (user.two_factor_enabled) {
      req.session.pendingTwoFactor = user.id;
      req.session.twoFactorValidated = false;
      req.session.userId = null;
      req.session.user = null;
      req.flash('info', 'Введите код двухфакторной аутентификации.');
      await logAudit({ userId: user.id, action: 'auth.2fa.required' });
      return res.redirect('/2fa');
    }

    req.session.userId = user.id;
    req.session.twoFactorValidated = false;
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      twoFactorEnabled: !!user.two_factor_enabled
    };

    await logAudit({ userId: user.id, action: 'auth.success' });
    req.flash('success', 'Добро пожаловать!');
    return res.redirect('/dashboard');
  } catch (error) {
    return next(error);
  }
});

router.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return res.render('register', { title: 'Регистрация' });
});

router.post('/register', async (req, res, next) => {
  const { email, name, password } = req.body;
  try {
    await createUser({ email, name, password });
    const user = await findUserByEmail(email);
    await logAudit({ userId: user.id, action: 'auth.register' });
    req.flash('success', 'Аккаунт создан. Теперь можно войти.');
    return res.redirect('/login');
  } catch (error) {
    req.flash('error', error.message || 'Не удалось создать аккаунт.');
    return res.redirect('/register');
  }
});

router.get('/2fa', async (req, res, next) => {
  if (!req.session.pendingTwoFactor) {
    if (req.session.userId) {
      return res.redirect('/dashboard');
    }
    req.flash('error', 'Сессия двухфакторной авторизации не найдена.');
    return res.redirect('/login');
  }

  try {
    const user = await findUserById(req.session.pendingTwoFactor);
    if (!user) {
      req.session.pendingTwoFactor = null;
      req.flash('error', 'Пользователь не найден.');
      return res.redirect('/login');
    }
    return res.render('two-factor', { title: 'Двухфакторная авторизация', email: user.email });
  } catch (error) {
    return next(error);
  }
});

router.post('/2fa', async (req, res, next) => {
  const { token } = req.body;
  const pendingUserId = req.session.pendingTwoFactor;
  if (!pendingUserId) {
    req.flash('error', 'Сессия двухфакторной авторизации истекла.');
    return res.redirect('/login');
  }

  try {
    const user = await findUserById(pendingUserId);
    if (!user || !user.two_factor_secret) {
      req.flash('error', 'Невозможно подтвердить код.');
      req.session.pendingTwoFactor = null;
      return res.redirect('/login');
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      await logAudit({ userId: user.id, action: 'auth.2fa.failed' });
      req.flash('error', 'Неверный код.');
      return res.redirect('/2fa');
    }

    req.session.pendingTwoFactor = null;
    req.session.userId = user.id;
    req.session.twoFactorValidated = true;
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      twoFactorEnabled: !!user.two_factor_enabled
    };

    await logAudit({ userId: user.id, action: 'auth.2fa.success' });
    req.flash('success', 'Успешный вход.');
    return res.redirect('/dashboard');
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res) => {
  const userId = req.session.userId;
  req.session.destroy(() => {
    if (userId) {
      logAudit({ userId, action: 'auth.logout' }).catch(() => {});
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;
