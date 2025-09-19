const { findUserById } = require('../services/database');

async function attachUser(req, res, next) {
  if (!req.session.userId) {
    req.user = null;
    return next();
  }

  try {
    if (!req.session.user || req.session.user.id !== req.session.userId) {
      const user = await findUserById(req.session.userId);
      if (user) {
        req.session.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          twoFactorEnabled: !!user.two_factor_enabled
        };
      } else {
        req.session.user = null;
        req.session.userId = null;
      }
    }

    req.user = req.session.user;
    res.locals.currentUser = req.session.user;
    next();
  } catch (error) {
    next(error);
  }
}

function ensureAuthenticated(req, res, next) {
  if (!req.session.userId) {
    req.flash('error', 'Для доступа необходимо войти в систему.');
    return res.redirect('/login');
  }
  return next();
}

function ensureRole(requiredRole) {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Необходима авторизация.');
      return res.redirect('/login');
    }

    const hierarchy = ['member', 'manager', 'security', 'admin'];
    const userIndex = hierarchy.indexOf(user.role);
    const requiredIndex = hierarchy.indexOf(requiredRole);

    if (userIndex === -1 || requiredIndex === -1 || userIndex < requiredIndex) {
      req.flash('error', 'Недостаточно прав для выполнения действия.');
      return res.redirect('/dashboard');
    }

    return next();
  };
}

function ensureTwoFactor(req, res, next) {
  const user = req.session.user;
  if (user && user.twoFactorEnabled && !req.session.twoFactorValidated) {
    return res.redirect('/2fa');
  }
  return next();
}

module.exports = {
  attachUser,
  ensureAuthenticated,
  ensureRole,
  ensureTwoFactor
};
