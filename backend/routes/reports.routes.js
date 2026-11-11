'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('node:fs');
const path = require('node:path');
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
const {
  classifyIntegrityStatus,
  hashAuditEvent,
  hashFile,
  medicalRecordLedger
} = require('../services/medical-record-ledger.service');
const { extractReportSentencesFromBuffer } = require('../services/pdf.service');
const { uploadReportFile, downloadReportFile, deleteReportFile } = require('../services/report-storage.service');
const { ReportSummaryError, summarizeReportText } = require('../services/report-summary.service');

const router = express.Router();

const reportSummaryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false
});

async function getReportBuffer(report) {
  if (report.storage_provider === 'supabase' && report.storage_path) {
    return downloadReportFile(report.storage_path);
  }
  if (report.stored_name) {
    const legacyPath = path.join(UPLOAD_DIR, report.stored_name);
    if (fs.existsSync(legacyPath)) return fs.readFileSync(legacyPath);
  }
  return null;
}

async function reportFilterForHospital(user) {
  if (user.is_super_admin) return {};
  const patients = await col('users').find(
    { role: 'patient', hospital_id: user.hospital_id },
    { projection: { _id: 1, id: 1, email: 1 } }
  ).toArray();
  const patientIds = patients.flatMap(patient => [
    patient.id,
    String(patient.id),
    ...(patient._id ? [String(patient._id)] : [])
  ]);
  const conditions = [];
  if (patientIds.length) conditions.push({ user_id: { $in: patientIds } });
  const emails = patients.map(patient => patient.email?.toLowerCase()).filter(Boolean);
  if (emails.length) conditions.push({ patient_email: { $in: emails } });
  return conditions.length ? { $or: conditions } : { _id: { $exists: false } };
}

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
    if (!targetUser || (isAdmin && !req.user.is_super_admin && targetUser.hospital_id !== req.user.hospital_id)) {
      return res.status(404).json({ error: 'Patient not found.' });
    }
    const orCond = [{ user_id: pId }, { user_id: String(pId) }];
    if (targetUser?.email) orCond.push({ patient_email: targetUser.email.toLowerCase() });
    if (targetUser?._id) orCond.push({ user_id: String(targetUser._id) });
    filter = { $or: orCond };
  } else if (isAdmin) {
    filter = await reportFilterForHospital(req.user);
  }

  filter.deleted_at = { $exists: false };
  const reports = await col('reports').find(filter).sort({ created_at: -1 }).toArray();
  const audits = reports.length
    ? await col('medical_record_audits').aggregate([
      { $match: { report_id: { $in: reports.map(report => report.id) } } },
      { $sort: { created_at: -1 } },
      { $group: {
        _id: '$report_id',
        events: { $push: {
          event_type: '$event_type',
          status: '$status',
          actor_role: '$actor_role',
          block_index: '$block_index',
          provider: '$provider',
          created_at: '$created_at'
        } }
      } },
      { $project: { events: { $slice: ['$events', 20] } } }
    ]).toArray()
    : [];
  const auditsByReport = new Map(audits.map(item => [String(item._id), item.events]));
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
        integrityStatus: auditsByReport.get(String(r.id))?.[0]?.status || 'sealed',
        integrityCheckedAt: auditsByReport.get(String(r.id))?.[0]?.event_type === 'verification'
          ? auditsByReport.get(String(r.id))[0].created_at
          : null,
        auditHistory: auditsByReport.get(String(r.id)) || [],
        shared_with_hospital: r.shared_with_hospital ? 1 : 0,
        created_at: r.created_at
      };
    })
  });
}));

