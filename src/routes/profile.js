const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const { ensureAuthenticated } = require('../middleware/auth');
const { saveTwoFactorSecret, disableTwoFactor, logAudit, findUserById } = require('../services/database');

const router = express.Router();

router.get('/api/profile', ensureAuthenticated, async (req, res, next) => {
  try {
    const user = await findUserById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден.' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        twoFactorEnabled: !!user.two_factor_enabled
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/api/profile/security', ensureAuthenticated, async (req, res, next) => {
  try {
    let qrCode = null;
    const setup = req.session.twoFactorSetup;
    if (setup && setup.otpauth) {
      qrCode = await QRCode.toDataURL(setup.otpauth);
    }

    return res.json({
      success: true,
      twoFactorEnabled: req.session.user.twoFactorEnabled,
      setup: setup || null,
      qrCode
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/profile/security/setup', ensureAuthenticated, (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `Aurora Drive (${req.session.user.email})`,
    length: 32
  });

  req.session.twoFactorSetup = {
    base32: secret.base32,
    otpauth: secret.otpauth_url
  };

  res.json({
    success: true,
    message: 'Отсканируйте QR-код и подтвердите кодом из приложения.',
    setup: req.session.twoFactorSetup
  });
});

router.post('/api/profile/security/confirm', ensureAuthenticated, async (req, res, next) => {
  const { token } = req.body;
  const setup = req.session.twoFactorSetup;
  if (!setup) {
    return res.status(400).json({ success: false, message: 'Сессия настройки истекла.' });
  }

  try {
    const verified = speakeasy.totp.verify({
      secret: setup.base32,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Код не подтверждён. Повторите попытку.' });
    }

    await saveTwoFactorSecret(req.session.user.id, setup.base32, true);
    await logAudit({ userId: req.session.user.id, action: 'security.2fa.enabled' });

    req.session.user.twoFactorEnabled = true;
    req.session.twoFactorValidated = true;
    req.session.twoFactorSetup = null;

    return res.json({ success: true, message: 'Двухфакторная защита активирована.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/profile/security/disable', ensureAuthenticated, async (req, res, next) => {
  try {
    await disableTwoFactor(req.session.user.id);
    await logAudit({ userId: req.session.user.id, action: 'security.2fa.disabled' });
    req.session.user.twoFactorEnabled = false;
    req.session.twoFactorValidated = false;
    req.session.twoFactorSetup = null;
    return res.json({ success: true, message: 'Двухфакторная защита отключена.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
