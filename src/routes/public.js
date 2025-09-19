const express = require('express');

const { CLASSIFICATION_MATRIX } = require('../utils/access');

const router = express.Router();

router.get('/api/meta/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/api/meta/classification-matrix', (req, res) => {
  res.json({ success: true, matrix: CLASSIFICATION_MATRIX });
});

module.exports = router;
