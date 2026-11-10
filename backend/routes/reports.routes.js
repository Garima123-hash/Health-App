'use strict';

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { col, getDb } = require('../database/connection');
const { UPLOAD_DIR } = require('../config');
const {
  asyncRoute,
  cleanText,
  cleanPatientName,
  idFrom,
  nowIso
} = require('../utils/helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { reportUpload } = require('../middleware/upload.middleware');
const { HealthcareBlockchain } = require('../services/blockchain.service');
const { extractReportSentences } = require('../services/pdf.service');

const router = express.Router();

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  let filter = {};
  if (!isAdmin) {
    const userOr = [{ user_id: req.user.id }, { user_id: String(req.user.id) }];
    if (req.user.email) userOr.push({ patient_email: req.user.email.toLowerCase() });
    if (req.user._id) userOr.push({ user_id: String(req.user._id) });
    filter = { $or: userOr };
  } else if (req.query.patientId) {
    const pId = idFrom(req.query.patientId) || Number(req.query.patientId);
    const targetUser = await col('users').findOne({ id: pId });
    const orCond = [{ user_id: pId }, { user_id: String(pId) }];
    if (targetUser?.email) orCond.push({ patient_email: targetUser.email.toLowerCase() });
    if (targetUser?._id) orCond.push({ user_id: String(targetUser._id) });
    filter = { $or: orCond };
  }

  const reports = await col('reports').find(filter).sort({ created_at: -1 }).toArray();
  const users = await col('users').find({ role: 'patient' }).toArray();
  const userMap = new Map();
  for (const u of users) {
    userMap.set(u.id, u);
    userMap.set(String(u.id), u);
    if (u._id) userMap.set(String(u._id), u);
    if (u.email) userMap.set(u.email.toLowerCase(), u);
  }

  return res.json({
    reports: reports.map(r => {
      const patient = userMap.get(r.user_id) || userMap.get(r.patient_email?.toLowerCase());
      return {
        id: String(r.id),
        userId: String(r.user_id || (patient ? patient.id : '')),
        patientName: cleanPatientName(r.patient_name || (patient ? patient.name : 'Patient')),
        patientEmail: r.patient_email || (patient ? patient.email : ''),
        hospitalName: r.hospital_name || 'CareSphere Central Hospital',
        uploadedByRole: r.uploaded_by_role || (r.user_id === req.user.id ? 'patient' : 'hospital'),
        uploadedByName: r.uploaded_by_name || 'CareSphere Staff',
        original_name: r.original_name,
        mime_type: r.mime_type,
        file_size: r.file_size,
        status: r.status || 'Sealed',
        category: r.category || 'Diagnostic Report',
        documentHash: r.document_hash || '',
        blockIndex: r.block_index || 1,
        shared_with_hospital: r.shared_with_hospital ? 1 : 0,
        created_at: r.created_at
      };
    })
  });
}));

router.get('/admin', requireAdmin, asyncRoute(async (_req, res) => {
  const reports = await col('reports').find({}).sort({ created_at: -1 }).toArray();
  const users = await col('users').find({ role: 'patient' }).toArray();
  const userMap = new Map(users.map(u => [u.id, u]));

  return res.json({
    reports: reports.map(report => ({
      id: report.id,
      original_name: report.original_name,
      mime_type: report.mime_type,
      file_size: report.file_size,
      created_at: report.created_at,
      patient_name: cleanPatientName(userMap.get(report.user_id)?.name || 'Patient'),
      patient_email: userMap.get(report.user_id)?.email || ''
    }))
  });
}));

