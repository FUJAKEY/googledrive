const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { safeRedirectBack } = require('../utils/navigation');

const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '1', 10);
const globalMax = parseInt(process.env.RATE_LIMIT_MAX || '120', 10);

const generalRateLimiter = rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max: globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.logSecurityEvent('rate-limit', 'Превышен общий лимит запросов', {
      ip: req.ip,
      path: req.originalUrl
    });

    if (req.accepts('html')) {
      req.flash('error', 'Превышен лимит запросов. Попробуйте повторить попытку через минуту.');
      return safeRedirectBack(req, res, req.originalUrl || '/', 429);
    }

    return res.status(429).json({
      status: 'error',
      message: 'Вы временно заблокированы из-за большого количества запросов.'
    });
  }
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.logSecurityEvent('auth-rate-limit', 'Превышен лимит аутентификации', {
      ip: req.ip,
      path: req.originalUrl
    });
    req.flash('error', 'Слишком много попыток входа. Подождите немного и попробуйте снова.');
    return res.status(429).redirect('/auth/login');
  }
});

function attachSecurityHeaders(_req, res, next) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

module.exports = {
  generalRateLimiter,
  authRateLimiter,
  attachSecurityHeaders
};
