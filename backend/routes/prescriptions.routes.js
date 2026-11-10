'use strict';

const express = require('express');
const { col, getDb } = require('../database/connection');
const {
  asyncRoute,
  cleanText,
  validEmail,
  idFrom,
  nowIso,
  withoutMongoId
} = require('../utils/helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { HealthcareBlockchain } = require('../services/blockchain.service');

const router = express.Router();

async function prescriptionRows(user) {
  const admin = user.role === 'admin';
  const users = await col('users').find(
    admin ? {} : { id: user.id },
    { projection: { id: 1, name: 1 } }
  ).toArray();
  const ids = users.map(item => item.id);
  const [saved, pending] = await Promise.all([
    col('prescriptions').find({ user_id: { $in: ids } }).sort({ created_at: -1 }).toArray(),
    admin ? col('pending_prescriptions').find({}).sort({ created_at: -1 }).toArray() : []
  ]);
  const doctors = await col('doctors').find().toArray();
  const userMap = new Map(users.map(item => [item.id, item]));
  const doctorMap = new Map(doctors.map(item => [item.id, item]));
  const prescriptions = saved.map(item => ({
    id: item.id, user_id: item.user_id, doctor_id: item.doctor_id ?? null,
    medication: item.medication, directions: item.directions, refills: item.refills,
    status: item.status, created_at: item.created_at, patient_name: userMap.get(item.user_id)?.name || '',
    doctor_name: doctorMap.get(item.doctor_id)?.name || null
  }));
  const pendingPrescriptions = pending.map(item => ({
    id: item.id, patient_name: item.patient_name, patient_email: item.patient_email,
    doctor_id: item.doctor_id ?? null, medication: item.medication, directions: item.directions,
    refills: item.refills, status: item.status, created_at: item.created_at,
    doctor_name: doctorMap.get(item.doctor_id)?.name || null
  }));
  return { prescriptions, pendingPrescriptions };
}

router.get('/', requireAuth, asyncRoute(async (req, res) => res.json(await prescriptionRows(req.user))));

router.post('/admin', requireAdmin, asyncRoute(async (req, res) => {
  const db = getDb();
  const patientType = req.body.patientType;
  const userId = idFrom(req.body.userId);
  const patientName = cleanText(req.body.patientName, 80);
  const patientEmail = cleanText(req.body.patientEmail, 254).toLowerCase();
  const doctorId = req.body.doctorId === '' || req.body.doctorId == null ? null : idFrom(req.body.doctorId);
  const medication = cleanText(req.body.medication, 120);
  const directions = cleanText(req.body.directions, 500);
  const refills = Number(req.body.refills);

  if (!['registered', 'new'].includes(patientType)) return res.status(400).json({ error: 'Choose an existing patient or enter details for a new patient.' });
  if (patientType === 'registered' && (!userId || !await col('users').findOne({ id: userId, role: 'patient' }))) {
    return res.status(400).json({ error: 'Choose a registered patient at your hospital.' });
  }
  if (patientType === 'new') {
    if (patientName.length < 2) return res.status(400).json({ error: 'Enter the new patient’s full name.' });
    if (!validEmail(patientEmail)) return res.status(400).json({ error: 'Enter a valid email address for the new patient.' });
    if (await col('users').findOne({ email: patientEmail })) return res.status(409).json({ error: 'This email already has a CareSphere account. Choose that patient from the existing-patient option.' });
  }
  if (req.body.doctorId != null && req.body.doctorId !== '' && !doctorId) return res.status(400).json({ error: 'Choose a valid clinician at your hospital.' });
  if (doctorId !== null && !await col('doctors').findOne({ id: doctorId })) return res.status(400).json({ error: 'Choose a valid clinician at your hospital.' });
  if (medication.length < 2 || directions.length < 2) return res.status(400).json({ error: 'Enter the prescription name and directions.' });
  if (!Number.isInteger(refills) || refills < 0 || refills > 20) return res.status(400).json({ error: 'Refills must be a whole number from 0 to 20.' });

  if (patientType === 'new') {
    const pending = {
      id: await db.nextId('pending_prescriptions'), hospital_id: req.user.hospital_id, patient_name: patientName,
      patient_email: patientEmail, doctor_id: doctorId, medication, directions, refills,
      status: 'Active', created_at: nowIso()
    };
    await col('pending_prescriptions').insertOne(pending);
    return res.status(201).json({ pendingPrescription: withoutMongoId(pending) });
  }

  const prescription = {
    id: await db.nextId('prescriptions'), user_id: userId, doctor_id: doctorId,
    medication, directions, refills, status: 'Active', created_at: nowIso()
  };
  await col('prescriptions').insertOne(prescription);

  await HealthcareBlockchain.addBlock(
    'PRESCRIPTION_ISSUED',
    `Prescription Issued: ${medication}`,
    String(userId),
    'Patient #' + userId,
    { prescriptionId: prescription.id, medication, refills, issuedBy: req.user.name }
  );

  return res.status(201).json({ prescription: withoutMongoId(prescription) });
}));

router.patch('/admin/:id', requireAdmin, asyncRoute(async (req, res) => {
  const doctorId = req.body.doctorId === '' || req.body.doctorId == null ? null : idFrom(req.body.doctorId);
  const medication = cleanText(req.body.medication, 120);
  const directions = cleanText(req.body.directions, 500);
  const refills = Number(req.body.refills);
  const status = req.body.status;
  if (req.body.doctorId != null && req.body.doctorId !== '' && !doctorId) return res.status(400).json({ error: 'Choose a valid clinician.' });
  if (doctorId !== null && !await col('doctors').findOne({ id: doctorId })) return res.status(400).json({ error: 'Choose a valid clinician.' });
  if (medication.length < 2 || directions.length < 2) return res.status(400).json({ error: 'Enter the prescription name and directions.' });
  if (!Number.isInteger(refills) || refills < 0 || refills > 20) return res.status(400).json({ error: 'Refills must be a whole number from 0 to 20.' });
  if (!['Active', 'Completed', 'Stopped'].includes(status)) return res.status(400).json({ error: 'Choose a valid prescription status.' });
  const result = await col('prescriptions').updateOne(
    { id: idFrom(req.params.id) },
    { $set: { doctor_id: doctorId, medication, directions, refills, status } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Prescription not found.' });
  return res.json({ ok: true });
}));

module.exports = router;

