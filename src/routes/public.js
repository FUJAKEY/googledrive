const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  return res.render('index', { title: 'Aurora Drive — корпоративное хранилище' });
});

router.get('/security', (req, res) => {
  return res.render('security', { title: 'Безопасность Aurora Drive' });
});

router.get('/support', (req, res) => {
  return res.render('support', { title: 'Поддержка' });
});

module.exports = router;
