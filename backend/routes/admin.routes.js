'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { col, getDb } = require('../database/connection');
const {
  asyncRoute,
  cleanText,
  cleanPatientName,
  validEmail,
  idFrom,
  nowIso,
  withoutMongoId
} = require('../utils/helpers');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth.middleware');
const { HealthcareBlockchain } = require('../services/blockchain.service');

const router = express.Router();

// Hospitals administration
router.get('/hospitals', requireAdmin, asyncRoute(async (req, res) => {
  const filter = req.user.is_super_admin ? {} : { id: req.user.hospital_id };
  const hospitals = await col('hospitals').find(filter, {
    projection: { _id: 0, id: 1, name: 1, city: 1, phone: 1 }
  }).sort({ name: 1 }).toArray();
  return res.json({ hospitals });
}));

router.get('/hospital-admins', requireSuperAdmin, asyncRoute(async (_req, res) => {
  const admins = await col('users').find(
    { role: 'admin', is_super_admin: { $ne: true } },
    { projection: { _id: 0, id: 1, name: 1, email: 1, hospital_id: 1 } }
  ).sort({ name: 1 }).toArray();
  const hospitals = await col('hospitals').find(
    { id: { $in: admins.map(admin => admin.hospital_id) } },
    { projection: { _id: 0, id: 1, name: 1 } }
  ).toArray();
  const hospitalNames = new Map(hospitals.map(hospital => [hospital.id, hospital.name]));
  return res.json({
    admins: admins.map(admin => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      hospital_id: admin.hospital_id,
      hospital_name: hospitalNames.get(admin.hospital_id) || 'Unknown hospital'
    }))
  });
}));

router.post('/hospital-admins', requireSuperAdmin, asyncRoute(async (req, res) => {
  const db = getDb();
  const name = cleanText(req.body.name, 80);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const hospitalId = idFrom(req.body.hospitalId);
  if (name.length < 2) return res.status(400).json({ error: 'Enter the administrator’s full name.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must contain 8–128 characters.' });
  if (!hospitalId) return res.status(400).json({ error: 'Choose a hospital for this administrator.' });
  const hospital = await col('hospitals').findOne({ id: hospitalId });
  if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });
  if (await col('users').findOne({ email }, { projection: { _id: 1 } })) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const admin = {
    id: await db.nextId('users'),
    name,
    email,
    password_hash: await bcrypt.hash(password, 12),
    role: 'admin',
    is_super_admin: false,
    hospital_id: hospital.id,
    created_at: nowIso()
  };
  let insertedUser = false;
  try {
    await col('users').insertOne(admin);
    insertedUser = true;
    await col('hospital_admins').insertOne({
      id: await db.nextId('hospital_admins'),
      user_id: admin.id,
      hospital_id: hospital.id
    });
  } catch (error) {
    if (insertedUser) await col('users').deleteOne({ id: admin.id });
    if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    throw error;
  }

  return res.status(201).json({
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      hospital_id: hospital.id,
      hospital_name: hospital.name
    }
  });
}));

router.post('/hospitals', requireSuperAdmin, asyncRoute(async (req, res) => {
  const db = getDb();
  const name = cleanText(req.body.name, 120);
  const city = cleanText(req.body.city, 100);
  if (name.length < 3) return res.status(400).json({ error: 'Hospital name must contain at least 3 characters.' });
  const hospital = {
    id: await db.nextId('hospitals'), name, name_key: name.toLocaleLowerCase('en'),
    city, phone: '', created_at: nowIso()
  };
  try { await col('hospitals').insertOne(hospital); } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A hospital with that name already exists.' });
    throw error;
  }
  await col('hospital_admins').insertOne({
    id: await db.nextId('hospital_admins'), user_id: req.user.id, hospital_id: hospital.id
  });
  return res.status(201).json({ hospital: withoutMongoId(hospital) });
}));

