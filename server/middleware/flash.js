function flash() {
  return (req, _res, next) => {
    const ensureFlashBag = () => {
      if (!req.session) {
        return null;
      }

      if (!req.session.flash || typeof req.session.flash !== 'object') {
        req.session.flash = {};
      }

      return req.session.flash;
    };

    req.flash = (type, message) => {
      const flashBag = ensureFlashBag();

      if (!type) {
        if (!flashBag) {
          return {};
        }

        const current = { ...flashBag };
        req.session.flash = {};
        return current;
      }

      if (message === undefined) {
        if (!flashBag) {
          return [];
        }

        const messages = flashBag[type] ? [...flashBag[type]] : [];
        delete flashBag[type];
        return messages;
      }

      if (!flashBag) {
        return [];
      }

      if (!Array.isArray(flashBag[type])) {
        flashBag[type] = [];
      }

      flashBag[type].push(message);
      return flashBag[type];
    };

    next();
  };
}

module.exports = flash;
