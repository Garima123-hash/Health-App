'use strict';

const express = require('express');
const { col, getDb } = require('../database/connection');
const { asyncRoute, cleanText, validEmail } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth.middleware');

const authRoutes = require('./auth.routes');
const hospitalsRoutes = require('./hospitals.routes');
const doctorsRoutes = require('./doctors.routes');
const appointmentsRoutes = require('./appointments.routes');
const reportsRoutes = require('./reports.routes');
const blockchainRoutes = require('./blockchain.routes');
const adminRoutes = require('./admin.routes');
const womensHealthRoutes = require('./womensHealth.routes');
const prescriptionsRoutes = require('./prescriptions.routes');
const invoicesRoutes = require('./invoices.routes');

const router = express.Router();

// Health check endpoint
router.get('/health', asyncRoute(async (_req, res) => {
  const db = getDb();
  if (!db) {
    return res.status(503).json({
      status: 'degraded',
      service: 'CareSphere API',
      database: 'disconnected',
      defaultHospital: process.env.ADMIN_HOSPITAL || 'CareSphere Central Hospital'
    });
  }
  try {
    await db.database.command({ ping: 1 });
    return res.json({
      status: 'ok',
      service: 'CareSphere API',
      database: 'connected',
      defaultHospital: process.env.ADMIN_HOSPITAL || 'CareSphere Central Hospital'
    });
  } catch {
    return res.status(503).json({
      status: 'degraded',
      service: 'CareSphere API',
      database: 'disconnected',
      defaultHospital: process.env.ADMIN_HOSPITAL || 'CareSphere Central Hospital'
    });
  }
}));

// Notifications endpoint
router.get('/notifications', requireAuth, asyncRoute(async (req, res) => {
  const admin = req.user.role === 'admin';
  const hospitalFilter = admin && !req.user.is_super_admin ? { hospital_id: req.user.hospital_id } : {};
  const patientIds = admin && !req.user.is_super_admin
    ? (await col('users').find(
      { role: 'patient', hospital_id: req.user.hospital_id },
      { projection: { id: 1 } }
    ).toArray()).map(patient => patient.id)
    : [];
  const [appointments, invoices] = await Promise.all([
    col('appointments').find(admin
      ? { ...hospitalFilter, status: 'Pending' }
      : { user_id: req.user.id, status: { $in: ['Pending', 'Confirmed'] } }).sort({ appointment_at: 1 }).limit(10).toArray(),
    col('invoices').find(admin
      ? (req.user.is_super_admin ? { status: 'Due' } : { user_id: { $in: patientIds }, status: 'Due' })
      : { user_id: req.user.id, status: 'Due' }).sort({ created_at: -1 }).limit(10).toArray()
  ]);

  const notifications = [
    ...appointments.map(item => ({
      id: item.id, detail: item.appointment_at,
      message: admin ? 'Appointment request pending' : `Appointment ${item.status.toLowerCase()}`
    })),
    ...invoices.map(item => ({ id: item.id, detail: item.description, message: admin ? 'Invoice due' : 'Payment due' }))
  ];
  return res.json({ notifications });
}));

// Profile update endpoint
router.patch('/profile', requireAuth, asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name, 80);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const age = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
  const allowedGenders = ['female', 'male', 'non_binary', 'prefer_not_to_say', 'unspecified'];
  const gender = req.user.role === 'patient' && req.body.gender !== undefined
    ? cleanText(req.body.gender, 32).toLowerCase()
    : req.user.gender || 'unspecified';
  if (name.length < 2) return res.status(400).json({ error: 'Name must contain at least 2 characters.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (req.user.role === 'patient' && !allowedGenders.includes(gender)) return res.status(400).json({ error: 'Choose a valid gender option.' });
  if (req.user.role === 'patient' && age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
    return res.status(400).json({ error: 'Age must be a whole number between 0 and 120.' });
  }
  if (await col('users').findOne({ email, id: { $ne: req.user.id } }, { projection: { _id: 1 } })) {
    return res.status(409).json({ error: 'That email address is already in use.' });
  }
  try {
    const updates = { name, email, age: req.user.role === 'patient' ? age : null };
    if (req.user.role === 'patient' && req.body.gender !== undefined) {
      updates.gender = gender;
      if (gender !== 'female') updates.womens_health_enabled = false;
    }
    await col('users').updateOne({ id: req.user.id }, { $set: updates });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That email address is already in use.' });
    throw error;
  }
  Object.assign(req.user, { name, email, age: req.user.role === 'patient' ? age : null, gender });
  if (req.session?.user) Object.assign(req.session.user, { name, email, age, gender });
  return res.json({ user: req.user });
}));

// Mount modular sub-routers
router.use('/auth', authRoutes);
router.use('/hospitals', hospitalsRoutes);
router.use('/hospital', hospitalsRoutes);
router.use('/doctors', doctorsRoutes);
router.use('/appointments', appointmentsRoutes);
router.use('/reports', reportsRoutes);
router.use('/blockchain', blockchainRoutes);
router.use('/admin', adminRoutes);
router.use('/womens-health', womensHealthRoutes);
router.use('/prescriptions', prescriptionsRoutes);
router.use('/invoices', invoicesRoutes);

module.exports = router;
