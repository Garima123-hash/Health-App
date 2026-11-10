'use strict';

const express = require('express');
const { col } = require('../database/connection');
const { asyncRoute } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', asyncRoute(async (_req, res) => {
  const hospitals = await col('hospitals').find({}, { projection: { _id: 0, id: 1, name: 1, city: 1 } }).sort({ name: 1 }).toArray();
  res.json({ hospitals });
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const hospital = await col('hospitals').findOne(
    { id: req.user.hospital_id }, { projection: { _id: 0, id: 1, name: 1, city: 1, phone: 1 } }
  );
  if (!hospital) return res.status(404).json({ error: 'Your hospital is not available.' });
  return res.json({ hospital });
}));

module.exports = router;
