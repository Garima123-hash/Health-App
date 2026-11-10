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
router.get('/health', (_req, res) => {
  const isConnected = !!getDb();
  res.json({
    status: isConnected ? 'ok' : 'degraded',
    service: 'CareSphere API',
    database: isConnected ? 'connected' : 'disconnected',
    defaultHospital: process.env.ADMIN_HOSPITAL || 'CareSphere Central Hospital'
  });
});

// Notifications endpoint
router.get('/notifications', requireAuth, asyncRoute(async (req, res) => {
  const admin = req.user.role === 'admin';
  const [appointments, invoices] = await Promise.all([
    col('appointments').find(admin ? { status: 'Pending' } : { user_id: req.user.id, status: { $in: ['Pending', 'Confirmed'] } }).sort({ appointment_at: 1 }).limit(10).toArray(),
    col('invoices').find(admin ? { status: 'Due' } : { user_id: req.user.id, status: 'Due' }).sort({ created_at: -1 }).limit(10).toArray()
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
  if (name.length < 2) return res.status(400).json({ error: 'Name must contain at least 2 characters.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (req.user.role === 'patient' && age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
    return res.status(400).json({ error: 'Age must be a whole number between 0 and 120.' });
  }
  if (await col('users').findOne({ email, id: { $ne: req.user.id } }, { projection: { _id: 1 } })) {
    return res.status(409).json({ error: 'That email address is already in use.' });
  }
  try {
    await col('users').updateOne({ id: req.user.id }, { $set: { name, email, age: req.user.role === 'patient' ? age : null } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That email address is already in use.' });
    throw error;
  }
  Object.assign(req.user, { name, email, age: req.user.role === 'patient' ? age : null });
  if (req.session?.user) Object.assign(req.session.user, { name, email, age });
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
