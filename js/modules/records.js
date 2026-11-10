// Health Records Module: Vault, Clinical Dossier, Modal Viewers & Cryptographic Uploads
import { state, runtime } from '../state.js';
import { apiRequest, refreshBackendData, cleanPatientName, formatAppointmentDate } from '../api.js';
import { escapeHtml, toast, panelHead } from '../components/ui.js';

export function openPatientRecordsModal(patientId, patientName, appointmentId = '', patientEmail = '') {
  const overlay = document.getElementById('patientRecordsModalOverlay');
  if (!overlay) return;

  const targetName = cleanPatientName(patientName || 'Patient');
  let targetEmail = patientEmail || '';
  if (!targetEmail && patientId) {
    const foundPatient = runtime.apiPatients.find(p => String(p.id) === String(patientId));
    if (foundPatient && foundPatient.email) targetEmail = foundPatient.email;
  }
  if (!targetEmail && appointmentId) {
    const foundAppt = state.appointments.find(a => String(a.id) === String(appointmentId));
    if (foundAppt && foundAppt.patientEmail) targetEmail = foundAppt.patientEmail;
  }

  const titleEl = document.getElementById('patientRecordsTitle');
  if (titleEl) titleEl.textContent = `Clinical Records: ${targetName}`;
  const subEl = document.getElementById('patientRecordsSubtitle');
  if (subEl) subEl.textContent = `Cross-hospital health dossier & blockchain-verified lab documents for ${targetName}.`;
  const pIdInput = document.getElementById('modalTargetPatientId');
  if (pIdInput) pIdInput.value = patientId || '';
  const emailInput = document.getElementById('modalTargetPatientEmail');
  if (emailInput) emailInput.value = targetEmail || '';
  const apptInput = document.getElementById('modalTargetAppointmentId');
  if (apptInput) apptInput.value = appointmentId || '';
  const errEl = document.getElementById('modalReportUploadError');
  if (errEl) errEl.textContent = '';
  const fileEl = document.getElementById('modalReportFile');
  if (fileEl) fileEl.value = '';

  renderPatientRecordsModalContent(patientId, targetName, targetEmail);

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

export function closePatientRecordsModal() {
  const overlay = document.getElementById('patientRecordsModalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

export function renderPatientRecordsModalContent(patientId, patientName, patientEmail = '') {
  const patientReports = runtime.apiReports.filter(r => {
    if (patientId && String(r.userId) === String(patientId)) return true;
    if (patientEmail && r.patientEmail && r.patientEmail.toLowerCase() === patientEmail.toLowerCase()) return true;
    return false;
  });
  const count = patientReports.length;
  const countBadge = document.getElementById('patientRecordsCountBadge');
  if (countBadge) {
    countBadge.textContent = `${count} Document${count === 1 ? '' : 's'}`;
    countBadge.className = count > 0 ? 'status active' : 'status pending';
  }

  const latestCard = document.getElementById('patientRecordsLatestCard');
  const recordsList = document.getElementById('patientRecordsList');

  if (count === 0) {
    if (latestCard) {
      latestCard.innerHTML = `<div class="record-spotlight none">
        <div style="font-size:22px;margin-bottom:6px">📁</div>
        <strong>No clinical records recorded yet for ${escapeHtml(patientName)}</strong>
        <p style="margin:4px 0 0;font-size:11px">Use the upload box below to issue lab results, consultation notes, or prescriptions to this patient's vault.</p>
      </div>`;
    }
    if (recordsList) {
      recordsList.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);font-size:11px">No historical records available. All future reports issued across connected hospitals will appear here.</div>`;
    }
    return;
  }

  // Spotlight: Latest Report
  const latest = patientReports[0];
  const isHospitalSource = latest.uploadedByRole === 'admin' || latest.uploadedByRole === 'hospital';
  const sourceLabel = isHospitalSource ? `🏥 Issued by ${latest.hospitalName || 'CareSphere Facility'}` : `👤 Uploaded by Patient`;

  if (latestCard) {
    latestCard.innerHTML = `<div class="record-spotlight">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:26px">📄</div>
        <div>
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
            <span style="font-size:10px;font-weight:800;background:#13866b;color:#fff;padding:2px 7px;border-radius:6px;text-transform:uppercase">🔥 LATEST REPORT</span>
            <span style="font-size:11px;font-weight:700;color:#2c5344">${escapeHtml(latest.category || 'Diagnostic Report')}</span>
          </div>
          <strong style="font-size:13px;display:block;color:var(--ink)">${escapeHtml(latest.original_name)}</strong>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">
            <span style="font-weight:600;color:#184a38">${escapeHtml(sourceLabel)}</span> • ${(latest.file_size / 1024).toFixed(1)} KB • Sealed ${escapeHtml(formatAppointmentDate(latest.created_at))}
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="status completed" style="font-size:10px">⛓️ Block #${latest.blockIndex}</span>
        <a href="/api/reports/${encodeURIComponent(latest.id)}/download" target="_blank" class="btn btn-primary btn-sm" style="text-decoration:none;font-size:11px;padding:6px 12px">
          ⬇ View / Download
        </a>
      </div>
    </div>`;
  }

  // All Historical Reports
  if (recordsList) {
    recordsList.innerHTML = patientReports.map(r => {
      const isHosp = r.uploadedByRole === 'admin' || r.uploadedByRole === 'hospital';
      const label = isHosp ? `🏥 ${r.hospitalName || 'Hospital'}` : `👤 Patient Self-Upload`;
      return `<div class="record-item-card">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div style="font-size:18px">📄</div>
          <div style="min-width:0">
            <strong style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${escapeHtml(r.original_name)}</strong>
            <div style="font-size:10.5px;color:var(--muted);margin-top:2px">
              <span style="font-weight:600;color:#2a5745">${escapeHtml(label)}</span> • ${escapeHtml(r.category || 'Clinical Record')} • ${escapeHtml(formatAppointmentDate(r.created_at))}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span class="status completed" style="font-size:9.5px" onclick="go('blockchain')" title="SHA-256 fingerprint verified">⛓️ Block #${r.blockIndex}</span>
          <a href="/api/reports/${encodeURIComponent(r.id)}/download" target="_blank" class="btn btn-outline btn-sm" style="text-decoration:none;font-size:11px;padding:4px 9px">
            ⬇ Download
          </a>
        </div>
      </div>`;
    }).join('');
  }
}

export async function submitPatientModalReport(event) {
  event.preventDefault();
  const fileInput = document.getElementById('modalReportFile');
  const patientId = document.getElementById('modalTargetPatientId')?.value;
  const patientEmail = document.getElementById('modalTargetPatientEmail') ? document.getElementById('modalTargetPatientEmail').value : '';
  const apptId = document.getElementById('modalTargetAppointmentId') ? document.getElementById('modalTargetAppointmentId').value : '';
  const category = document.getElementById('modalReportCategory')?.value || 'Diagnostic Report';
  const errorEl = document.getElementById('modalReportUploadError');
  const submitBtn = document.getElementById('modalReportUploadSubmit');

  if (!fileInput.files || !fileInput.files[0]) {
    if (errorEl) errorEl.textContent = 'Please choose a document file to seal.';
    return;
  }
  if (!patientId && !apptId && !patientEmail) {
    if (errorEl) errorEl.textContent = 'Target patient identifier missing.';
    return;
  }

  if (errorEl) errorEl.textContent = '';
  if (submitBtn) submitBtn.disabled = true;

  const formData = new FormData();
  formData.append('report', fileInput.files[0]);
  if (patientId) formData.append('patientId', patientId);
  if (apptId) formData.append('appointmentId', apptId);
  if (patientEmail) formData.append('patientEmail', patientEmail);
  formData.append('category', category);
  formData.append('hospitalName', state.hospitalName || 'CareSphere Central Hospital');

  try {
    toast(`Sealing ${fileInput.files[0].name} on blockchain for patient...`);
    const res = await fetch('/api/reports/upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to upload report');

    fileInput.value = '';
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    const currentTitle = document.getElementById('patientRecordsTitle')?.textContent?.replace('Clinical Records: ', '') || '';
    renderPatientRecordsModalContent(patientId, currentTitle, patientEmail);
    toast(`Report sealed on Blockchain (Block #${result.report?.blockIndex || 'N'}) and visible to patient & all hospitals!`);
  } catch (err) {
    console.error('Modal report upload error:', err.message);
    if (errorEl) errorEl.textContent = err.message || 'Could not upload report.';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

export function openAdminUploadReportModal(preselectPatientId = '') {
  const overlay = document.getElementById('adminUploadReportModalOverlay');
  if (!overlay) return;

  const select = document.getElementById('adminReportPatientSelect');
  if (select) {
    select.innerHTML = '<option value="">Choose a registered patient</option>' + runtime.apiPatients.map(p =>
      `<option value="${escapeHtml(p.id)}">${escapeHtml(cleanPatientName(p.name))} (${escapeHtml(p.email)})</option>`
    ).join('');

    if (preselectPatientId) {
      select.value = String(preselectPatientId);
    }
  }

  const hospEl = document.getElementById('adminReportHospital');
  if (hospEl) hospEl.value = state.hospitalName || 'CareSphere Central Hospital';
  const fileEl = document.getElementById('adminReportFileInput');
  if (fileEl) fileEl.value = '';
  const errEl = document.getElementById('adminReportUploadError');
  if (errEl) errEl.textContent = '';

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

export function closeAdminUploadReportModal() {
  const overlay = document.getElementById('adminUploadReportModalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

export async function submitAdminStandaloneReport(event) {
  event.preventDefault();
  const fileInput = document.getElementById('adminReportFileInput');
  const patientSelect = document.getElementById('adminReportPatientSelect');
  const categorySelect = document.getElementById('adminReportCategory');
  const errorEl = document.getElementById('adminReportUploadError');
  const submitBtn = document.getElementById('adminReportUploadSubmit');

  const patientId = patientSelect?.value;
  const category = categorySelect?.value || 'Diagnostic Report';

  if (!patientId) {
    if (errorEl) errorEl.textContent = 'Please choose a patient for this report.';
    return;
  }
  if (!fileInput.files || !fileInput.files[0]) {
    if (errorEl) errorEl.textContent = 'Please select a document file to upload.';
    return;
  }

  if (errorEl) errorEl.textContent = '';
  if (submitBtn) submitBtn.disabled = true;

  const formData = new FormData();
  formData.append('report', fileInput.files[0]);
  formData.append('patientId', patientId);
  formData.append('category', category);
  formData.append('hospitalName', state.hospitalName || 'CareSphere Central Hospital');

  try {
    toast(`Fingerprinting & sealing ${fileInput.files[0].name} on blockchain...`);
    const res = await fetch('/api/reports/upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to upload report');

    closeAdminUploadReportModal();
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.go === 'function') window.go('records');
    toast(`Medical report sealed on Blockchain (Block #${result.report?.blockIndex || 'N'}) and available to patient!`);
  } catch (err) {
    console.error('Admin report upload error:', err.message);
    if (errorEl) errorEl.textContent = err.message || 'Could not upload report.';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

export async function uploadReportFile(event) {
  const input = event.target;
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  const formData = new FormData();
  formData.append('report', file);
  formData.append('category', 'Patient Health Record');

  try {
    toast(`Calculating SHA-256 fingerprint & sealing ${file.name}...`);
    const response = await fetch('/api/reports/upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to upload report');

    toast(`Document sealed on Blockchain (Block #${result.report.blockIndex})!`);
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.go === 'function') window.go('records');
  } catch (err) {
    console.error('Patient report upload error:', err.message);
    toast(err.message || 'Could not upload document.');
  } finally {
    input.value = '';
  }
}

export function renderRecords() {
  const isAdmin = state.role === 'admin';
  const reportsList = runtime.apiReports;

  const uploadedRows = reportsList.map(r => {
    const isHosp = r.uploadedByRole === 'admin' || r.uploadedByRole === 'hospital';
    const sourceHtml = isHosp
      ? `<span style="font-weight:700;color:#184a38;font-size:11px">🏥 Issued by ${escapeHtml(r.hospitalName || 'CareSphere Hospital')}</span>`
      : `<span style="font-weight:600;color:#4f7062;font-size:11px">👤 ${isAdmin ? `${escapeHtml(cleanPatientName(r.patientName))} (Self)` : 'Uploaded by You'}</span>`;

    return `<tr>
      <td>
        <div class="person-cell">
          <div class="patient-avatar" style="background:#eaf5ef;color:var(--green)">📄</div>
          <div>
            <strong>${escapeHtml(r.original_name)}</strong>
            <small>${escapeHtml((r.file_size / 1024).toFixed(1))} KB • ${escapeHtml(r.mime_type)}</small>
          </div>
        </div>
      </td>
      ${isAdmin ? `<td>
        <div class="person-cell">
          <div class="patient-avatar" style="width:28px;height:28px;font-size:10px">${escapeHtml((cleanPatientName(r.patientName)).slice(0, 2).toUpperCase())}</div>
          <div>
            <strong style="font-size:12px">${escapeHtml(cleanPatientName(r.patientName))}</strong>
            <small>${escapeHtml(r.patientEmail || '')}</small>
          </div>
        </div>
      </td>` : ''}
      <td>${sourceHtml}</td>
      <td><span style="font-weight:600;font-size:11px">${escapeHtml(r.category || 'Diagnostic Report')}</span></td>
      <td>${escapeHtml(formatAppointmentDate(r.created_at))}</td>
      <td>
        <span class="status completed" style="font-size:9.5px;cursor:pointer" onclick="go('blockchain')" title="SHA-256 fingerprint verified">
          ⛓️ Block #${r.blockIndex}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:6px;align-items:center">
          <a href="/api/reports/${encodeURIComponent(r.id)}/download" target="_blank" class="btn btn-outline btn-sm" style="text-decoration:none;font-size:11px;padding:4px 9px">
            ⬇ View
          </a>
          ${isAdmin ? `<button class="link-btn" onclick="openPatientRecordsModal('${escapeHtml(r.userId)}', '${escapeHtml(cleanPatientName(r.patientName))}')">History</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  const emptyRow = `<tr><td colspan="${isAdmin ? 7 : 6}" style="text-align:center;padding:36px;color:var(--muted)">
    <div style="font-size:26px;margin-bottom:8px">📄</div>
    <strong>No medical documents sealed yet</strong>
    <p style="font-size:11px;margin-top:4px">${isAdmin ? 'Click "➕ Issue Report to Patient" above to issue the first diagnostic lab record.' : 'Click "⬆️ Upload & Seal Document" above to store and fingerprint your personal health records on the blockchain.'}</p>
  </td></tr>`;

  return `<div class="welcome">
    <div>
      <h1>${isAdmin ? 'Hospital Clinical Records & Diagnostic Vault' : 'My Health Records'}</h1>
      <p>${isAdmin ? 'Centralized cross-hospital medical dossier. Issue diagnostic lab files to patients and review past clinical records across all healthcare facilities.' : 'Access all diagnostic reports and visit documents issued by hospital facilities and uploaded by yourself, secured by Blockchain.'}</p>
    </div>
    <div>
      ${isAdmin ? `
        <button class="btn btn-primary" onclick="openAdminUploadReportModal()">➕ Issue Report to Patient</button>
      ` : `
        <input type="file" id="reportFileInput" accept=".pdf,.png,.jpg,.jpeg" style="display:none" onchange="uploadReportFile(event)">
        <button class="btn btn-primary" onclick="document.getElementById('reportFileInput').click()">⬆️ Upload & Seal Document</button>
      `}
    </div>
  </div>
  <div class="notice">
    <strong>Blockchain Security Assurance:</strong> All medical documents are fingerprinted with SHA-256 cryptographic signatures and sealed into the CareSphere block chain. Reports issued by any hospital are visible to both patient and authorized clinical staff across hospitals.
  </div>
  <div class="panel">
    ${panelHead('Cryptographically Sealed Records', 'Visit summaries, laboratory files & diagnostic documents')}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Document</th>
            ${isAdmin ? '<th>Patient</th>' : ''}
            <th>Issuing Source</th>
            <th>Category</th>
            <th>Sealed Date</th>
            <th>Blockchain Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${uploadedRows.length > 0 ? uploadedRows : emptyRow}
        </tbody>
      </table>
    </div>
  </div>`;
}
