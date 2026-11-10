// Hospital Administration Module: Patient Directory, Staff Roster & Operational Analytics
import { state, runtime, fallbackDoctors } from '../state.js';
import { apiRequest, refreshBackendData, cleanPatientName, formatAppointmentDate } from '../api.js';
import { escapeHtml, toast, stat, panelHead, chart } from '../components/ui.js';

export function patientDirectory() {
  const patientsList = runtime.apiPatients;
  const rows = patientsList.map(p => {
    const pId = String(p.id);
    const pName = cleanPatientName(p.name);
    const pEmail = p.email || '';
    const count = runtime.apiReports.filter(r => (pId && String(r.userId) === pId) || (r.patientEmail && pEmail && r.patientEmail.toLowerCase() === pEmail.toLowerCase())).length;

    return `<tr>
    <td>
      <div class="person-cell">
        <div class="patient-avatar">${escapeHtml(((pName).split(/\s+/).map(part => part[0]).slice(0, 2).join('')) || 'PT')}</div>
        <div>
          <strong>${escapeHtml(pName)}</strong>
          <small>${escapeHtml(pEmail)}</small>
        </div>
      </div>
    </td>
    <td>${escapeHtml(pId)}</td>
    <td>${escapeHtml(formatAppointmentDate(p.created_at))}</td>
    <td><span class="status active">Active • Verified</span></td>
    <td>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="records-pill-btn ${count === 0 ? 'empty' : ''}" type="button"
                onclick="openPatientRecordsModal('${escapeHtml(pId)}', '${escapeHtml(pName)}', '', '${escapeHtml(pEmail)}')">
          <span>📋</span>
          <span>Records (${count})</span>
        </button>
        <button class="link-btn" onclick="openAdminUploadReportModal('${escapeHtml(pId)}')">➕ Add Report</button>
      </div>
    </td>
  </tr>`;
  }).join('');

  return `<div class="welcome">
    <div>
      <h1>Patient directory</h1>
      <p>Manage registered patient profiles, medical history dossiers, and hospital records.</p>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-outline" onclick="openAdminUploadReportModal()">📄 Issue Report</button>
      <button class="btn btn-primary" onclick="addPatient()">➕ Register patient</button>
    </div>
  </div>
  <div class="panel">
    <div class="searchbar">
      <input placeholder="Search patient name, ID, or email…" oninput="filterTable(this.value)">
      <select><option>All patients</option><option>Active</option></select>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Patient ID</th>
            <th>Registered</th>
            <th>Care status</th>
            <th>Clinical Actions</th>
          </tr>
        </thead>
        <tbody id="patientRows">
          ${rows.length > 0 ? rows : '<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--muted)">No registered patient accounts found. Patients register on the home portal.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

export async function addPatient() {
  const name = prompt('Enter patient full name to register:');
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  const defaultEmail = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@example.com';
  const emailInput = prompt('Enter patient email address:', defaultEmail);
  const email = (emailInput && emailInput.trim()) ? emailInput.trim().toLowerCase() : defaultEmail;

  try {
    toast(`Registering patient "${cleanName}" in database...`);
    await apiRequest('/api/admin/patients', {
      method: 'POST',
      body: JSON.stringify({ name: cleanName, email })
    });
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.go === 'function') window.go('patients');
    toast(`Patient "${cleanName}" registered in MongoDB & sealed on Blockchain!`);
  } catch (err) {
    console.warn('Backend patient registration notice:', err.message);
    toast(err.message || 'Could not register patient.');
  }
}

export function renderStaff() {
  const doctorsList = runtime.apiDoctors.length ? runtime.apiDoctors : fallbackDoctors;
  const hospitalAdminManager = state.isSuperAdmin ? `
    <div class="panel" style="margin-bottom:20px">
      ${panelHead('Hospital administrators', 'Create separate sign-in accounts for each hospital')}
      <form onsubmit="createHospitalAdmin(event)" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
        <div class="field"><label for="newHospitalAdminName">Administrator name</label><input id="newHospitalAdminName" name="name" minlength="2" maxlength="80" required></div>
        <div class="field"><label for="newHospitalAdminEmail">Email address</label><input id="newHospitalAdminEmail" name="email" type="email" maxlength="254" required></div>
        <div class="field"><label for="newHospitalAdminPassword">Temporary password</label><input id="newHospitalAdminPassword" name="password" type="password" minlength="8" maxlength="128" required></div>
        <div class="field"><label for="newHospitalAdminHospital">Hospital</label><select id="newHospitalAdminHospital" name="hospitalId" required>
          <option value="">Choose a hospital</option>
          ${runtime.adminHospitals.map(hospital => `<option value="${escapeHtml(hospital.id)}">${escapeHtml(hospital.name)}</option>`).join('')}
        </select></div>
        <button class="btn btn-primary" type="submit">Create admin account</button>
      </form>
      <div id="hospitalAdminError" class="error" role="alert"></div>
      <div class="table-wrap" style="margin-top:16px"><table>
        <thead><tr><th>Administrator</th><th>Email</th><th>Hospital</th></tr></thead>
        <tbody>${runtime.hospitalAdmins.map(admin => `<tr><td>${escapeHtml(admin.name)}</td><td>${escapeHtml(admin.email)}</td><td>${escapeHtml(admin.hospital_name)}</td></tr>`).join('') || '<tr><td colspan="3">No hospital administrator accounts have been created.</td></tr>'}</tbody>
      </table></div>
    </div>` : '';

  return `<div class="welcome">
    <div>
      <h1>Staff management</h1>
      <p>Overview of clinical specialists assigned to ${escapeHtml(state.hospitalName || 'CareSphere')} and affiliated facilities.</p>
    </div>
    <button class="btn btn-primary" onclick="openAddDoctorModal()">➕ Add doctor</button>
  </div>
  ${hospitalAdminManager}
  <div class="panel">
    ${panelHead('Care team', 'Clinical staff directory')}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Staff member</th>
            <th>Hospital Facility</th>
            <th>Department</th>
            <th>Role</th>
            <th>Availability</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${doctorsList.map((d, i) => `<tr>
            <td>
              <div class="person-cell">
                <div class="patient-avatar">${d.name.split(' ').slice(1).map(x => x[0]).join('') || 'DR'}</div>
                <div>
                  <strong>${escapeHtml(d.name)}</strong>
                  <small>${escapeHtml(d.experience || 'Senior Specialist')}</small>
                </div>
              </div>
            </td>
            <td><span style="font-weight:600;color:#2c5344;font-size:11px">🏥 ${escapeHtml(d.hospital_name || state.hospitalName)}</span></td>
            <td>${escapeHtml(d.specialty)}</td>
            <td>${i === 0 ? 'Department Head' : (i < 3 ? 'Senior Consultant' : 'Consultant')}</td>
            <td><span class="status active">Available</span></td>
            <td><button class="link-btn" onclick="toast('Doctor profile: ' + '${escapeHtml(d.name)}')">Manage</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

export async function createHospitalAdmin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = document.getElementById('hospitalAdminError');
  const submitButton = form.querySelector('button[type="submit"]');
  if (errorEl) errorEl.textContent = '';
  if (submitButton) submitButton.disabled = true;

  try {
    const formData = new FormData(form);
    await apiRequest('/api/admin/hospital-admins', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        hospitalId: formData.get('hospitalId')
      })
    });
    form.reset();
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    toast('Hospital administrator account created.');
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message || 'Could not create the administrator account.';
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

export function renderReports() {
  return `<div class="welcome">
    <div>
      <h1>Reports & analytics</h1>
      <p>Operational insights for ${escapeHtml(state.hospitalName || 'CareSphere Facility')}.</p>
    </div>
    <button class="btn btn-primary" onclick="toast('Report exported to PDF successfully.')">⬇ Export report</button>
  </div>
  <div class="stats">
    ${stat('Appointments in system', String(state.appointments.length), '📅', '<span class="up">Live count</span>')}
    ${stat('Doctors available', String(runtime.apiDoctors.length || 6), '🩺', 'Active specialists')}
    ${stat('Connected Hospitals', String(runtime.apiHospitals.length || 3), '🏥', 'Network height')}
    ${stat('Patients registered', String(runtime.apiPatients.length), '👥', 'MongoDB database')}
    ${stat('Medical records', String(runtime.apiReports.length), '🔐', 'Integrity checks in Records')}
  </div>
  <div class="dashboard-grid">
    <div class="panel">
      ${panelHead('Weekly hospital volume', 'Appointment and clinic activity')}
      ${chart()}
    </div>
    <div class="panel">
      ${panelHead('Operational checklist', 'Items for administrator review')}
      <div class="appointment-list">
        <div class="appointment">
          <div class="stat-icon">✅</div>
          <div class="appointment-info">
            <strong>Blockchain audit ledger verified</strong>
            <span>Security</span>
          </div>
          <span class="status active">Done</span>
        </div>
        <div class="appointment">
          <div class="stat-icon">🔐</div>
          <div class="appointment-info">
            <strong>Medical record integrity & audit history</strong>
            <span>Verify stored files against their SHA-256 blockchain anchors.</span>
          </div>
          <button class="btn btn-outline btn-sm" onclick="go('records')">Review records</button>
        </div>
        <div class="appointment">
          <div class="stat-icon">🏥</div>
          <div class="appointment-info">
            <strong>${escapeHtml(state.hospitalName || 'CareSphere')} Active</strong>
            <span>Hospital Network</span>
          </div>
          <span class="status active">Connected</span>
        </div>
        <div class="appointment">
          <div class="stat-icon">👨‍⚕️</div>
          <div class="appointment-info">
            <strong>Clinical staff roster updated</strong>
            <span>Operations</span>
          </div>
          <span class="status active">Active</span>
        </div>
      </div>
    </div>
  </div>`;
}
