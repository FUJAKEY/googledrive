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

router.post('/api/auth/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email и пароль обязательны.' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Неверный email или пароль.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await logAudit({ userId: user.id, action: 'auth.failed', details: 'Неверный пароль' });
      return res.status(401).json({ success: false, message: 'Неверный email или пароль.' });
    }

    if (user.two_factor_enabled) {
      req.session.pendingTwoFactor = user.id;
      req.session.twoFactorValidated = false;
      req.session.userId = null;
      req.session.user = null;
      await logAudit({ userId: user.id, action: 'auth.2fa.required' });
      return res.json({ success: true, twoFactorRequired: true, message: 'Введите код двухфакторной аутентификации.' });
    }

    req.session.userId = user.id;
    req.session.twoFactorValidated = true;
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      twoFactorEnabled: !!user.two_factor_enabled
    };

    await logAudit({ userId: user.id, action: 'auth.success' });
    return res.json({ success: true, message: 'Добро пожаловать!' });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/auth/register', async (req, res, next) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ success: false, message: 'Email, имя и пароль обязательны.' });
  }

  try {
    await createUser({ email, name, password });
    const user = await findUserByEmail(email);
    await logAudit({ userId: user.id, action: 'auth.register' });
    return res.json({ success: true, message: 'Аккаунт создан. Теперь можно войти.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Не удалось создать аккаунт.' });
  }
});

router.get('/api/auth/2fa/context', async (req, res, next) => {
  const pendingUserId = req.session.pendingTwoFactor;
  if (!pendingUserId) {
    return res.status(404).json({ success: false, message: 'Сессия двухфакторной авторизации не найдена.' });
  }

  try {
    const user = await findUserById(pendingUserId);
    if (!user) {
      req.session.pendingTwoFactor = null;
      return res.status(404).json({ success: false, message: 'Пользователь не найден.' });
    }
    return res.json({ success: true, email: user.email });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/auth/2fa', async (req, res, next) => {
  const { token } = req.body;
  const pendingUserId = req.session.pendingTwoFactor;
  if (!pendingUserId) {
    return res.status(400).json({ success: false, message: 'Сессия двухфакторной авторизации истекла.' });
  }

  try {
    const user = await findUserById(pendingUserId);
    if (!user || !user.two_factor_secret) {
      req.session.pendingTwoFactor = null;
      return res.status(400).json({ success: false, message: 'Невозможно подтвердить код.' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      await logAudit({ userId: user.id, action: 'auth.2fa.failed' });
      return res.status(401).json({ success: false, message: 'Неверный код. Повторите попытку.' });
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
    return res.json({ success: true, message: 'Успешный вход.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/auth/logout', (req, res) => {
  const userId = req.session.userId;
  req.session.destroy(() => {
    if (userId) {
      logAudit({ userId, action: 'auth.logout' }).catch(() => {});
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

module.exports = router;
