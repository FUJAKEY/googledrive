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

class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function buildSessionUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    twoFactorEnabled: !!user.two_factor_enabled
  };
}

function isStrongPassword(password) {
  if (password.length < 8) {
    return false;
  }
  const hasUpper = /[A-ZА-Я]/.test(password);
  const hasLower = /[a-zа-я]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^\w\s]|_/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

function commitSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function attemptLogin(req) {
  const email = normalizeString(req.body.email).toLowerCase();
  const password = normalizeString(req.body.password);

  if (!email || !password) {
    throw new AuthError('Email и пароль обязательны.', 400);
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new AuthError('Неверный email или пароль.', 401);
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await logAudit({ userId: user.id, action: 'auth.failed', details: 'Неверный пароль' });
    throw new AuthError('Неверный email или пароль.', 401);
  }

  if (user.two_factor_enabled) {
    req.session.pendingTwoFactor = user.id;
    req.session.twoFactorValidated = false;
    req.session.userId = null;
    req.session.user = null;
    await logAudit({ userId: user.id, action: 'auth.2fa.required' });
    await commitSession(req);
    return { message: 'Введите код двухфакторной аутентификации.', twoFactorRequired: true };
  }

  req.session.pendingTwoFactor = null;
  req.session.userId = user.id;
  req.session.twoFactorValidated = true;
  req.session.user = buildSessionUser(user);

  await logAudit({ userId: user.id, action: 'auth.success' });
  await commitSession(req);

  return { message: 'Добро пожаловать!', twoFactorRequired: false };
}

async function attemptRegistration(req) {
  const email = normalizeString(req.body.email).toLowerCase();
  const name = normalizeString(req.body.name);
  const password = normalizeString(req.body.password);

  if (!email || !name || !password) {
    throw new AuthError('Email, имя и пароль обязательны.', 400);
  }

  if (email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError('Введите корректный email.', 400);
  }

  if (name.length < 2 || name.length > 120) {
    throw new AuthError('Имя должно содержать от 2 до 120 символов.', 400);
  }

  if (!isStrongPassword(password)) {
    throw new AuthError('Пароль должен содержать минимум 8 символов, включая заглавную букву, цифру и спецсимвол.', 400);
  }

  try {
    const user = await createUser({ email, name, password });
    await logAudit({ userId: user.id, action: 'auth.register' });
    return { message: 'Аккаунт создан. Теперь можно войти.' };
  } catch (error) {
    const message = error.message || 'Не удалось создать аккаунт.';
    const status = message.includes('существует') ? 409 : 400;
    throw new AuthError(message, status);
  }
}

async function completeTwoFactor(req) {
  const token = normalizeString(req.body.token);
  const pendingUserId = req.session.pendingTwoFactor;

  if (!pendingUserId) {
    throw new AuthError('Сессия двухфакторной авторизации истекла.', 400);
  }

  if (!token) {
    throw new AuthError('Введите одноразовый код.', 400);
  }

  const user = await findUserById(pendingUserId);
  if (!user || !user.two_factor_secret) {
    req.session.pendingTwoFactor = null;
    throw new AuthError('Невозможно подтвердить код.', 400);
  }

  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token,
    window: 1
  });

  if (!verified) {
    await logAudit({ userId: user.id, action: 'auth.2fa.failed' });
    throw new AuthError('Неверный код. Повторите попытку.', 401);
  }

  req.session.pendingTwoFactor = null;
  req.session.userId = user.id;
  req.session.twoFactorValidated = true;
  req.session.user = buildSessionUser(user);

  await logAudit({ userId: user.id, action: 'auth.2fa.success' });
  await commitSession(req);

  return { message: 'Успешный вход.' };
}

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const result = await attemptLogin(req);
    return res.json({
      success: true,
      message: result.message,
      twoFactorRequired: !!result.twoFactorRequired
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const result = await attemptLogin(req);
    if (result.twoFactorRequired) {
      return res.redirect(303, `/2fa?info=${encodeURIComponent(result.message)}`);
    }
    return res.redirect(303, '/dashboard');
  } catch (error) {
    if (error instanceof AuthError) {
      return res.redirect(303, `/login?error=${encodeURIComponent(error.message)}`);
    }
    return next(error);
  }
});

router.post('/api/auth/register', async (req, res, next) => {
  try {
    const result = await attemptRegistration(req);
    return res.status(201).json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

router.post('/auth/register', async (req, res, next) => {
  try {
    const result = await attemptRegistration(req);
    return res.redirect(303, `/login?success=${encodeURIComponent(result.message)}`);
  } catch (error) {
    if (error instanceof AuthError) {
      return res.redirect(303, `/register?error=${encodeURIComponent(error.message)}`);
    }
    return next(error);
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
  try {
    const result = await completeTwoFactor(req);
    return res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

router.post('/auth/2fa', async (req, res, next) => {
  try {
    const result = await completeTwoFactor(req);
    return res.redirect(303, `/dashboard?success=${encodeURIComponent(result.message)}`);
  } catch (error) {
    if (error instanceof AuthError) {
      return res.redirect(303, `/2fa?error=${encodeURIComponent(error.message)}`);
    }
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
