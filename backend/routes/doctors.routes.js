'use strict';

const express = require('express');
const { col } = require('../database/connection');
const { asyncRoute, idFrom } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const filter = {};
  const requestedHospital = typeof req.query.hospital === 'string' ? req.query.hospital.trim() : '';
  if (req.user?.role === 'admin' && !req.user.is_super_admin) {
    filter.hospital_id = req.user.hospital_id;
  } else if (requestedHospital && requestedHospital !== 'all') {
    const hosp = await col('hospitals').findOne({ name_key: requestedHospital.toLocaleLowerCase('en') });
    if (!hosp) return res.status(404).json({ error: 'Hospital not found.' });
    filter.hospital_id = hosp.id;
  } else if (req.user?.hospital_id && (req.user.role === 'admin' || requestedHospital !== 'all')) {
    filter.hospital_id = req.user.hospital_id;
  }
  filter.seeded_retired = { $ne: true };
  if (req.user?.role !== 'admin') filter.available = true;

  const doctors = await col('doctors').find(filter, {
    projection: { _id: 0, id: 1, name: 1, specialty: 1, experience: 1, available: 1, hospital_id: 1 }
  }).sort({ name: 1 }).toArray();

  const hospitals = await col('hospitals').find().toArray();
  const hospMap = new Map(hospitals.map(h => [h.id, h.name]));

  return res.json({
    doctors: doctors.map(d => ({
      ...d,
      hospital_name: hospMap.get(d.hospital_id) || 'CareSphere Central Hospital'
    }))
  });
}));

router.get('/:id', requireAuth, asyncRoute(async (req, res) => {
  const doctorId = idFrom(req.params.id);
  if (!doctorId) return res.status(400).json({ error: 'Invalid doctor ID.' });
  const doctor = await col('doctors').findOne({ id: doctorId });
  if (!doctor || (req.user.role === 'admin' && !req.user.is_super_admin && doctor.hospital_id !== req.user.hospital_id)) {
    return res.status(404).json({ error: 'Doctor not found.' });
  }
  const hosp = await col('hospitals').findOne({ id: doctor.hospital_id });
  return res.json({ doctor: { ...doctor, hospital_name: hosp?.name || 'CareSphere Central Hospital' } });
}));

module.exports = router;
