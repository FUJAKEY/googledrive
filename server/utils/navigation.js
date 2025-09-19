const { URL } = require('url');

function resolveReferrer(req) {
  const ref = req.get('Referrer') || req.get('Referer') || '';
  if (!ref) {
    return null;
  }

  if (ref.startsWith('/')) {
    return ref;
  }

  try {
    const parsed = new URL(ref);
    const host = req.get('host');
    if (parsed.host === host && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
      return `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`;
    }
  } catch {
    return null;
  }

  return null;
}

function safeRedirectBack(req, res, fallback = '/', statusCode) {
  const target = resolveReferrer(req) || fallback;
  if (typeof statusCode === 'number') {
    return res.redirect(statusCode, target);
  }
  return res.redirect(target);
}

module.exports = {
  safeRedirectBack
};