router.get('/admin', requireAdmin, asyncRoute(async (req, res) => {
  const filter = await reportFilterForHospital(req.user);
  filter.deleted_at = { $exists: false };
  const reports = await col('reports').find(filter).sort({ created_at: -1 }).toArray();
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

  let storagePath;
  let storageUploaded = false;
  try {
    const fileBuffer = req.file.buffer;
    const documentHash = hashFile(fileBuffer);

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
        if (!req.user.is_super_admin && patient.hospital_id !== req.user.hospital_id) {
          return res.status(403).json({ error: 'You can only upload reports for patients at your hospital.' });
        }
        targetUserId = patient.id;
        targetPatientName = patient.name;
        targetPatientEmail = patient.email;
      } else if (apptId) {
        const appt = await col('appointments').findOne({ id: apptId });
        if (appt) {
          if (!req.user.is_super_admin && appt.hospital_id !== req.user.hospital_id) {
            return res.status(403).json({ error: 'You can only upload reports for appointments at your hospital.' });
          }
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
          if (!req.user.is_super_admin && patient.hospital_id !== req.user.hospital_id) {
            return res.status(403).json({ error: 'You can only upload reports for patients at your hospital.' });
          }
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
    storagePath = `${String(targetUserId)}/${require('node:crypto').randomUUID()}${path.extname(originalName).toLowerCase()}`;
    await uploadReportFile(storagePath, fileBuffer, req.file.mimetype);
    storageUploaded = true;
    const report = {
      id: await db.nextId('reports'),
      user_id: targetUserId,
      patient_name: cleanPatientName(targetPatientName),
      patient_email: targetPatientEmail,
      hospital_name: hospitalName,
      uploaded_by_role: isAdmin ? 'hospital' : 'patient',
      uploaded_by_name: req.user.name,
      original_name: originalName,
      storage_provider: 'supabase',
      storage_path: storagePath,
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

    const block = await medicalRecordLedger.anchorRecord(documentHash);

    report.block_index = block.index;
    await col('reports').insertOne(report);
    await col('medical_record_audits').insertOne({
      id: await db.nextId('medical_record_audits'),
      report_id: report.id,
      user_id: report.user_id,
      event_type: 'sealed',
      status: 'sealed',
      actor_role: isAdmin ? 'admin' : 'patient',
      block_index: block.index,
      provider: medicalRecordLedger.provider,
      created_at: report.created_at
    });

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
    if (storagePath && storageUploaded) {
      try { await deleteReportFile(storagePath); } catch (cleanupError) {
        console.error('Supabase upload cleanup failed:', cleanupError.message);
      }
    }
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

  const fileBuffer = await getReportBuffer(report);
  if (!fileBuffer) return res.status(404).json({ error: 'The report file is no longer available. Please upload it again.' });

  res.setHeader('Content-Type', report.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(report.original_name)}"`);
  return res.send(fileBuffer);
}));

router.post('/:id/verify', requireAuth, asyncRoute(async (req, res) => {
  const reportId = idFrom(req.params.id);
  const report = await col('reports').findOne({ id: reportId });
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const isOwner = String(report.user_id) === String(req.user.id)
    || (req.user.email && report.patient_email && report.patient_email.toLowerCase() === req.user.email.toLowerCase());
  if (req.user.role !== 'admin' && !isOwner) return res.status(403).json({ error: 'Access denied.' });

  const fileBuffer = await getReportBuffer(report);
  const fileExists = Boolean(fileBuffer);
  const ledgerResult = await medicalRecordLedger.verifyRecordAnchor(report);
  const fileMatches = fileExists && hashFile(fileBuffer) === report.document_hash;
  const status = classifyIntegrityStatus({
    fileExists,
    fileMatches,
    anchorStatus: ledgerResult.status
  });
  const verified = status === 'verified' && fileMatches;
  const createdAt = nowIso();
  const actorRole = req.user.role === 'admin' ? 'admin' : 'patient';
  const auditHash = hashAuditEvent({
    reportId: report.id,
    status,
    actorRole,
    createdAt,
    documentHash: report.document_hash || ''
  });
  const db = getDb();
  let verificationBlock = null;
  if (ledgerResult.chainValid) {
    verificationBlock = await medicalRecordLedger.anchorVerification(status, auditHash);
  }
  await col('medical_record_audits').insertOne({
    id: await db.nextId('medical_record_audits'),
    report_id: report.id,
    user_id: report.user_id,
    event_type: 'verification',
    status,
    actor_role: actorRole,
    audit_hash: auditHash,
    block_index: verificationBlock?.index ?? null,
    provider: medicalRecordLedger.provider,
    created_at: createdAt
  });

  const auditHistory = await col('medical_record_audits').find(
    { report_id: report.id, user_id: report.user_id },
    { projection: { _id: 0, event_type: 1, status: 1, actor_role: 1, block_index: 1, provider: 1, created_at: 1 } }
  ).sort({ created_at: -1 }).limit(50).toArray();
  return res.json({
    reportId: String(report.id),
    status,
    verified,
    fileMatches,
    anchorMatches: ledgerResult.anchorMatches,
    chainValid: ledgerResult.chainValid,
    provider: medicalRecordLedger.provider,
    verifiedAt: createdAt,
    auditHistory
  });
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

router.post('/:id/summary', requireAuth, reportSummaryLimiter, asyncRoute(async (req, res) => {
  // Frontend patient sessions use the role "user"; older backend records may use "patient".
  if (!['patient', 'user'].includes(String(req.user.role || '').toLowerCase())) {
    return res.status(403).json({ error: 'Explain Simply is available to patient accounts only.' });
  }

  const reportId = idFrom(req.params.id);
  const ownerConditions = [{ user_id: req.user.id }, { user_id: String(req.user.id) }];
  if (req.user._id) ownerConditions.push({ user_id: String(req.user._id) });
  if (req.user.email) ownerConditions.push({ patient_email: req.user.email.toLowerCase() });
  const report = await col('reports').findOne({
    id: reportId,
    deleted_at: { $exists: false },
    $or: ownerConditions
  });
  if (!report) return res.status(404).json({ error: 'Report not found or you do not have access to it.' });
  if (report.mime_type !== 'application/pdf') return res.status(415).json({ error: 'AI explanations currently support PDF reports only.' });

  let fileBuffer;
  try {
    fileBuffer = await getReportBuffer(report);
  } catch (error) {
    console.error('Report download from Supabase failed:', error.message);
    return res.status(error.status || 502).json({ error: 'Could not retrieve this PDF from Supabase Storage. Check the backend Supabase URL, secret key, and bucket permissions.' });
  }
  if (!fileBuffer) return res.status(404).json({ error: 'This PDF is missing from storage. Please upload it again.' });

  let extracted;
  try {
    extracted = await extractReportSentencesFromBuffer(fileBuffer);
  } catch (error) {
    console.error('PDF text extraction failed:', error.message);
    return res.status(422).json({ error: 'The PDF could not be read. Please upload a valid, non-password-protected PDF.' });
  }
  const { sentences, pagesRead, totalPages } = extracted;
  if (!sentences.length) return res.status(422).json({ error: 'No selectable text was found. This appears to be a scanned PDF; OCR is not enabled yet.' });

  let explanation;
  try {
    explanation = await summarizeReportText(sentences.join('\n'), undefined, [
      report.patient_name, report.patient_email, req.user.name, req.user.email
    ]);
  } catch (error) {
    if (error instanceof ReportSummaryError) return res.status(error.status).json({ error: error.message });
    console.error('Report AI analysis failed:', error.message);
    return res.status(503).json({ error: 'The report was read, but AI analysis failed. Check the Groq API key, model, and report reference library in Render.' });
  }

  const lastUsedAt = nowIso();
  const usageFilter = { id: report.id, deleted_at: { $exists: false }, $or: ownerConditions };
  const usageUpdate = await col('reports').findOneAndUpdate(
    usageFilter,
    { $inc: { summary_count: 1 }, $set: { summary_last_used_at: lastUsedAt } },
    { returnDocument: 'after', includeResultMetadata: false }
  );
  return res.json({
    ...explanation, pagesRead, totalPages,
    usageCount: usageUpdate?.summary_count ?? ((report.summary_count || 0) + 1),
    lastUsedAt,
    notice: 'AI-generated explanation uses report-matched local references and may be incomplete or inaccurate. It is not a diagnosis or medical advice. Ask your clinician to interpret the report.'
  });
}));

router.delete('/:id', requireAuth, asyncRoute(async (req, res) => {
  const report = await col('reports').findOne({
    id: idFrom(req.params.id),
    deleted_at: { $exists: false }
  });
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const isAdmin = req.user.role === 'admin';
  const isOwner = String(report.user_id) === String(req.user.id)
    || (req.user.email && report.patient_email
      && report.patient_email.toLowerCase() === req.user.email.toLowerCase());

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'You can only delete your own medical reports.' });
  }

  if (isAdmin && !req.user.is_super_admin) {
    const patient = await col('users').findOne({
      $or: [
        { id: report.user_id },
        { id: Number(report.user_id) },
        ...(report.patient_email ? [{ email: report.patient_email.toLowerCase() }] : [])
      ]
    });
    if (!patient || String(patient.hospital_id) !== String(req.user.hospital_id)) {
      return res.status(403).json({ error: 'You can only delete reports belonging to patients at your hospital.' });
    }
  }

  // Remove the file, but retain report metadata and audit history.
  if (report.storage_provider === 'supabase' && report.storage_path) {
    await deleteReportFile(report.storage_path);
  } else if (report.stored_name) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, report.stored_name)); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  const deletedAt = nowIso();
  const actorRole = isAdmin ? 'admin' : 'patient';
  const auditHash = hashAuditEvent({
    reportId: report.id,
    status: 'deleted',
    actorRole,
    createdAt: deletedAt,
    documentHash: report.document_hash || ''
  });
  await col('reports').updateOne(
    { id: report.id, deleted_at: { $exists: false } },
    { $set: { deleted_at: deletedAt, deleted_by_role: actorRole, deleted_by_user_id: req.user.id } }
  );
  await col('medical_record_audits').insertOne({
    id: await getDb().nextId('medical_record_audits'),
    report_id: report.id,
    user_id: report.user_id,
    event_type: 'deleted',
    status: 'deleted',
    actor_role: actorRole,
    audit_hash: auditHash,
    provider: medicalRecordLedger.provider,
    created_at: deletedAt
  });
  return res.json({ ok: true, deletedAt, message: 'Report deleted. Audit history has been retained.' });
}));

module.exports = router;
