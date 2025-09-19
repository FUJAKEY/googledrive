function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Необходимо авторизоваться для доступа к этой странице.');
  return res.redirect('/auth/login');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  return next();
}

module.exports = {
  ensureAuthenticated,
  redirectIfAuthenticated
};
