'use strict';

const express = require('express');
const { col, getDb } = require('../database/connection');
const {
  asyncRoute,
  cleanText,
  cleanPatientName,
  idFrom,
  nowIso
} = require('../utils/helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { HealthcareBlockchain } = require('../services/blockchain.service');

const router = express.Router();

async function appointmentRows(user) {
  let filter = {};
  if (user.role !== 'admin') {
    const userOr = [{ user_id: user.id }, { user_id: String(user.id) }];
    if (user.email) userOr.push({ patient_email: user.email.toLowerCase() });
    if (user._id) userOr.push({ user_id: String(user._id) });
    filter = { $or: userOr };
  }
  const appointments = await col('appointments').find(filter).sort({ appointment_at: 1 }).toArray();
  const doctors = await col('doctors').find().toArray();
  const hospitals = await col('hospitals').find().toArray();
  const patients = await col('users').find({ role: 'patient' }).toArray();

  const docMap = new Map();
  for (const d of doctors) {
    docMap.set(d.id, d);
    docMap.set(String(d.id), d);
    if (d._id) docMap.set(String(d._id), d);
    if (d.name) docMap.set(d.name.toLowerCase(), d);
  }
  const hospMap = new Map(hospitals.map(h => [h.id, h.name]));
  const patientMap = new Map();
  for (const p of patients) {
    patientMap.set(p.id, p);
    patientMap.set(String(p.id), p);
    if (p._id) patientMap.set(String(p._id), p);
    if (p.email) patientMap.set(p.email.toLowerCase(), p);
  }

  return appointments.map(item => {
    const doctor = docMap.get(item.doctor_id);
    const patient = patientMap.get(item.user_id) || patientMap.get(item.patient_email?.toLowerCase());
    return {
      id: item.id,
      patient_id: patient ? patient.id : item.user_id,
      patient_name: cleanPatientName(patient ? patient.name : (item.patient_name || 'Patient')),
      patient_email: patient ? patient.email : (item.patient_email || ''),
      doctor_id: doctor ? doctor.id : item.doctor_id,
      doctor_name: doctor?.name || item.doctor_name || 'Dr. Specialist',
      specialty: doctor?.specialty || item.specialty || 'General Medicine',
      hospital_name: hospMap.get(item.hospital_id || (doctor ? doctor.hospital_id : null)) || item.hospital_name || 'CareSphere Central Hospital',
      appointment_at: item.appointment_at,
      date: item.appointment_at,
      reason: item.reason,
      status: item.status,
      created_at: item.created_at
    };
  });
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  res.json({ appointments: await appointmentRows(req.user) });
}));

router.post('/', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts can request appointments.' });
  const db = getDb();
  const doctorId = idFrom(req.body.doctorId);
  const appointmentAt = cleanText(req.body.appointmentAt, 40);
  const reason = cleanText(req.body.reason || 'Consultation', 120);

  const doctor = doctorId && await col('doctors').findOne({ id: doctorId, available: true });
  if (!doctor) return res.status(400).json({ error: 'Please choose a valid doctor.' });

  const parsed = new Date(appointmentAt);
  if (!appointmentAt || Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
    return res.status(400).json({ error: 'Choose a valid future date and time.' });
  }

  const hosp = await col('hospitals').findOne({ id: doctor.hospital_id });
  const hospitalName = hosp ? hosp.name : 'CareSphere Central Hospital';

  const appointment = {
    id: await db.nextId('appointments'),
    user_id: req.user.id,
    patient_name: req.user.name,
    patient_email: req.user.email,
    doctor_id: doctorId,
    hospital_id: doctor.hospital_id,
    appointment_at: parsed.toISOString(),
    reason,
    status: 'Pending',
    created_at: nowIso()
  };
  await col('appointments').insertOne(appointment);

  await HealthcareBlockchain.addBlock(
    'APPOINTMENT',
    `Appointment Requested: Dr. ${doctor.name} at ${hospitalName}`,
    String(req.user.id),
    req.user.name,
    { appointmentId: appointment.id, doctor: doctor.name, hospital: hospitalName, at: appointment.appointment_at }
  );

  return res.status(201).json({
    appointment: {
      id: appointment.id,
      appointment_at: appointment.appointment_at,
      reason,
      status: appointment.status,
      doctor_id: doctor.id,
      doctor_name: doctor.name,
      specialty: doctor.specialty,
      hospital_name: hospitalName
    }
  });
}));

router.patch('/:id/status', requireAdmin, asyncRoute(async (req, res) => {
  const status = req.body.status;
  if (!['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid appointment status.' });
  }

  const apptId = idFrom(req.params.id);
  const appointment = await col('appointments').findOne({ id: apptId });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });

  await col('appointments').updateOne({ id: apptId }, { $set: { status } });

  await HealthcareBlockchain.addBlock(
    'APPOINTMENT_STATUS_UPDATE',
    `Appointment #${apptId} Status: ${status}`,
    String(req.user.id),
    req.user.name,
    { appointmentId: apptId, newStatus: status, updatedBy: req.user.name }
  );

  return res.json({ ok: true, status });
}));

module.exports = router;

