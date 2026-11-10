// Dashboard Views Module (Patient & Admin Dashboards)
import { state, runtime } from '../state.js';
import { cleanPatientName, apiRequest } from '../api.js';
import { escapeHtml, stat, panelHead, quick, chart, toast } from '../components/ui.js';

export function userDashboard() {
  const pendingCount = state.appointments.filter(a => a.status === 'Pending').length;
  const nextAppt = state.appointments.find(a => a.status === 'Confirmed' || a.status === 'Pending');
  const isFemale = state.gender === 'female';

  return `
  <div class="welcome-card">
    <div class="welcome-card-left">
      <div class="welcome-badge">${isFemale ? 'Personalized Women’s Health Portal' : 'Patient Health Portal'}</div>
      <h1>Welcome, ${escapeHtml(cleanPatientName(state.name))}</h1>
      <p>${isFemale ? 'Your secure care space includes private women’s wellness tools alongside your appointments and health records.' : 'Your secure digital health portal, powered by CareSphere SHA-256 Ledger.'} Active hospital: <strong style="color:rgba(255,255,255,.92)">${escapeHtml(state.hospitalName)}</strong></p>
      <div class="welcome-actions">
        <button class="btn btn-primary" onclick="bookAppointment()">Book Appointment</button>
        <button class="btn btn-outline" onclick="go('blockchain')">Record protection</button>
      </div>
    </div>
  </div>

  <div class="stats-grid">
    ${stat('Active Hospital', state.hospitalName, 'hospital', '<span>Primary facility</span>')}
    ${stat('Booked Visits', String(state.appointments.length), 'calendar', `<span>${pendingCount} pending confirmation</span>`)}
    ${stat('Medical Records', String(runtime.apiReports.length), 'document', '<span>SHA-256 sealed documents</span>')}
    ${stat('Blockchain Blocks', `${runtime.apiBlocks.length ? '#' + runtime.apiBlocks[runtime.apiBlocks.length - 1].index : '—'}`, 'chain', '<span>Audited on MongoDB</span>')}
  </div>

  ${isFemale ? `<div class="female-dashboard-card">
    <div><span class="female-dashboard-kicker">🌷 Your wellness space</span><h2>Women’s Health & Wellness</h2><p>Private cycle and mood tracking with educational resources. Your wellness data stays in your patient account.</p></div>
    <button class="btn btn-primary" onclick="go('womens-health')">Open wellness dashboard</button>
  </div>` : ''}

  <div class="quick-grid">
    ${quick('calendar', 'Book a Visit', 'Schedule with a specialist at your hospital', "bookAppointment()")}
    ${quick('document', 'Medical Vault', 'View clinical records and lab tests', "go('records')")}
    ${isFemale ? quick('health', "Women's Health", 'Cycle tracker, symptom logs and advice', "go('womens-health')") : ''}
    ${quick('pill', 'Prescriptions', 'View prescriptions from your doctor', "go('prescriptions')")}
    ${quick('billing', 'Billing', 'View invoices and payment history', "go('billing')")}
    ${quick('chain', 'Audit Trail', 'Verify cryptographic blockchain integrity', "go('blockchain')")}
  </div>

  <div class="two-col">
    <div class="panel">
      ${panelHead('Upcoming appointment', 'Latest booked consultation', `<button class="link-btn" onclick="go('appointments')">View all →</button>`)}
      ${nextAppt ? `
        <div class="appointment-card">
          <div>
            <strong>${escapeHtml(nextAppt.doctorName || nextAppt.name)}</strong>
            <p>${escapeHtml(nextAppt.dept)} · ${escapeHtml(nextAppt.date)}</p>
            <small>${escapeHtml(nextAppt.hospital_name || state.hospitalName)}</small>
          </div>
          <span class="status ${nextAppt.status.toLowerCase()}">${escapeHtml(nextAppt.status)}</span>
        </div>
      ` : `
        <p style="padding:16px 0;color:var(--muted);font-size:13px">No upcoming appointments scheduled.</p>
        <button class="btn btn-primary btn-sm" onclick="bookAppointment()">Book your first appointment</button>
      `}
    </div>

    <div class="panel">
      ${panelHead('Activity trends', 'Weekly health check-ins')}
      ${chart()}
    </div>
  </div>`;
}