router.post('/hospitals/select', requireSuperAdmin, asyncRoute(async (req, res) => {
  const hospitalId = idFrom(req.body.hospitalId);
  if (!hospitalId) return res.status(403).json({ error: 'You are not assigned to that hospital.' });
  const [hospital, assignment] = await Promise.all([
    col('hospitals').findOne({ id: hospitalId }, { projection: { _id: 0, id: 1, name: 1, city: 1, phone: 1 } }),
    col('hospital_admins').findOne({ user_id: req.user.id, hospital_id: hospitalId }, { projection: { _id: 1 } })
  ]);
  if (!hospital || !assignment) return res.status(403).json({ error: 'You are not assigned to that hospital.' });
  await col('users').updateOne({ id: req.user.id }, { $set: { hospital_id: hospital.id } });
  req.user.hospital_id = hospital.id;
  req.user.hospital_name = hospital.name;
  if (req.session?.user) {
    req.session.user.hospital_id = hospital.id;
    req.session.user.hospital_name = hospital.name;
  }
  return res.json({ hospital });
}));

router.patch('/hospital', requireAdmin, asyncRoute(async (req, res) => {
  const name = cleanText(req.body.hospital_name || req.body.name, 120);
  const city = cleanText(req.body.city, 100);
  const phone = cleanText(req.body.phone, 40);
  if (name.length < 3) return res.status(400).json({ error: 'Hospital name must contain at least 3 characters.' });
  const nameKey = name.toLocaleLowerCase('en');
  if (await col('hospitals').findOne({ name_key: nameKey, id: { $ne: req.user.hospital_id } }, { projection: { _id: 1 } })) {
    return res.status(409).json({ error: 'Another hospital already uses that name.' });
  }
  const oldHospital = await col('hospitals').findOne({ id: req.user.hospital_id });
  const oldName = oldHospital ? oldHospital.name : 'CareSphere Central Hospital';

  await col('hospitals').updateOne({ id: req.user.hospital_id }, { $set: { name, name_key: nameKey, city, phone } });
  req.user.hospital_name = name;
  if (req.session?.user) req.session.user.hospital_name = name;
  await HealthcareBlockchain.addBlock(
    'HOSPITAL_PROFILE_UPDATED',
    `Hospital Facility Configured: ${name}`,
    String(req.user.id),
    req.user.name,
    { previousName: oldName, newName: name, updatedBy: req.user.name }
  );

  const hospital = await col('hospitals').findOne(
    { id: req.user.hospital_id }, { projection: { _id: 0, id: 1, name: 1, city: 1, phone: 1 } }
  );
  return res.json({ message: `Hospital facility name updated to "${name}".`, hospital, hospital_name: name });
}));

// Doctors administration
router.post('/doctors', requireAdmin, asyncRoute(async (req, res) => {
  const db = getDb();
  const name = cleanText(req.body.name, 100);
  const specialty = cleanText(req.body.specialty, 80);
  const experience = cleanText(req.body.experience || '10 years experience', 80);
  const symbol = cleanText(req.body.symbol || '👨‍⚕️', 10);
  if (name.length < 3) return res.status(400).json({ error: 'Enter a doctor name with at least 3 characters.' });
  if (specialty.length < 2) return res.status(400).json({ error: 'Enter a specialty with at least 2 characters.' });

  const doctor = {
    id: await db.nextId('doctors'), name, name_key: name.toLocaleLowerCase('en'), specialty,
    experience, available: true, hospital_id: req.user.hospital_id, symbol
  };
  try {
    await col('doctors').insertOne(doctor);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A doctor with that name already exists at this hospital.' });
    throw error;
  }

  const hosp = await col('hospitals').findOne({ id: req.user.hospital_id });
  const hospitalName = hosp ? hosp.name : 'CareSphere Central Hospital';

  await HealthcareBlockchain.addBlock(
    'DOCTOR_ONBOARDED',
    `Clinical Doctor Onboarded: ${doctor.name} (${doctor.specialty})`,
    String(doctor.id),
    doctor.name,
    { hospital: hospitalName, specialty: doctor.specialty, experience: doctor.experience, onboardedBy: req.user.name }
  );

  return res.status(201).json({
    doctor: { ...withoutMongoId(doctor), hospital_name: hospitalName }
  });
}));

