// Dashboard Views Module (Patient & Admin Dashboards)
import { state, runtime } from '../state.js';
import { cleanPatientName, apiRequest } from '../api.js';
import { escapeHtml, stat, panelHead, quick, chart, toast } from '../components/ui.js';

export function userDashboard() {
  const pendingCount = state.appointments.filter(a => a.status === 'Pending').length;
  const nextAppt = state.appointments.find(a => a.status === 'Confirmed' || a.status === 'Pending');

  return `
  <div class="welcome-card">
    <div class="welcome-badge">PATIENT HEALTH PORTAL</div>
    <h1>Welcome, ${escapeHtml(cleanPatientName(state.name))}</h1>
    <p>Secure digital health records protected by CareSphere SHA-256 Ledger. Active hospital: <strong>${escapeHtml(state.hospitalName)}</strong>.</p>
    <div class="welcome-actions">
      <button class="btn btn-outline" onclick="go('blockchain')">Inspect Vault ⛓️</button>
      <button class="btn btn-primary" onclick="bookAppointment()">📅 Book appointment</button>
      <button class="btn btn-outline" onclick="logout()" title="Sign out of your account" style="color:#b0382d;border-color:#f7b8b2">↪ Sign out</button>
    </div>
  </div>

  <div class="stats-grid">
    ${stat('Active Hospital', state.hospitalName, '🏥', '<span>Primary facility</span>')}
    ${stat('Booked Visits', String(state.appointments.length), '📅', `<span>${pendingCount} pending confirmation</span>`)}
    ${stat('Medical Records', String(runtime.apiReports.length), '📄', '<span>Sha-256 sealed documents</span>')}
    ${stat('Blockchain Ledger', `#${runtime.apiBlocks.length ? runtime.apiBlocks[runtime.apiBlocks.length - 1].index : 0}`, '⛓️', '<span>Audited on MongoDB</span>')}
  </div>

  <div class="quick-grid">
    ${quick('📅', 'Book Doctor Visit', 'Schedule with specialist at your facility', "bookAppointment()")}
    ${quick('📑', 'Medical Document Vault', 'View clinical records & lab tests', "go('records')")}
    ${quick('🌸', 'Women\'s Health & PCOS', 'Cycle calendar, symptom logs & advice', "go('womens-health')")}
    ${quick('💊', 'Prescriptions', 'View active prescriptions from doctor', "go('prescriptions')")}
    ${quick('💳', 'Billing & Payments', 'Inspect demo invoices and payments', "go('billing')")}
    ${quick('🛡️', 'Audit Trail', 'Verify cryptographic blockchain integrity', "go('blockchain')")}
  </div>

  <div class="two-col">
    <div class="panel">
      ${panelHead('Upcoming appointment', 'Latest booked consultation', `<button class="link-btn" onclick="go('appointments')">View all →</button>`)}
      ${nextAppt ? `
        <div class="appointment-card" style="border-left:4px solid var(--green);margin-top:10px">
          <div>
            <strong>${escapeHtml(nextAppt.doctorName || nextAppt.name)}</strong>
            <p>${escapeHtml(nextAppt.dept)} • ${escapeHtml(nextAppt.date)}</p>
            <small style="color:var(--muted)">🏥 ${escapeHtml(nextAppt.hospital_name || state.hospitalName)}</small>
          </div>
          <span class="status ${nextAppt.status.toLowerCase()}">${escapeHtml(nextAppt.status)}</span>
        </div>
      ` : `
        <p style="padding:16px 0;color:var(--muted);font-size:13px">No upcoming appointments scheduled.</p>
        <button class="btn btn-primary btn-sm" onclick="bookAppointment()">Book your first appointment</button>
      `}
    </div>

    <div class="panel">
      ${panelHead('Health activity trends', 'Weekly health check-ins')}
      ${chart()}
    </div>
  </div>`;
}

export function adminDashboard() {
  const pending = state.appointments.filter(a => a.status === 'Pending').length;
  const confirmed = state.appointments.filter(a => a.status === 'Confirmed').length;
  const completed = state.appointments.filter(a => a.status === 'Completed').length;

  return `
  <div class="welcome-card" style="background:linear-gradient(135deg, #0f3d2e 0%, #17543f 100%)">
    <div class="welcome-badge" style="background:rgba(255,255,255,0.18)">HOSPITAL FACILITY GOVERNANCE</div>
    <h1>${escapeHtml(state.hospitalName)}</h1>
    <p>Multi-Hospital administrative workspace. Manage clinical staff, appointments, and tamper-proof blockchain audit ledger.</p>
    <div class="welcome-actions">
      <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,0.3)" onclick="openAddDoctorModal()">➕ Add Doctor</button>
      <button class="btn btn-primary" onclick="openAdminUploadReportModal()">📄 Issue Diagnostic Report</button>
      <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,0.3)" onclick="go('blockchain')">Inspect Ledger ⛓️</button>
    </div>
  </div>

  <div class="stats-grid">
    ${stat('Assigned Facility', state.hospitalName, '🏥', '<span style="color:var(--green)">Live .env Synchronized</span>')}
    ${stat('Pending Visits', String(pending), '⏳', '<span>Awaiting confirmation</span>')}
    ${stat('Confirmed Visits', String(confirmed), '✓', '<span>Ready for consultation</span>')}
    ${stat('Clinical Staff', String(runtime.apiDoctors.length), '👨‍⚕️', `<span>${runtime.apiDoctors.filter(d => d.available).length} available</span>`)}
  </div>

  <div class="quick-grid">
    ${quick('👨‍⚕️', 'Onboard Doctor', 'Add specialist to this hospital', "openAddDoctorModal()")}
    ${quick('📄', 'Issue Medical Report', 'Upload lab tests directly for patient', "openAdminUploadReportModal()")}
    ${quick('👥', 'Patient Directory', 'Inspect all registered patient accounts', "go('patients')")}
    ${quick('⚙️', 'Facility Customization', 'Edit hospital facility name & .env config', "go('settings')")}
    ${quick('⛓️', 'Tamper Verification', 'Audit SHA-256 blockchain block chain', "go('blockchain')")}
    ${quick('📅', 'All Consultations', 'Review & confirm all appointments', "go('appointments')")}
  </div>

  <div class="panel">
    ${panelHead('Pending appointment requests', `${pending} requests require administrative action`, `<button class="link-btn" onclick="go('appointments')">View all →</button>`)}
    ${pending === 0 ? `<p style="padding:16px 0;color:var(--muted);font-size:13px">No pending appointments right now.</p>` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Patient</th><th>Doctor</th><th>Facility</th><th>Scheduled Time</th><th>Action</th></tr></thead>
          <tbody>
            ${state.appointments.filter(a => a.status === 'Pending').slice(0, 5).map(a => `
              <tr>
                <td><strong>${escapeHtml(a.patientName || a.name)}</strong><br><small>${escapeHtml(a.patientEmail || '')}</small></td>
                <td>${escapeHtml(a.doctorName || a.dept)}</td>
                <td><small>${escapeHtml(a.hospital_name || state.hospitalName)}</small></td>
                <td>${escapeHtml(a.date)}</td>
                <td>
                  <button class="link-btn" style="color:var(--green);font-weight:700" onclick="updateAppointmentStatus('${escapeHtml(a.id)}', 'Confirmed')">Confirm</button>
                  <button class="link-btn" style="color:#b0382d;margin-left:8px" onclick="updateAppointmentStatus('${escapeHtml(a.id)}', 'Cancelled')">Decline</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  </div>`;
}

export async function showNotifications() {
  try {
    const data = await apiRequest('/api/notifications');
    const items = data.notifications || [];
    if (!items.length) {
      toast('No unread notifications.');
      return;
    }
    const summary = items.slice(0, 3).map(n => `• ${n.message} (${n.detail})`).join('\n');
    alert(`Notifications (${items.length}):\n\n${summary}`);
  } catch (err) {
    toast('Notifications could not be loaded.');
  }
}