export function adminDashboard() {
  const pending   = state.appointments.filter(a => a.status === 'Pending').length;
  const confirmed = state.appointments.filter(a => a.status === 'Confirmed').length;

  return `
  <div class="welcome-card" style="background:linear-gradient(130deg, #082f24 0%, #0a3d2d 55%, #0d4c38 100%)">
    <div class="welcome-card-left">
      <div class="welcome-badge">Hospital Administration</div>
      <h1>${escapeHtml(state.hospitalName)}</h1>
      <p>Multi-hospital administrative workspace. Manage clinical staff, appointments, and the tamper-proof blockchain audit ledger.</p>
      <div class="welcome-actions">
        <button class="btn btn-primary" onclick="openAdminUploadReportModal()">Issue Report</button>
        <button class="btn btn-outline" onclick="openAddDoctorModal()">Add Doctor</button>
        <button class="btn btn-outline" onclick="go('blockchain')" style="border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.7)">Inspect Ledger</button>
      </div>
    </div>
  </div>

  <div class="stats-grid">
    ${stat('Assigned Facility', state.hospitalName, 'hospital', '<span style="color:var(--green)">Live sync active</span>')}
    ${stat('Pending Visits', String(pending), 'calendar', '<span>Awaiting confirmation</span>')}
    ${stat('Confirmed Visits', String(confirmed), 'check', '<span>Ready for consultation</span>')}
    ${stat('Clinical Staff', String(runtime.apiDoctors.length), 'staff', `<span>${runtime.apiDoctors.filter(d => d.available).length} available today</span>`)}
  </div>

  <div class="quick-grid">
    ${quick('staff', 'Onboard Doctor', 'Add a specialist to this hospital', "openAddDoctorModal()")}
    ${quick('document', 'Issue Report', 'Upload lab results for a patient', "openAdminUploadReportModal()")}
    ${quick('users', 'Patient Directory', 'View all registered patient accounts', "go('patients')")}
    ${quick('settings', 'Facility Settings', 'Edit hospital name and config', "go('settings')")}
    ${quick('chain', 'Tamper Check', 'Audit the SHA-256 blockchain ledger', "go('blockchain')")}
    ${quick('calendar', 'All Consultations', 'Review and confirm all appointments', "go('appointments')")}
  </div>

  <div class="panel">
    ${panelHead('Pending appointment requests', `${pending} requests require action`, `<button class="link-btn" onclick="go('appointments')">View all →</button>`)}
    ${pending === 0
      ? `<p style="padding:16px 0;color:var(--muted);font-size:13px">No pending appointments right now.</p>`
      : `<div class="table-wrap">
          <table>
            <thead><tr><th>Patient</th><th>Doctor</th><th>Facility</th><th>Scheduled</th><th>Action</th></tr></thead>
            <tbody>
              ${state.appointments.filter(a => a.status === 'Pending').slice(0, 5).map(a => `
                <tr>
                  <td><strong>${escapeHtml(a.patientName || a.name)}</strong><br><small>${escapeHtml(a.patientEmail || '')}</small></td>
                  <td>${escapeHtml(a.doctorName || a.dept)}</td>
                  <td><small>${escapeHtml(a.hospital_name || state.hospitalName)}</small></td>
                  <td>${escapeHtml(a.date)}</td>
                  <td>
                    <button class="link-btn" style="color:var(--green);font-weight:700" onclick="updateAppointmentStatus('${escapeHtml(a.id)}', 'Confirmed')">Confirm</button>
                    <button class="link-btn" style="color:var(--danger);margin-left:8px" onclick="updateAppointmentStatus('${escapeHtml(a.id)}', 'Cancelled')">Decline</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
  </div>`;
}

export async function showNotifications() {
  try {
    const data = await apiRequest('/api/notifications');
    const items = data.notifications || [];
    if (!items.length) { toast('No unread notifications.'); return; }
    const summary = items.slice(0, 3).map(n => `• ${n.message} (${n.detail})`).join('\n');
    alert(`Notifications (${items.length}):\n\n${summary}`);
  } catch (err) {
    toast('Notifications could not be loaded.');
  }
}