router.patch('/doctors/:id', requireAdmin, asyncRoute(async (req, res) => {
  if (typeof req.body.available !== 'boolean') return res.status(400).json({ error: 'Availability must be true or false.' });
  const result = await col('doctors').updateOne(
    { id: idFrom(req.params.id), hospital_id: req.user.hospital_id },
    { $set: { available: req.body.available } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Doctor not found.' });
  return res.json({ ok: true });
}));

// Patients administration
router.get('/patients', requireAdmin, asyncRoute(async (req, res) => {
  const patientFilter = { role: 'patient' };
  if (!req.user.is_super_admin) patientFilter.hospital_id = req.user.hospital_id;
  const patients = await col('users').find(patientFilter, {
    projection: { _id: 0, id: 1, name: 1, email: 1, age: 1, created_at: 1 }
  }).sort({ created_at: -1 }).toArray();
  return res.json({
    patients: patients.map(p => ({
      ...p,
      name: cleanPatientName(p.name)
    }))
  });
}));

router.post('/patients', requireAdmin, asyncRoute(async (req, res) => {
  const db = getDb();
  const name = cleanText(req.body.name, 80);
  const email = cleanText(req.body.email, 254).toLowerCase();
  if (name.length < 2) return res.status(400).json({ error: 'Please enter patient name.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

  if (await col('users').findOne({ email })) {
    return res.status(409).json({ error: 'A user with that email already exists.' });
  }

  const patient = {
    id: await db.nextId('users'),
    name: cleanPatientName(name),
    email,
    password_hash: await bcrypt.hash('CareSphere@123', 12),
    role: 'patient',
    hospital_id: req.user.hospital_id,
    created_at: nowIso()
  };

  await col('users').insertOne(patient);

  await HealthcareBlockchain.addBlock(
    'PATIENT_REGISTRATION',
    `Patient Profile Registered by Admin: ${patient.name}`,
    String(patient.id),
    patient.name,
    { email: patient.email, registeredBy: req.user.name }
  );

  return res.status(201).json({ patient: withoutMongoId(patient) });
}));

// Analytics dashboard
router.get('/analytics', requireAdmin, asyncRoute(async (req, res) => {
  const hospitalFilter = req.user.is_super_admin ? {} : { hospital_id: req.user.hospital_id };
  const patientsInScope = await col('users').find(
    { role: 'patient', ...hospitalFilter },
    { projection: { id: 1 } }
  ).toArray();
  const patientIds = patientsInScope.map(patient => patient.id);
  const patientFilter = req.user.is_super_admin ? { role: 'patient' } : { role: 'patient', hospital_id: req.user.hospital_id };
  const reportFilter = req.user.is_super_admin ? {} : { user_id: { $in: patientIds } };
  const [patients, doctors, appointments, pendingAppointments, dueInvoices, uploadedReports, recent] = await Promise.all([
    col('users').countDocuments(patientFilter),
    col('doctors').countDocuments({ ...hospitalFilter, available: true }),
    col('appointments').countDocuments(hospitalFilter),
    col('appointments').countDocuments({ ...hospitalFilter, status: 'Pending' }),
    col('invoices').countDocuments(req.user.is_super_admin ? { status: 'Due' } : { user_id: { $in: patientIds }, status: 'Due' }),
    col('reports').countDocuments(reportFilter),
    col('appointments').find(hospitalFilter).sort({ created_at: -1 }).limit(100).toArray()
  ]);

  const recentUsers = await col('users').find({ id: { $in: [...new Set(recent.map(item => item.user_id))] } }).toArray();
  const recentDoctors = await col('doctors').find({ id: { $in: [...new Set(recent.map(item => item.doctor_id))] } }).toArray();
  const userMap = new Map(recentUsers.map(item => [item.id, item]));
  const doctorMap = new Map(recentDoctors.map(item => [item.id, item]));

  const recentAppointments = recent.map(item => ({
    id: item.id, appointment_at: item.appointment_at, reason: item.reason, status: item.status, created_at: item.created_at,
    doctor_id: item.doctor_id, doctor_name: doctorMap.get(item.doctor_id)?.name || '',
    specialty: doctorMap.get(item.doctor_id)?.specialty || '',
    patient_name: userMap.get(item.user_id)?.name || '', patient_email: userMap.get(item.user_id)?.email || ''
  }));

  return res.json({
    totals: { patients, doctors, appointments, pendingAppointments, dueInvoices, uploadedReports },
    recentAppointments
  });
}));

module.exports = router;
