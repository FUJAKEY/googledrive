const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const { ensureAuthenticated } = require('../middleware/auth');
const { saveTwoFactorSecret, disableTwoFactor, logAudit, findUserById } = require('../services/database');

const router = express.Router();

router.get('/profile', ensureAuthenticated, async (req, res, next) => {
  try {
    const user = await findUserById(req.session.user.id);
    return res.render('profile/index', {
      title: 'Профиль пользователя',
      user
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/profile/security', ensureAuthenticated, async (req, res, next) => {
  try {
    let qrCode = null;
    const setup = req.session.twoFactorSetup;
    if (setup && setup.otpauth) {
      qrCode = await QRCode.toDataURL(setup.otpauth);
    }

    return res.render('profile/security', {
      title: 'Центр безопасности',
      twoFactorEnabled: req.session.user.twoFactorEnabled,
      setup,
      qrCode
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/profile/security/setup', ensureAuthenticated, (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `Aurora Drive (${req.session.user.email})`,
    length: 32
  });

  req.session.twoFactorSetup = {
    base32: secret.base32,
    otpauth: secret.otpauth_url
  };

  req.flash('info', 'Отсканируйте QR-код и подтвердите кодом из приложения.');
  return res.redirect('/profile/security');
});

router.post('/profile/security/confirm', ensureAuthenticated, async (req, res, next) => {
  const { token } = req.body;
  const setup = req.session.twoFactorSetup;
  if (!setup) {
    req.flash('error', 'Сессия настройки истекла.');
    return res.redirect('/profile/security');
  }

  try {
    const verified = speakeasy.totp.verify({
      secret: setup.base32,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      req.flash('error', 'Код не подтверждён. Повторите попытку.');
      return res.redirect('/profile/security');
    }

    await saveTwoFactorSecret(req.session.user.id, setup.base32, true);
    await logAudit({ userId: req.session.user.id, action: 'security.2fa.enabled' });

    req.session.user.twoFactorEnabled = true;
    req.session.twoFactorValidated = true;
    req.session.twoFactorSetup = null;
    req.flash('success', 'Двухфакторная защита активирована.');
    return res.redirect('/profile/security');
  } catch (error) {
    return next(error);
  }
});

router.post('/profile/security/disable', ensureAuthenticated, async (req, res, next) => {
  try {
    await disableTwoFactor(req.session.user.id);
    await logAudit({ userId: req.session.user.id, action: 'security.2fa.disabled' });
    req.session.user.twoFactorEnabled = false;
    req.session.twoFactorValidated = false;
    req.session.twoFactorSetup = null;
    req.flash('info', 'Двухфакторная защита отключена.');
    return res.redirect('/profile/security');
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
