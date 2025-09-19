function flash() {
  return (req, _res, next) => {
    if (!req.session) {
      return next(new Error('Неинициализирована сессия для flash-сообщений.'));
    }

    if (!req.session.flash) {
      req.session.flash = {};
    }

    req.flash = (type, message) => {
      if (!type) {
        const current = req.session.flash;
        req.session.flash = {};
        return current;
      }

      if (message === undefined) {
        const messages = req.session.flash[type] || [];
        delete req.session.flash[type];
        return messages;
      }

      if (!req.session.flash[type]) {
        req.session.flash[type] = [];
      }

      req.session.flash[type].push(message);
      return req.session.flash[type];
    };

    next();
  };
}

module.exports = flash;
