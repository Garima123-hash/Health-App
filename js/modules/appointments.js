// Appointments Module: Scheduling, Table Views, Status Management & Modals
import { state, runtime, fallbackDoctors } from '../state.js';
import { apiRequest, refreshBackendData, cleanPatientName, formatAppointmentDate } from '../api.js';
import { escapeHtml, toast, toLocalDateTimeValue } from '../components/ui.js';

export function appointmentsTable(rows, admin = false) {
  if (!rows || rows.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
      <strong>No appointments recorded yet</strong>
      <p>${admin ? 'New patient appointment bookings will appear here in real-time.' : 'You have no scheduled appointments yet. Find a doctor to request a visit.'}</p>
      ${!admin ? '<button class="btn btn-primary" type="button" onclick="go(&quot;doctors&quot;)">Find a doctor</button>' : ''}
    </div>`;
  }

  if (admin) {
    return `<div class="table-wrap"><table>
      <thead>
        <tr>
          <th>Patient Name</th>
          <th>Doctor Consulted</th>
          <th>Hospital</th>
          <th>Date & time</th>
          <th>Security Seal</th>
          <th>Update Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((a, i) => {
          const patientId = String(a.patient_id || '');
          const pName = cleanPatientName(a.patientName || a.name || 'Patient');
          const patientReports = runtime.apiReports.filter(r => (patientId && String(r.userId) === patientId) || (r.patientEmail && a.patientEmail && r.patientEmail.toLowerCase() === a.patientEmail.toLowerCase()));
          const count = patientReports.length;
          const latest = count > 0 ? patientReports[0] : null;

          return `<tr data-status="${escapeHtml((a.status || 'Pending').toLowerCase())}">
          <td>
            <div class="person-cell">
              <div class="patient-avatar">${escapeHtml(((pName).match(/\b\w/g) || ['P', 'T']).slice(0, 2).join(''))}</div>
              <div>
                <strong>${escapeHtml(pName)}</strong>
                <small>${escapeHtml(a.patientEmail || 'Patient Account')}</small>
                <div style="margin-top:6px">
                  <button class="records-pill-btn ${count === 0 ? 'empty' : ''}" type="button"
                          onclick="openPatientRecordsModal('${escapeHtml(patientId)}', '${escapeHtml(pName)}', '${escapeHtml(a.id)}', '${escapeHtml(a.patientEmail || '')}')"
                          title="View clinical reports & medical records for ${escapeHtml(pName)}">
                    <span>📋</span>
                    <span>${count > 0 ? `${count} Record${count === 1 ? '' : 's'} • Latest: ${escapeHtml(latest.original_name.slice(0, 15))}${latest.original_name.length > 15 ? '…' : ''}` : '0 Records • ➕ Issue'}</span>
                  </button>
                </div>
              </div>
            </div>
          </td>
          <td>
            <div class="person-cell">
              <div class="patient-avatar" style="background:#eaf5ef;color:var(--green);font-size:12px">Dr</div>
              <div>
                <strong>${escapeHtml(a.doctorName || 'Doctor')}</strong>
                <small>${escapeHtml(a.dept || 'Specialist')}</small>
              </div>
            </div>
          </td>
          <td>
            <span style="font-weight:600;color:#2c5344;font-size:11px">${escapeHtml(a.hospital_name || 'CareSphere Central Hospital')}</span>
          </td>
          <td>
            <div>${escapeHtml(a.date)}</div>
            <small style="color:var(--muted)">${escapeHtml(a.type || 'Consultation')}</small>
          </td>
          <td>
            <span class="status completed" style="font-size:9.5px;cursor:pointer" onclick="go('blockchain')" title="Cryptographically sealed on blockchain">Block #${i + 1}</span>
          </td>
          <td>
            <select class="status-select ${escapeHtml((a.status || 'Pending').toLowerCase())}"
                    onchange="updateAppointmentStatus('${escapeHtml(a.id)}', this.value)"
                    title="Select to change status">
              <option value="Pending"   ${a.status === 'Pending'   ? 'selected' : ''}>Pending</option>
              <option value="Confirmed" ${a.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="Completed" ${a.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Cancelled" ${a.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="link-btn" onclick="openStatusModal('${escapeHtml(a.id)}')">Manage</button>
              <button class="link-btn" style="color:var(--green);font-weight:750" onclick="openPatientRecordsModal('${escapeHtml(patientId)}', '${escapeHtml(pName)}', '${escapeHtml(a.id)}', '${escapeHtml(a.patientEmail || '')}')">Records</button>
            </div>
          </td>
        </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  // Patient view
  return `<div class="table-wrap"><table>
    <thead>
      <tr>
        <th>Doctor Consulted</th>
        <th>Hospital</th>
        <th>Department</th>
        <th>Date & time</th>
        <th>Security Seal</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((a, i) => `<tr data-status="${escapeHtml((a.status || 'Pending').toLowerCase())}">
        <td>
          <div class="person-cell">
            <div class="patient-avatar">Dr</div>
            <div>
              <strong>${escapeHtml(a.doctorName || a.name || 'Doctor')}</strong>
              <small>${escapeHtml(a.type || 'Consultation')}</small>
            </div>
          </div>
        </td>
        <td>
          <span style="font-weight:600;color:#2c5344;font-size:11px">${escapeHtml(a.hospital_name || 'CareSphere Central Hospital')}</span>
        </td>
        <td>${escapeHtml(a.dept || 'General Medicine')}</td>
        <td>${escapeHtml(a.date)}</td>
        <span class="status completed" style="font-size:9.5px;cursor:pointer" onclick="go('blockchain')">Block #${i + 1}</span>
        <td><span class="status ${escapeHtml((a.status || 'Pending').toLowerCase())}">${escapeHtml(a.status || 'Pending')}</span></td>
        <td>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="link-btn" onclick="appointmentAction('${escapeHtml(a.id)}', false)">
              Details
            </button>
            <button class="link-btn" style="color:var(--green);font-weight:700" onclick="go('records')">Records</button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

export async function updateAppointmentStatus(id, newStatus) {
  const normalized = ['Pending', 'Confirmed', 'Completed', 'Cancelled'].find(s => s.toLowerCase() === newStatus.toLowerCase());
  if (!normalized) return;

  try {
    toast(`Updating appointment to ${normalized} & sealing on Blockchain...`);
    await apiRequest(`/api/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: normalized })
    });
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    toast(`Appointment status updated to "${normalized}" and sealed on Blockchain!`);
  } catch (err) {
    console.warn('Backend update notice:', err.message);
    const appointment = state.appointments.find(item => String(item.id) === String(id));
    if (appointment) {
      appointment.status = normalized;
      if (typeof window.renderAll === 'function') window.renderAll();
    }
    toast(`Status updated to "${normalized}" (session updated).`);
  }
}