const handleReportUpload = async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a PDF, JPG, or PNG report to upload.' });
  const db = getDb();

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const documentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const isAdmin = req.user.role === 'admin';
    let targetUserId = req.user.id;
    let targetPatientName = req.user.name;
    let targetPatientEmail = req.user.email;
    const hospitalName = cleanText(req.body.hospitalName || req.user.hospital_name || 'CareSphere Central Hospital', 100);
    const category = cleanText(req.body.category || (isAdmin ? 'Hospital Diagnostic Report' : 'Patient Uploaded Record'), 60);

    if (isAdmin) {
      const patientId = idFrom(req.body.patientId);
      const apptId = idFrom(req.body.appointmentId);
      const patientEmail = cleanText(req.body.patientEmail, 254).toLowerCase();

      if (patientId) {
        const patient = await col('users').findOne({ id: patientId });
        if (!patient) return res.status(400).json({ error: 'Specified patient was not found.' });
        targetUserId = patient.id;
        targetPatientName = patient.name;
        targetPatientEmail = patient.email;
      } else if (apptId) {
        const appt = await col('appointments').findOne({ id: apptId });
        if (appt) {
          targetUserId = appt.user_id;
          const patient = await col('users').findOne({ id: appt.user_id });
          targetPatientName = patient ? patient.name : appt.patient_name;
          targetPatientEmail = patient ? patient.email : appt.patient_email;
        } else {
          return res.status(400).json({ error: 'Appointment patient could not be located.' });
        }
      } else if (patientEmail) {
        const patient = await col('users').findOne({ email: patientEmail });
        if (patient) {
          targetUserId = patient.id;
          targetPatientName = patient.name;
          targetPatientEmail = patient.email;
        } else {
          return res.status(400).json({ error: 'Specified patient account could not be found.' });
        }
      } else {
        return res.status(400).json({ error: 'Please choose which patient this medical report belongs to.' });
      }
    }

    const originalName = path.basename(req.file.originalname).replace(/[\r\n"]/g, '_').slice(0, 160);
    const report = {
      id: await db.nextId('reports'),
      user_id: targetUserId,
      patient_name: cleanPatientName(targetPatientName),
      patient_email: targetPatientEmail,
      hospital_name: hospitalName,
      uploaded_by_role: isAdmin ? 'hospital' : 'patient',
      uploaded_by_name: req.user.name,
      original_name: originalName,
      stored_name: req.file.filename,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      shared_with_hospital: req.body.shareWithHospital === 'true' || isAdmin,
      summary_count: 0,
      summary_last_used_at: null,
      status: 'Sealed',
      category,
      document_hash: documentHash,
      created_at: nowIso()
    };

    const blockTitle = isAdmin
      ? `Hospital Report Issued by ${hospitalName}: ${originalName} for ${cleanPatientName(targetPatientName)}`
      : `Patient Medical Record Sealed: ${originalName}`;

    const block = await HealthcareBlockchain.addBlock(
      'MEDICAL_RECORD',
      blockTitle,
      String(targetUserId),
      cleanPatientName(targetPatientName),
      {
        reportId: report.id,
        filename: originalName,
        fileSize: report.file_size,
        mimeType: report.mime_type,
        hospital: hospitalName,
        category,
        issuedBy: req.user.name,
        role: isAdmin ? 'hospital_staff' : 'patient'
      },
      documentHash
    );

    report.block_index = block.index;
    await col('reports').insertOne(report);

    return res.status(201).json({
      report: {
        id: report.id,
        userId: String(report.user_id),
        patientName: report.patient_name,
        patientEmail: report.patient_email,
        hospitalName: report.hospital_name,
        original_name: report.original_name,
        mime_type: report.mime_type,
        file_size: report.file_size,
        category: report.category,
        documentHash: report.document_hash,
        blockIndex: report.block_index,
        shared_with_hospital: report.shared_with_hospital ? 1 : 0,
        status: report.status
      }
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    next(err);
  }
};

router.post('/', requireAuth, reportUpload.single('report'), asyncRoute(handleReportUpload));
router.post('/upload', requireAuth, reportUpload.single('report'), asyncRoute(handleReportUpload));

router.get('/:id/download', requireAuth, asyncRoute(async (req, res) => {
  const reportId = idFrom(req.params.id);
  const report = await col('reports').findOne({ id: reportId });
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const isOwner = report.user_id === req.user.id
    || String(report.user_id) === String(req.user.id)
    || (req.user._id && String(report.user_id) === String(req.user._id))
    || (req.user.email && report.patient_email && report.patient_email.toLowerCase() === req.user.email.toLowerCase());

  if (req.user.role !== 'admin' && !isOwner) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const filePath = path.join(UPLOAD_DIR, report.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'The report file is no longer available on disk.' });
  }

  res.setHeader('Content-Type', report.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(report.original_name)}"`);
  return res.sendFile(filePath);
}));

router.patch('/:id/share', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts control report sharing.' });
  if (typeof req.body.shared !== 'boolean') return res.status(400).json({ error: 'Choose whether to share this report with your hospital.' });
  const result = await col('reports').updateOne(
    { id: idFrom(req.params.id), user_id: req.user.id }, { $set: { shared_with_hospital: req.body.shared } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Report not found.' });
  return res.json({ ok: true, shared_with_hospital: req.body.shared });
}));

router.post('/:id/summary', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Report summaries are available to the patient who uploaded the file.' });
  const report = await col('reports').findOne({ id: idFrom(req.params.id), user_id: req.user.id });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  if (report.mime_type !== 'application/pdf') return res.status(415).json({ error: 'The local text summary currently supports text-based PDF files only.' });
  const { sentences, pagesRead, totalPages } = await extractReportSentences(report.stored_name);
  if (!sentences.length) return res.status(422).json({ error: 'No selectable text was found. Scanned PDFs and images need OCR, which is not enabled.' });
  const stopWords = new Set('about after again against also among because before being between could does during each from further have having into more most other over same should some such than that their them then there these they this through under until very what when where which while with would your'.split(' '));
  const frequencies = new Map();
  for (const word of sentences.join(' ').toLowerCase().match(/[a-z]{3,}/g) || []) {
    if (!stopWords.has(word)) frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }
  const ranked = sentences.map((sentence, index) => {
    const words = sentence.toLowerCase().match(/[a-z]{3,}/g) || [];
    return { sentence, index, score: words.reduce((sum, word) => sum + (frequencies.get(word) || 0), 0) / Math.max(words.length, 1) };
  }).sort((a, b) => b.score - a.score).slice(0, 4).sort((a, b) => a.index - b.index);
  const lastUsedAt = nowIso();
  const usageUpdate = await col('reports').findOneAndUpdate(
    { id: report.id, user_id: req.user.id },
    { $inc: { summary_count: 1 }, $set: { summary_last_used_at: lastUsedAt } },
    { returnDocument: 'after', includeResultMetadata: false }
  );
  return res.json({
    summary: ranked.map(item => item.sentence.slice(0, 500)), pagesRead, totalPages,
    usageCount: usageUpdate.summary_count, lastUsedAt: usageUpdate.summary_last_used_at,
    method: 'local-extractive',
    notice: 'This is an automatically selected text extract, not AI diagnosis or medical advice. Confirm all details with your clinician.'
  });
}));

router.delete('/:id', requireAuth, asyncRoute(async (req, res) => {
  const report = await col('reports').findOne({ id: idFrom(req.params.id), user_id: req.user.id });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  try { fs.unlinkSync(path.join(UPLOAD_DIR, report.stored_name)); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await col('reports').deleteOne({ id: report.id, user_id: req.user.id });
  return res.json({ ok: true });
}));

module.exports = router;