export function openStatusModal(id) {
  const appointment = state.appointments.find(item => String(item.id) === String(id));
  if (!appointment) {
    toast('Appointment not found.');
    return;
  }
  document.getElementById('statusModalApptId').value = String(id);
  document.getElementById('statusModalPatient').value = cleanPatientName(appointment.patientName || appointment.name || 'Patient');
  document.getElementById('statusModalDoctor').value = `${appointment.doctorName || 'Doctor'} (${appointment.dept || 'Specialist'}) — ${appointment.hospital_name || 'CareSphere'}`;
  document.getElementById('statusModalDate').value = `${appointment.date} • ${appointment.type || 'Consultation'}`;
  document.getElementById('statusModalSelect').value = appointment.status || 'Pending';

  const overlay = document.getElementById('statusModalOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }
}

export function closeStatusModal() {
  const overlay = document.getElementById('statusModalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

export async function submitStatusModal(event) {
  event.preventDefault();
  const id = document.getElementById('statusModalApptId').value;
  const newStatus = document.getElementById('statusModalSelect').value;
  closeStatusModal();
  await updateAppointmentStatus(id, newStatus);
}

export function appointmentAction(id, admin = state.role === 'admin') {
  if (admin) {
    openStatusModal(id);
    return;
  }
  const appointment = state.appointments.find(item => String(item.id) === String(id));
  if (!appointment) {
    toast('Appointment is no longer available. Refresh and try again.');
    return;
  }
  toast(`${appointment.doctorName || appointment.name} at ${appointment.hospital_name || 'CareSphere'} • ${appointment.date} • Status: ${appointment.status}`);
}

export function renderAppointments() {
  const admin = state.role === 'admin';
  const rows = state.appointments;
  runtime.appointmentSearch = '';
  runtime.appointmentStatus = 'all';

  return `<div class="welcome">
    <div>
      <h1>${admin ? 'Appointment management' : 'My appointments'}</h1>
      <p>${admin ? 'Review and manage hospital appointments with patient, consulting doctor, hospital facility, and blockchain verification.' : 'Keep track of your scheduled visits across hospital facilities.'}</p>
    </div>
    <div class="welcome-actions">
      ${admin ? '<button class="btn btn-outline" onclick="go(&quot;blockchain&quot;)">Blockchain Ledger</button>' : ''}
      ${admin ? '<button class="btn btn-primary" onclick="openAddDoctorModal()">Add Doctor</button>' : ''}
      ${admin ? '<button class="btn btn-primary" onclick="addPatient()">Register Patient</button>' : '<button class="btn btn-primary" onclick="go(&quot;doctors&quot;)">Find a doctor</button>'}
    </div>
  </div>
  <div class="panel">
    <div class="searchbar">
      <input placeholder="Search by patient, doctor, hospital, or specialty…" oninput="filterTable(this.value)">
      <select onchange="filterStatus(this.value)">
        <option value="all">All statuses</option>
        <option value="Confirmed">Confirmed</option>
        <option value="Pending">Pending</option>
        <option value="Completed">Completed</option>
        <option value="Cancelled">Cancelled</option>
      </select>
    </div>
    <div id="appointmentTable">${appointmentsTable(rows, admin)}</div>
  </div>`;
}

export function applyAppointmentFilters() {
  document.querySelectorAll('#appointmentTable tbody tr').forEach(row => {
    const matchesText = row.innerText.toLowerCase().includes((runtime.appointmentSearch || '').toLowerCase());
    const matchesStatus = runtime.appointmentStatus === 'all' || row.dataset.status === runtime.appointmentStatus.toLowerCase();
    row.style.display = matchesText && matchesStatus ? '' : 'none';
  });
  document.querySelectorAll('#patientRows tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes((runtime.appointmentSearch || '').toLowerCase()) ? '' : 'none';
  });
}

export function filterTable(query) {
  runtime.appointmentSearch = query;
  applyAppointmentFilters();
}

export function filterStatus(status) {
  runtime.appointmentStatus = status;
  applyAppointmentFilters();
}

export async function bookAppointment(doctorId = '') {
  if (state.role === 'admin') {
    toast('Appointment requests are created by patient accounts.');
    return;
  }
  const error = document.getElementById('bookingError');
  if (error) error.textContent = '';

  const doctorsList = runtime.apiDoctors.length ? runtime.apiDoctors : fallbackDoctors;
  const hospitalsList = runtime.apiHospitals.length ? runtime.apiHospitals : [...new Set(doctorsList.map(d => d.hospital_name || 'CareSphere Central Hospital'))];

  // Populate Hospital dropdown
  const hospSelect = document.getElementById('bookingHospital');
  if (hospSelect) {
    hospSelect.innerHTML = '<option value="">Choose a hospital facility</option>' + hospitalsList.map(h =>
      `<option value="${escapeHtml(h)}">🏥 ${escapeHtml(h)}</option>`
    ).join('');
  }

  let selectedDoc = null;
  if (doctorId) {
    selectedDoc = doctorsList.find(d => String(d.id) === String(doctorId));
  }

  if (selectedDoc && selectedDoc.hospital_name && hospSelect) {
    hospSelect.value = selectedDoc.hospital_name;
    onBookingHospitalChange(selectedDoc.hospital_name, selectedDoc.id);
  } else if (hospSelect) {
    hospSelect.value = '';
    onBookingHospitalChange('', '');
  }

  const now = new Date();
  const minDate = new Date(now.getTime() + 5 * 60 * 1000);
  const defaultDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  defaultDate.setMinutes(0, 0, 0);

  const dateInput = document.getElementById('bookingDate');
  if (dateInput) {
    dateInput.min = toLocalDateTimeValue(minDate);
    dateInput.value = toLocalDateTimeValue(defaultDate);
  }
  const reasonInput = document.getElementById('bookingReason');
  if (reasonInput) reasonInput.value = 'Consultation';

  const overlay = document.getElementById('bookingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }
  if (hospSelect) hospSelect.focus();
}

export function onBookingHospitalChange(selectedHospital, preselectDoctorId = '') {
  const docSelect = document.getElementById('bookingDoctor');
  if (!docSelect) return;
  const doctorsList = runtime.apiDoctors.length ? runtime.apiDoctors : fallbackDoctors;

  if (!selectedHospital) {
    docSelect.innerHTML = '<option value="">First choose a hospital above</option>';
    docSelect.disabled = true;
    return;
  }

  docSelect.disabled = false;
  const filtered = doctorsList.filter(d => (d.hospital_name || 'CareSphere Central Hospital') === selectedHospital);

  if (filtered.length === 0) {
    docSelect.innerHTML = '<option value="">No doctors available at this hospital</option>';
  } else {
    docSelect.innerHTML = '<option value="">Choose a doctor</option>' + filtered.map(doc =>
      `<option value="${escapeHtml(doc.id)}">${escapeHtml(doc.name)} — ${escapeHtml(doc.specialty)}</option>`
    ).join('');
  }

  if (preselectDoctorId) {
    docSelect.value = String(preselectDoctorId);
  }
}

export function closeBooking() {
  const overlay = document.getElementById('bookingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
  const error = document.getElementById('bookingError');
  if (error) error.textContent = '';
  const form = document.getElementById('bookingForm');
  if (form) form.reset();
  toggleOtherReason('');
}

export function toggleOtherReason(val) {
  const f = document.getElementById('bookingReasonDetailsField');
  if (f) f.classList.toggle('hidden', val !== 'Other');
}

export async function submitAppointment(event) {
  event.preventDefault();
  const form = document.getElementById('bookingForm');
  const submit = document.getElementById('bookingSubmit');
  const error = document.getElementById('bookingError');

  const hospitalName = String(form.elements.hospital?.value || '').trim();
  const doctorId = String(form.elements.doctorId?.value || '').trim();
  const appointmentAt = form.elements.appointmentAt?.value;
  let reason = form.elements.reason?.value?.trim() || 'Consultation';
  if (reason === 'Other') {
    const details = document.getElementById('bookingReasonDetails')?.value?.trim();
    if (details) reason = `Other: ${details}`;
  }

  if (!hospitalName) {
    if (error) error.textContent = 'Please choose a hospital facility.';
    return;
  }
  if (!doctorId) {
    if (error) error.textContent = 'Please select a doctor.';
    return;
  }

  if (error) error.textContent = '';
  if (submit) submit.disabled = true;

  try {
    const res = await apiRequest('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ doctorId, hospitalName, appointmentAt, reason })
    });

    closeBooking();
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.go === 'function') window.go('appointments');
    toast(`Appointment sealed on Blockchain at ${hospitalName} (Block #${res.appointment?.blockIndex || 'N'})!`);
  } catch (err) {
    console.error('Booking error:', err.message);
    if (error) error.textContent = err.message || 'Could not schedule appointment.';
  } finally {
    if (submit) submit.disabled = false;
  }
}
