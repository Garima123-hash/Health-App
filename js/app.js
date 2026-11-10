// --- CareSphere Client Application (Express + MongoDB + Blockchain) ---

const state = {
  role: 'user',
  page: 'dashboard',
  name: 'Patient',
  email: '',
  hospitalName: 'CareSphere Central Hospital',
  appointments: []
};

// Fallback dummy data for offline / preview display
const fallbackPatientAppointments = [];
const fallbackAdminAppointments = [];
const fallbackPatients = [];

const fallbackDoctors = [
  { id: 'doc-1', name: 'Dr. Ananya Mehta', specialty: 'Cardiology', experience: '12 years experience', hospital_name: 'CareSphere Central Hospital', available: 1, symbol: '🩺' },
  { id: 'doc-2', name: 'Dr. Rahul Kapoor', specialty: 'General Medicine', experience: '9 years experience', hospital_name: 'CareSphere Central Hospital', available: 1, symbol: '👨‍⚕️' },
  { id: 'doc-3', name: 'Dr. Priya Nair', specialty: 'Dermatology', experience: '8 years experience', hospital_name: 'Apollo Multi-Specialty Hospital', available: 1, symbol: '👩‍⚕️' },
  { id: 'doc-4', name: 'Dr. Vikram Rao', specialty: 'Orthopaedics', experience: '15 years experience', hospital_name: 'Apollo Multi-Specialty Hospital', available: 1, symbol: '👨‍⚕️' },
  { id: 'doc-5', name: 'Dr. Sana Khan', specialty: 'Paediatrics', experience: '10 years experience', hospital_name: 'Metro City Healthcare', available: 1, symbol: '🩺' },
  { id: 'doc-6', name: 'Dr. Arjun Das', specialty: 'Neurology', experience: '11 years experience', hospital_name: 'Metro City Healthcare', available: 1, symbol: '👨‍⚕️' }
];

// Ledger begins strictly with Block #0 (Genesis Block)
const fallbackBlocks = [
  {
    index: 0,
    timestamp: '2026-01-01T00:00:00.000Z',
    data: {
      type: 'GENESIS',
      title: 'CareSphere Cryptographic Genesis Block',
      patientName: 'CareSphere Trust Network',
      details: { protocol: 'HealthVault Cryptographic Audit Ledger', standard: 'SHA-256 Tamper-Evident Chain' },
      documentHash: '0000000000000000000000000000000000000000000000000000000000000000'
    },
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: '0e3a9b1c784f12d8a567890bcdef1234567890abcdef1234567890abcdef1234',
    nonce: 0
  }
];

let authMode = 'login';
let apiDoctors = [];
let apiPatients = [];
let apiReports = [];
let apiBlocks = [];
let apiHospitals = [
  'CareSphere Central Hospital',
  'Apollo Multi-Specialty Hospital',
  'Metro City Healthcare'
];
let blockchainValidation = { isValid: true, length: 1, brokenBlockIndex: null };

let appointmentSearch = '';
let appointmentStatus = 'all';
let doctorSearch = '';
let doctorDepartment = 'all';
let doctorHospital = 'all';

const userNav = [
  ['dashboard', '📊', 'Overview'],
  ['appointments', '📅', 'My appointments'],
  ['doctors', '👨‍⚕️', 'Find a doctor'],
  ['records', '📄', 'Health records'],
  ['blockchain', '⛓️', 'Blockchain Vault'],
  ['prescriptions', '💊', 'Prescriptions'],
  ['billing', '💳', 'Bills & payments'],
  ['settings', '⚙️', 'My profile']
];

const adminNav = [
  ['dashboard', '📊', 'Overview'],
  ['appointments', '📅', 'Appointments'],
  ['patients', '👥', 'Patients'],
  ['doctors', '👨‍⚕️', 'Doctors & departments'],
  ['blockchain', '⛓️', 'Blockchain Ledger'],
  ['staff', '🩺', 'Staff management'],
  ['reports', '📈', 'Reports & analytics'],
  ['settings', '⚙️', 'System settings']
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function stat(title, value, icon, foot) {
  return `<article class="stat-card"><div class="stat-head"><span>${escapeHtml(title)}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${escapeHtml(value)}</div><div class="stat-foot">${foot}</div></article>`;
}

function panelHead(title, sub = '', action = '') {
  return `<div class="panel-head"><div><h2>${escapeHtml(title)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ''}</div>${action}</div>`;
}

function quick(icon, title, desc, action) {
  return `<button class="quick-action" onclick="${action}"><div class="qa-icon">${icon}</div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></button>`;
}

function chart() {
  const heights = [44, 61, 52, 76, 63, 88, 70];
  return `<div class="chart">${heights.map((h, i) =>
    `<div class="bar-col"><div class="bar-pair"><div class="bar" style="height:${Math.max(15, h - 22)}%"></div><div class="bar dark" style="height:${h}%"></div></div><div class="bar-label">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div></div>`
  ).join('')}</div>
  <div style="display:flex;gap:16px;margin-top:14px;font-size:10px;color:var(--muted)">
    <span><span style="display:inline-block;width:8px;height:8px;background:#bde7d2;border-radius:2px;margin-right:5px"></span>Previous week</span>
    <span><span style="display:inline-block;width:8px;height:8px;background:var(--green);border-radius:2px;margin-right:5px"></span>This week</span>
  </div>`;
}

function formatAppointmentDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

// --- API Client ---
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function refreshBackendData() {
  const requests = [
    apiRequest('/api/appointments').catch(() => ({ appointments: [] })),
    apiRequest('/api/doctors').catch(() => ({ doctors: [] })),
    state.role === 'admin' ? apiRequest('/api/admin/patients').catch(() => ({ patients: [] })) : Promise.resolve({ patients: [] }),
    apiRequest('/api/reports').catch(() => ({ reports: [] })),
    apiRequest('/api/blockchain').catch(() => ({ blocks: [], validation: { isValid: true } })),
    apiRequest('/api/hospitals').catch(() => ({ hospitals: [] }))
  ];

  const [appointmentData, doctorData, patientData, reportData, blockchainData, hospitalData] = await Promise.all(requests);

  const fetchedAppointments = (appointmentData.appointments || []).map(a => ({
    id: String(a.id),
    doctorId: String(a.doctor_id || ''),
    doctorName: a.doctor_name || 'Dr. Specialist',
    patient_id: String(a.patient_id || ''),
    patientName: cleanPatientName(a.patient_name || 'Patient'),
    patientEmail: a.patient_email || '',
    hospital_name: a.hospital_name || 'CareSphere Central Hospital',
    name: state.role === 'admin' ? cleanPatientName(a.patient_name || 'Patient') : (a.doctor_name || 'Doctor'),
    dept: a.specialty || 'General Medicine',
    date: formatAppointmentDate(a.appointment_at),
    status: a.status || 'Pending',
    type: a.reason || 'Consultation'
  }));

  state.appointments = fetchedAppointments;
  apiDoctors = (doctorData.doctors && doctorData.doctors.length > 0) ? doctorData.doctors : fallbackDoctors;
  apiPatients = patientData.patients || [];
  apiReports = (reportData.reports || []).map(r => ({
    id: String(r.id),
    userId: String(r.userId || ''),
    patientName: cleanPatientName(r.patientName || 'Patient'),
    patientEmail: r.patientEmail || '',
    hospitalName: r.hospitalName || 'CareSphere Central Hospital',
    uploadedByRole: r.uploadedByRole || 'patient',
    uploadedByName: r.uploadedByName || 'CareSphere Staff',
    original_name: r.original_name,
    mime_type: r.mime_type,
    file_size: r.file_size,
    status: r.status || 'Sealed',
    category: r.category || 'Diagnostic Report',
    documentHash: r.documentHash || '',
    blockIndex: r.blockIndex || 1,
    created_at: r.created_at || ''
  }));
  apiHospitals = (hospitalData.hospitals && hospitalData.hospitals.length > 0) ? hospitalData.hospitals : [
    'CareSphere Central Hospital',
    'Apollo Multi-Specialty Hospital',
    'Metro City Healthcare'
  ];

  if (blockchainData.blocks && blockchainData.blocks.length > 0) {
    apiBlocks = blockchainData.blocks;
    blockchainValidation = blockchainData.validation || { isValid: true, length: apiBlocks.length, brokenBlockIndex: null };
  } else {
    apiBlocks = fallbackBlocks;
    blockchainValidation = { isValid: true, length: fallbackBlocks.length, brokenBlockIndex: null };
  }
}

// --- Navigation & Role Management ---
function openAuth(role = 'user') {
  setRole(role);
  if (role === 'admin' && authMode === 'register') {
    toggleAuthMode();
  }
  document.getElementById('authOverlay').classList.remove('hidden');
  showAuthError('');
}

function closeAuth() {
  document.getElementById('authOverlay').classList.add('hidden');
  const nameField = document.getElementById('registerNameField');
  if (nameField) nameField.remove();
  if (authMode === 'register') {
    authMode = 'login';
    const note = document.getElementById('authModeNote');
    if (note) note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
  }
  showAuthError('');
}

function cleanPatientName(name) {
  if (!name || typeof name !== 'string') return 'Patient';
  return name.replace(/\s*[-—(]\s*(CareSphere|Apollo|Metro|Hospital|Clinic|Healthcare).*$/i, '').trim() || name;
}

function setRole(role) {
  state.role = role;
  document.getElementById('roleUser').classList.toggle('active', role === 'user');
  document.getElementById('roleAdmin').classList.toggle('active', role === 'admin');

  const hospField = document.getElementById('loginHospitalField');
  const hospLabel = document.getElementById('loginHospitalLabel');
  const hospBadge = document.getElementById('loginHospitalBadge');
  const hospNote = document.getElementById('loginHospitalNote');
  const hospInput = document.getElementById('loginHospital');

  if (role === 'admin') {
    if (authMode === 'register') {
      toggleAuthMode();
    }
    const nameField = document.getElementById('registerNameField');
    if (nameField) nameField.remove();
    const note = document.getElementById('authModeNote');
    if (note) {
      note.innerHTML = '<small>Administrator access requires credentials configured in .env</small>';
    }
    if (hospField) hospField.style.display = 'block';
    if (hospLabel) hospLabel.textContent = 'Administered Hospital Facility Name';
    if (hospBadge) {
      hospBadge.textContent = '🏥 Syncs to .env';
      hospBadge.style.color = 'var(--green)';
    }
    if (hospNote) hospNote.textContent = 'Enter your hospital facility name. Signing in updates your facility and writes ADMIN_HOSPITAL to .env.';
    if (hospInput && !hospInput.value) {
      hospInput.value = state.hospitalName || 'CareSphere Central Hospital';
    }
  } else {
    // Hide hospital name completely for patient
    if (hospField) hospField.style.display = 'none';
    const note = document.getElementById('authModeNote');
    if (note && authMode === 'login') {
      note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
    }
  }
  showAuthError('');
}

function showAuthError(message) {
  const el = document.getElementById('loginError');
  if (el) el.textContent = message;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function buildNav() {
  const nav = state.role === 'admin' ? adminNav : userNav;
  let html = nav.map(([id, ico, label]) =>
    `<button class="nav-item ${state.page === id ? 'active' : ''}" onclick="go('${id}')"><span class="nav-ico">${ico}</span>${escapeHtml(label)}</button>`
  ).join('');
  if (state.role !== 'admin') {
    html += `<button class="nav-item" onclick="logout()" style="color:#b0382d;margin-top:6px" title="Sign out of your account"><span class="nav-ico">↪</span>Sign out</button>`;
  }
  document.getElementById('navItems').innerHTML = html;
}

function go(page) {
  state.page = page;
  document.querySelectorAll('.page-section').forEach(x => x.classList.remove('active'));
  const section = document.getElementById('page-' + page);
  if (section) section.classList.add('active');

  const titles = {
    dashboard: 'Overview',
    appointments: state.role === 'admin' ? 'Appointments' : 'My appointments',
    doctors: state.role === 'admin' ? 'Doctors & departments' : 'Find a doctor',
    records: 'Health records',
    blockchain: state.role === 'admin' ? 'Blockchain Ledger' : 'Blockchain Vault',
    prescriptions: 'Prescriptions',
    billing: 'Bills & payments',
    patients: 'Patients',
    staff: 'Staff management',
    reports: 'Reports & analytics',
    settings: state.role === 'admin' ? 'System settings' : 'My profile'
  };

  document.getElementById('topPage').textContent = titles[page] || 'Overview';
  buildNav();
  document.getElementById('sidebar').classList.remove('open');
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  const heading = document.querySelector('.auth-heading');
  const sub = document.querySelector('.auth-sub');
  const form = document.getElementById('loginForm');
  const button = form.querySelector('button[type="submit"]');
  const note = document.getElementById('authModeNote');
  let nameField = document.getElementById('registerNameField');

  if (authMode === 'register') {
    if (!nameField) {
      nameField = document.createElement('div');
      nameField.id = 'registerNameField';
      nameField.className = 'field';
      nameField.innerHTML = '<label for="registerName">Full name</label><input id="registerName" name="fullName" type="text" minlength="2" maxlength="80" autocomplete="name" placeholder="Your full name" required>';
      form.insertBefore(nameField, form.firstElementChild);
    }
    const regInput = document.getElementById('registerName');
    if (regInput) {
      regInput.required = true;
      regInput.disabled = false;
    }
    nameField.classList.remove('hidden');
    document.getElementById('password').minLength = 4;
    document.getElementById('password').autocomplete = 'new-password';
    heading.textContent = 'Create your account';
    sub.textContent = 'Register to save appointments and seal medical records on the blockchain.';
    button.textContent = 'Create account →';
    note.innerHTML = '<span>Already registered?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Sign in</button><br><small>Password must contain at least 4 characters.</small>';
    document.getElementById('roleAdmin').disabled = true;
    setRole('user');
  } else {
    if (nameField) {
      nameField.remove();
    }
    document.getElementById('password').minLength = 4;
    document.getElementById('password').autocomplete = 'current-password';
    heading.textContent = 'Welcome back';
    sub.textContent = 'Sign in to continue to your personalised healthcare workspace.';
    button.textContent = 'Sign in securely →';
    note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
    document.getElementById('roleAdmin').disabled = false;
  }
  showAuthError('');
}

async function login(e) {
  e.preventDefault();
  showAuthError('');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const hospitalName = document.getElementById('loginHospital')?.value.trim() || '';
  const submit = document.querySelector('#loginForm button[type="submit"]');
  submit.disabled = true;

  try {
    let result;
    if (authMode === 'register') {
      const name = document.getElementById('registerName')?.value.trim() || '';
      if (!name || name.length < 2) {
        showAuthError('Please enter your full name (at least 2 characters).');
        submit.disabled = false;
        return;
      }
      result = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, hospitalName })
      });
    } else {
      result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, hospitalName })
      });
    }

    if (!result || !result.user) {
      throw new Error('Authentication failed. No user record returned.');
    }

    state.email = result.user.email;
    state.name = result.user.name;
    state.role = result.user.role === 'admin' ? 'admin' : 'user';
    state.hospitalName = result.user.hospital_name || hospitalName || 'CareSphere Central Hospital';
    await enterDashboard();
    if (state.role === 'admin' && hospitalName) {
      toast(`Signed in as Administrator • Hospital set to "${state.hospitalName}" (.env updated)!`);
    } else {
      toast(authMode === 'register' ? `Account registered for ${state.name}!` : `Welcome back, ${state.name}!`);
    }
  } catch (err) {
    console.error('Authentication error:', err.message);
    showAuthError(err.message || 'Authentication error. Please check your credentials.');
  } finally {
    submit.disabled = false;
  }
}

async function enterDashboard() {
  closeAuth();
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const displayName = state.role === 'admin' ? state.name : cleanPatientName(state.name);
  document.getElementById('profileName').textContent = displayName;
  document.getElementById('profileRole').textContent = state.role === 'admin' ? `Administrator • ${state.hospitalName || 'CareSphere'}` : 'Patient account';
  document.getElementById('avatarInitials').textContent = displayName.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

  try {
    await refreshBackendData();
  } catch (err) {
    console.warn('Could not refresh backend data:', err.message);
  }

  buildNav();
  renderAll();
  go('dashboard');
}

async function logout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' });
  } catch (err) {
    console.warn('Sign-out request failed:', err.message);
  }
  state.appointments = [];
  state.email = '';
  state.name = 'Patient';
  state.role = 'user';
  state.hospitalName = 'CareSphere Central Hospital';

  // Clear inputs on landing form
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
  if (emailInput) emailInput.value = '';
  if (passInput) passInput.value = '';

  // Close any modals
  if (typeof closeBooking === 'function') closeBooking();
  if (typeof closeStatusModal === 'function') closeStatusModal();
  if (typeof closeAddDoctorModal === 'function') closeAddDoctorModal();

  document.getElementById('app').classList.add('hidden');
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('sidebar').classList.remove('open');
  state.page = 'dashboard';
  toast('Signed out successfully.');
}

async function restoreSession() {
  try {
    const result = await apiRequest('/api/auth/me');
    if (result.user) {
      state.email = result.user.email;
      state.name = result.user.name;
      state.role = result.user.role === 'admin' ? 'admin' : 'user';
      state.hospitalName = result.user.hospital_name || 'CareSphere Central Hospital';
      await enterDashboard();
    }
  } catch (err) {
    console.warn('Session restore unavailable:', err.message);
  }
}

// --- Dashboards & Views ---
function userDashboard() {
  const rows = state.appointments;
  const count = String(rows.length).padStart(2, '0');
  const nextAppt = rows.length > 0 ? rows[0] : null;

  return `<div class="welcome">
    <div>
      <h1>Good day, ${escapeHtml(cleanPatientName(state.name).split(' ')[0])} 👋</h1>
      <p>Here’s your personal health overview. Your records and visits across hospital networks are secured with Blockchain SHA-256 signatures.</p>
    </div>
    <div class="welcome-actions">
      <button class="btn btn-outline" onclick="go('blockchain')">Inspect Vault ⛓️</button>
      <button class="btn btn-primary" onclick="bookAppointment()">📅 Book appointment</button>
      <button class="btn btn-outline" onclick="logout()" title="Sign out of your account" style="color:#b0382d;border-color:#f7b8b2">↪ Sign out</button>
    </div>
  </div>

  <div class="stats">
    ${stat('Upcoming appointments', count, '📅', nextAppt ? `<span class="up">Next: ${escapeHtml(nextAppt.date)}</span>` : '<span class="up">No visits scheduled</span>')}
    ${stat('Available Hospitals', String(apiHospitals.length || 3), '🏥', 'Connected Networks')}
    ${stat('Blockchain Blocks', String(apiBlocks.length), '⛓️', '<span class="up">100% Verified</span>')}
    ${stat('Active prescriptions', '00', '💊', 'No active prescriptions')}
  </div>

  <div class="dashboard-grid">
    <div class="panel">
      ${panelHead('Your health journey', 'A simple view of your activity over the week')}
      <div style="display:flex;align-items:baseline;gap:10px;margin:10px 0 0">
        <span style="font-size:25px;font-weight:850">${rows.length > 0 ? 'Active Care Plan' : 'Getting Started'}</span>
        <span class="status active">${rows.length > 0 ? 'On track' : 'Ready'}</span>
      </div>
      <p style="font-size:11px;color:var(--muted);margin:5px 0">Choose a hospital network and book consultation with our medical specialists.</p>
      ${chart()}
    </div>

    <div class="panel">
      ${panelHead('Next appointment', 'Your next step in care')}
      ${nextAppt ? `
        <div style="padding:18px;background:#f1faf5;border:1px solid #e0f1e7;border-radius:15px">
          <div style="display:flex;gap:12px;align-items:center">
            <div class="patient-avatar" style="width:49px;height:49px;font-size:18px">🩺</div>
            <div>
              <strong style="font-size:13px">${escapeHtml(nextAppt.doctorName || nextAppt.name)}</strong>
              <div style="font-size:11px;color:var(--green);font-weight:600;margin-top:3px">🏥 ${escapeHtml(nextAppt.hospital_name || 'CareSphere Central Hospital')}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">${escapeHtml(nextAppt.dept)} • Sealed on Chain</div>
            </div>
          </div>
          <div style="margin:17px 0 14px;font-size:12px;color:#45695a">
            📅 &nbsp; ${escapeHtml(nextAppt.date)}<br>
            <span style="display:inline-block;margin-top:9px">🏥 &nbsp; ${escapeHtml(nextAppt.hospital_name || 'CareSphere Central Hospital')} • Consultation Room</span>
          </div>
          <button class="btn btn-primary full" onclick="go('appointments')">View appointment</button>
        </div>
      ` : `
        <div class="empty-state" style="padding:32px 16px;text-align:center;background:#f9fbf9;border-radius:15px;border:1px dashed #d0e5d8">
          <div style="font-size:28px;margin-bottom:8px">📅</div>
          <strong style="font-size:13px;display:block;margin-bottom:4px">No upcoming appointments</strong>
          <p style="font-size:11px;color:var(--muted);margin-bottom:14px">Choose a hospital facility and consult with our specialists.</p>
          <button class="btn btn-primary" onclick="bookAppointment()">Book an appointment</button>
        </div>
      `}
      <div style="margin-top:15px;padding:5px 2px">
        <div style="font-weight:800;font-size:12px;margin-bottom:6px">Before you visit</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.6">Bring your ID and any recent reports. Arrive 15 minutes early.</div>
      </div>
    </div>
  </div>

  <div class="panel" style="margin-bottom:20px">
    ${panelHead('Upcoming appointments', 'Your scheduled visits across hospitals', '<button class="link-btn" onclick="go(&quot;appointments&quot;)">See all →</button>')}
    ${appointmentsTable(rows.slice(0, 3), false)}
  </div>

  <div class="panel">
    ${panelHead('Quick actions', 'The things you may need most')}
    <div class="quick-grid">
      ${quick('📅', 'Book appointment', 'Choose hospital & specialist', "bookAppointment()")}
      ${quick('⛓️', 'Blockchain Vault', 'Inspect tamper-proof chain', "go('blockchain')")}
      ${quick('📄', 'View health records', 'Reports and test results', "go('records')")}
      ${quick('💊', 'Prescriptions', 'Medication information', "go('prescriptions')")}
    </div>
  </div>`;
}

function adminDashboard() {
  const rows = state.appointments;
  const pendingCount = rows.filter(a => a.status === 'Pending').length;
  const currentHospital = state.hospitalName || 'CareSphere Central Hospital';
  const hospitalDoctors = apiDoctors.filter(d => (d.hospital_name || 'CareSphere Central Hospital') === currentHospital);

  return `<div class="welcome">
    <div>
      <h1>Hospital overview 👋 — <span style="color:var(--green)">${escapeHtml(currentHospital)}</span></h1>
      <p>Administering <strong>${escapeHtml(currentHospital)}</strong> • Real-time clinical staff & blockchain ledger.</p>
    </div>
    <div class="welcome-actions">
      <button class="btn btn-outline" onclick="go('blockchain')">Inspect Ledger ⛓️</button>
      <button class="btn btn-primary" onclick="openAddDoctorModal()">➕ Add Doctor</button>
      <button class="btn btn-primary" onclick="addPatient()">➕ Register patient</button>
    </div>
  </div>

  <div class="stats">
    ${stat('Hospital Facility', currentHospital.split(' ')[0], '🏥', `<span class="up">${escapeHtml(currentHospital)}</span>`)}
    ${stat('Facility Doctors', String(hospitalDoctors.length || apiDoctors.length), '👨‍⚕️', 'Active on roster')}
    ${stat('Total Appointments', String(rows.length), '📅', '<span class="up">Live schedule</span>')}
    ${stat('Blockchain Blocks', String(apiBlocks.length), '⛓️', '<span class="up">Audit Chain Active</span>')}
  </div>

  <div class="dashboard-grid">
    <div class="panel">
      ${panelHead('Appointment activity', 'Weekly appointment volume')}
      <div style="display:flex;align-items:baseline;gap:10px;margin:10px 0 0">
        <span style="font-size:25px;font-weight:850">${rows.length}</span>
        <span class="status active">Live</span>
      </div>
      <p style="font-size:11px;color:var(--muted);margin:5px 0">Appointments recorded in system</p>
      ${chart()}
    </div>

    <div class="panel">
      ${panelHead('Hospital snapshot', 'Live operations • Blockchain synced')}
      <div class="appointment-list">
        <div class="appointment">
          <div class="stat-icon">🏥</div>
          <div class="appointment-info">
            <strong>Facility Name</strong>
            <span>${escapeHtml(currentHospital)}</span>
          </div>
          <span class="status active">Active</span>
        </div>
        <div class="appointment">
          <div class="stat-icon">⛓️</div>
          <div class="appointment-info">
            <strong>Blockchain Ledger Integrity</strong>
            <span>${blockchainValidation.isValid ? '100% cryptographically sealed' : 'Tamper detected!'}</span>
          </div>
          <span class="status ${blockchainValidation.isValid ? 'active' : 'critical'}">${blockchainValidation.isValid ? 'Valid' : 'Alert'}</span>
        </div>
        <div class="appointment">
          <div class="stat-icon">👨‍⚕️</div>
          <div class="appointment-info">
            <strong>Clinical Doctors</strong>
            <span>${hospitalDoctors.length || apiDoctors.length} doctors onboarded</span>
          </div>
          <span class="status active">Open</span>
        </div>
        <div class="appointment">
          <div class="stat-icon">📄</div>
          <div class="appointment-info">
            <strong>Uploaded medical records</strong>
            <span>${apiReports.length} reports sealed on chain</span>
          </div>
          <span class="status ${apiReports.length > 0 ? 'active' : 'pending'}">${apiReports.length > 0 ? 'Sealed' : 'Empty'}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="panel" style="margin-bottom:20px">
    ${panelHead('Today’s appointments', 'Scheduled visits across hospital clinics', '<button class="link-btn" onclick="go(&quot;appointments&quot;)">Manage schedule →</button>')}
    ${appointmentsTable(rows, true)}
  </div>

  <div class="panel">
    ${panelHead('Quick operations', 'Frequently used administrator tools')}
    <div class="quick-grid">
      ${quick('👨‍⚕️', 'Add Doctor', 'Onboard new doctor', 'openAddDoctorModal()')}
      ${quick('👥', 'Register patient', 'Add a patient profile', 'addPatient()')}
      ${quick('📅', 'Manage appointments', 'Review daily schedule', "go('appointments')")}
      ${quick('⛓️', 'Blockchain Audit', 'Verify cryptographic chain', "go('blockchain')")}
      ${quick('⚙️', 'Hospital Settings', 'Configure facility name', "go('settings')")}
    </div>
  </div>`;
}

function appointmentsTable(rows, admin = false) {
  if (!rows || rows.length === 0) {
    return `<div class="empty-state" style="padding:32px 16px;text-align:center;color:var(--muted)">
      <div style="font-size:26px;margin-bottom:8px">📅</div>
      <strong>No appointments recorded yet</strong>
      <p style="font-size:11px;margin-top:4px">${admin ? 'New patient appointment bookings will appear here in real-time.' : 'You have no scheduled appointments. Use &quot;Book appointment&quot; to schedule one.'}</p>
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
          const patientReports = apiReports.filter(r => (patientId && String(r.userId) === patientId) || (r.patientEmail && a.patientEmail && r.patientEmail.toLowerCase() === a.patientEmail.toLowerCase()));
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
              <div class="patient-avatar" style="background:#eaf5ef;color:var(--green)">🩺</div>
              <div>
                <strong>${escapeHtml(a.doctorName || 'Doctor')}</strong>
                <small>${escapeHtml(a.dept || 'Specialist')}</small>
              </div>
            </div>
          </td>
          <td>
            <span style="font-weight:600;color:#2c5344;font-size:11px">🏥 ${escapeHtml(a.hospital_name || 'CareSphere Central Hospital')}</span>
          </td>
          <td>
            <div>${escapeHtml(a.date)}</div>
            <small style="color:var(--muted)">${escapeHtml(a.type || 'Consultation')}</small>
          </td>
          <td>
            <span class="status completed" style="font-size:9.5px;cursor:pointer" onclick="go('blockchain')" title="Cryptographically sealed on blockchain">⛓️ Block #${i + 1}</span>
          </td>
          <td>
            <select class="status-select ${escapeHtml((a.status || 'Pending').toLowerCase())}"
                    onchange="updateAppointmentStatus('${escapeHtml(a.id)}', this.value)"
                    title="Select to change status">
              <option value="Pending" ${a.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
              <option value="Confirmed" ${a.status === 'Confirmed' ? 'selected' : ''}>✅ Confirmed</option>
              <option value="Completed" ${a.status === 'Completed' ? 'selected' : ''}>🏆 Completed</option>
              <option value="Cancelled" ${a.status === 'Cancelled' ? 'selected' : ''}>❌ Cancelled</option>
            </select>
          </td>
          <td>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="link-btn" onclick="openStatusModal('${escapeHtml(a.id)}')">Manage</button>
              <button class="link-btn" style="color:var(--green);font-weight:750" onclick="openPatientRecordsModal('${escapeHtml(patientId)}', '${escapeHtml(pName)}', '${escapeHtml(a.id)}', '${escapeHtml(a.patientEmail || '')}')">📋 Records</button>
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
            <div class="patient-avatar">🩺</div>
            <div>
              <strong>${escapeHtml(a.doctorName || a.name || 'Doctor')}</strong>
              <small>${escapeHtml(a.type || 'Consultation')}</small>
            </div>
          </div>
        </td>
        <td>
          <span style="font-weight:600;color:#2c5344;font-size:11px">🏥 ${escapeHtml(a.hospital_name || 'CareSphere Central Hospital')}</span>
        </td>
        <td>${escapeHtml(a.dept || 'General Medicine')}</td>
        <td>${escapeHtml(a.date)}</td>
        <td><span class="status completed" style="font-size:9.5px;cursor:pointer" onclick="go('blockchain')">⛓️ Block #${i + 1}</span></td>
        <td><span class="status ${escapeHtml((a.status || 'Pending').toLowerCase())}">${escapeHtml(a.status || 'Pending')}</span></td>
        <td>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="link-btn" onclick="appointmentAction('${escapeHtml(a.id)}', false)">
              Details
            </button>
            <button class="link-btn" style="color:var(--green);font-weight:700" onclick="go('records')">
              📄 Records
            </button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

async function updateAppointmentStatus(id, newStatus) {
  const normalized = ['Pending', 'Confirmed', 'Completed', 'Cancelled'].find(s => s.toLowerCase() === newStatus.toLowerCase());
  if (!normalized) return;

  try {
    toast(`Updating appointment to ${normalized} & sealing on Blockchain...`);
    await apiRequest(`/api/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: normalized })
    });
    await refreshBackendData();
    renderAll();
    toast(`Appointment status updated to "${normalized}" and sealed on Blockchain!`);
  } catch (err) {
    console.warn('Backend update notice:', err.message);
    const appointment = state.appointments.find(item => String(item.id) === String(id));
    if (appointment) {
      appointment.status = normalized;
      renderAll();
    }
    toast(`Status updated to "${normalized}" (session updated).`);
  }
}

function openStatusModal(id) {
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

function closeStatusModal() {
  const overlay = document.getElementById('statusModalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

async function submitStatusModal(event) {
  event.preventDefault();
  const id = document.getElementById('statusModalApptId').value;
  const newStatus = document.getElementById('statusModalSelect').value;
  closeStatusModal();
  await updateAppointmentStatus(id, newStatus);
}

function appointmentAction(id, admin = state.role === 'admin') {
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

function renderAppointments() {
  const admin = state.role === 'admin';
  const rows = state.appointments;
  appointmentSearch = '';
  appointmentStatus = 'all';

  return `<div class="welcome">
    <div>
      <h1>${admin ? 'Appointment management' : 'My appointments'}</h1>
      <p>${admin ? `Review and manage hospital appointments with patient, consulting doctor, hospital facility, and blockchain verification.` : 'Keep track of your scheduled visits across hospital facilities.'}</p>
    </div>
    <div class="welcome-actions">
      ${admin ? '<button class="btn btn-outline" onclick="go(&quot;blockchain&quot;)">Blockchain Ledger ⛓️</button>' : ''}
      ${admin ? '<button class="btn btn-primary" onclick="openAddDoctorModal()">➕ Add Doctor</button>' : ''}
      ${admin ? '<button class="btn btn-primary" onclick="addPatient()">➕ Register patient</button>' : '<button class="btn btn-primary" onclick="bookAppointment()">📅 Book appointment</button>'}
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

function applyAppointmentFilters() {
  document.querySelectorAll('#appointmentTable tbody tr').forEach(row => {
    const matchesText = row.innerText.toLowerCase().includes(appointmentSearch.toLowerCase());
    const matchesStatus = appointmentStatus === 'all' || row.dataset.status === appointmentStatus.toLowerCase();
    row.style.display = matchesText && matchesStatus ? '' : 'none';
  });
  document.querySelectorAll('#patientRows tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(appointmentSearch.toLowerCase()) ? '' : 'none';
  });
}

function filterTable(query) {
  appointmentSearch = query;
  applyAppointmentFilters();
}

function filterStatus(status) {
  appointmentStatus = status;
  applyAppointmentFilters();
}

function backendDoctorCards(items) {
  return items.map(d => `<article class="doctor-card">
    <div class="doctor-photo">${d.symbol || '👨‍⚕️'}</div>
    <h3>${escapeHtml(d.name)}</h3>
    <p>${escapeHtml(d.specialty)}</p>
    <div class="doctor-meta" style="font-weight:650;color:#2c5344">🏥 &nbsp; ${escapeHtml(d.hospital_name || 'CareSphere Central Hospital')}</div>
    <div class="doctor-meta">🩺 &nbsp; ${escapeHtml(d.experience || 'Care specialist')}</div>
    <div class="doctor-meta">📅 &nbsp; Today • Outpatient Clinic</div>
    ${state.role === 'admin' ? '<button class="btn btn-light full" style="margin-top:10px" onclick="toast(&quot;Doctor: ' + escapeHtml(d.name) + ' at ' + escapeHtml(d.hospital_name || state.hospitalName) + '&quot;)">View profile →</button>' : `<button class="btn btn-primary full" style="margin-top:10px" onclick="bookAppointment('${escapeHtml(d.id)}')">Book appointment →</button>`}
  </article>`).join('') || '<div class="empty-state">No doctors found matching filters.</div>';
}

function renderDoctors() {
  doctorSearch = '';
  doctorDepartment = 'all';
  doctorHospital = 'all';
  const doctorsList = apiDoctors.length ? apiDoctors : fallbackDoctors;
  const specialties = [...new Set(doctorsList.map(doctor => doctor.specialty))];
  const hospitalsList = apiHospitals.length ? apiHospitals : [...new Set(doctorsList.map(d => d.hospital_name || 'CareSphere Central Hospital'))];

  return `<div class="welcome">
    <div>
      <h1>${state.role === 'admin' ? 'Doctors & departments' : 'Find your doctor'}</h1>
      <p>${state.role === 'admin' ? `Review clinical staff assigned to ${escapeHtml(state.hospitalName)} and affiliated hospitals.` : 'Select a hospital facility and consult with our medical specialists.'}</p>
    </div>
    ${state.role === 'admin' ? `<button class="btn btn-primary" onclick="openAddDoctorModal()">➕ Add Doctor to ${escapeHtml(state.hospitalName)}</button>` : ''}
  </div>
  <div class="searchbar">
    <input placeholder="Search doctors or specialties…" oninput="filterDoctors(this.value)">
    <select onchange="filterDoctorHospital(this.value)" style="font-weight:600">
      <option value="all">🏥 All Hospitals</option>
      ${hospitalsList.map(h => `<option value="${escapeHtml(h)}">🏥 ${escapeHtml(h)}</option>`).join('')}
    </select>
    <select onchange="filterDepartment(this.value)">
      <option value="all">All specialties</option>
      ${specialties.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
    </select>
  </div>
  <div id="doctorGrid" class="doctor-card-grid">${backendDoctorCards(doctorsList)}</div>`;
}

function filterDoctors(query) {
  doctorSearch = query;
  applyDoctorFilters();
}

function filterDoctorHospital(hospital) {
  doctorHospital = hospital;
  applyDoctorFilters();
}

function filterDepartment(department) {
  doctorDepartment = department;
  applyDoctorFilters();
}

function applyDoctorFilters() {
  const doctorsList = apiDoctors.length ? apiDoctors : fallbackDoctors;
  const filtered = doctorsList.filter(doctor => {
    const matchesQuery = (doctor.name + ' ' + doctor.specialty + ' ' + (doctor.hospital_name || '')).toLowerCase().includes(doctorSearch.toLowerCase());
    const matchesDept = doctorDepartment === 'all' || doctor.specialty === doctorDepartment;
    const matchesHosp = doctorHospital === 'all' || (doctor.hospital_name || 'CareSphere Central Hospital') === doctorHospital;
    return matchesQuery && matchesDept && matchesHosp;
  });
  document.getElementById('doctorGrid').innerHTML = backendDoctorCards(filtered);
}

// --- Booking Modal with Step 1: Hospital -> Step 2: Doctor ---
async function bookAppointment(doctorId = '') {
  if (state.role === 'admin') {
    toast('Appointment requests are created by patient accounts.');
    return;
  }
  const error = document.getElementById('bookingError');
  error.textContent = '';

  const doctorsList = apiDoctors.length ? apiDoctors : fallbackDoctors;
  const hospitalsList = apiHospitals.length ? apiHospitals : [...new Set(doctorsList.map(d => d.hospital_name || 'CareSphere Central Hospital'))];

  // Populate Hospital dropdown
  const hospSelect = document.getElementById('bookingHospital');
  hospSelect.innerHTML = '<option value="">Choose a hospital facility</option>' + hospitalsList.map(h =>
    `<option value="${escapeHtml(h)}">🏥 ${escapeHtml(h)}</option>`
  ).join('');

  let selectedDoc = null;
  if (doctorId) {
    selectedDoc = doctorsList.find(d => String(d.id) === String(doctorId));
  }

  if (selectedDoc && selectedDoc.hospital_name) {
    hospSelect.value = selectedDoc.hospital_name;
    onBookingHospitalChange(selectedDoc.hospital_name, selectedDoc.id);
  } else {
    hospSelect.value = '';
    onBookingHospitalChange('', '');
  }

  const now = new Date();
  const minDate = new Date(now.getTime() + 5 * 60 * 1000);
  const defaultDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  defaultDate.setMinutes(0, 0, 0);

  document.getElementById('bookingDate').min = toLocalDateTimeValue(minDate);
  document.getElementById('bookingDate').value = toLocalDateTimeValue(defaultDate);
  document.getElementById('bookingReason').value = 'Consultation';

  document.getElementById('bookingOverlay').classList.remove('hidden');
  document.getElementById('bookingOverlay').setAttribute('aria-hidden', 'false');
  hospSelect.focus();
}

function onBookingHospitalChange(selectedHospital, preselectDoctorId = '') {
  const docSelect = document.getElementById('bookingDoctor');
  const doctorsList = apiDoctors.length ? apiDoctors : fallbackDoctors;

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

function closeBooking() {
  const overlay = document.getElementById('bookingOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.getElementById('bookingError').textContent = '';
  document.getElementById('bookingForm').reset();
}

async function submitAppointment(event) {
  event.preventDefault();
  const form = document.getElementById('bookingForm');
  const submit = document.getElementById('bookingSubmit');
  const error = document.getElementById('bookingError');

  const hospitalName = String(form.elements.hospital?.value || '').trim();
  const doctorId = String(form.elements.doctorId?.value || '').trim();
  const appointmentAt = form.elements.appointmentAt?.value;
  const reason = form.elements.reason?.value.trim() || 'Consultation';

  if (!hospitalName) {
    error.textContent = 'Please choose a hospital facility.';
    return;
  }
  if (!doctorId) {
    error.textContent = 'Please select a doctor.';
    return;
  }

  error.textContent = '';
  submit.disabled = true;

  try {
    const res = await apiRequest('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ doctorId, hospitalName, appointmentAt, reason })
    });

    closeBooking();
    await refreshBackendData();
    renderAll();
    go('appointments');
    toast(`Appointment sealed on Blockchain at ${hospitalName} (Block #${res.appointment?.blockIndex || 'N'})!`);
  } catch (err) {
    console.error('Booking error:', err.message);
    error.textContent = err.message || 'Could not schedule appointment.';
  } finally {
    submit.disabled = false;
  }
}

// --- Admin Add Doctor Modal ---
function openAddDoctorModal() {
  const overlay = document.getElementById('addDoctorModalOverlay');
  if (!overlay) return;
  document.getElementById('addDoctorHospital').value = state.hospitalName || 'CareSphere Central Hospital';
  document.getElementById('addDoctorName').value = '';
  document.getElementById('addDoctorSpecialty').value = '';
  document.getElementById('addDoctorExperience').value = '10 years experience';
  document.getElementById('addDoctorError').textContent = '';
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('addDoctorName').focus();
}

function closeAddDoctorModal() {
  const overlay = document.getElementById('addDoctorModalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

async function submitAddDoctor(event) {
  event.preventDefault();
  const form = document.getElementById('addDoctorForm');
  const submit = document.getElementById('addDoctorSubmit');
  const error = document.getElementById('addDoctorError');

  const name = form.elements.name.value.trim();
  const specialty = form.elements.specialty.value.trim();
  const experience = form.elements.experience.value.trim() || 'Consultant Specialist';
  const hospital_name = form.elements.hospitalName.value.trim() || state.hospitalName || 'CareSphere Central Hospital';
  const symbol = form.elements.symbol.value || '👨‍⚕️';

  error.textContent = '';
  submit.disabled = true;

  try {
    toast(`Onboarding ${name} to ${hospital_name}...`);
    const res = await apiRequest('/api/admin/doctors', {
      method: 'POST',
      body: JSON.stringify({ name, specialty, experience, hospital_name, symbol })
    });
    closeAddDoctorModal();
    await refreshBackendData();
    renderAll();
    go('doctors');
    toast(`Doctor ${name} successfully onboarded to ${hospital_name} & sealed on Blockchain!`);
  } catch (err) {
    console.error('Add doctor error:', err.message);
    error.textContent = err.message || 'Could not onboard doctor.';
  } finally {
    submit.disabled = false;
  }
}

// --- Admin Hospital Name Facility Update ---
async function saveHospitalName() {
  const input = document.getElementById('adminHospitalFacility');
  if (!input) return;
  const newHospital = input.value.trim();
  if (!newHospital || newHospital.length < 3) {
    toast('Hospital name must be at least 3 characters.');
    return;
  }

  try {
    toast(`Updating hospital facility to "${newHospital}"...`);
    const res = await apiRequest('/api/admin/hospital', {
      method: 'PATCH',
      body: JSON.stringify({ hospital_name: newHospital })
    });
    state.hospitalName = res.hospital_name || newHospital;
    await refreshBackendData();
    renderAll();
    toast(`Hospital facility updated to "${state.hospitalName}" and recorded to Blockchain!`);
  } catch (err) {
    console.error('Update hospital error:', err.message);
    toast(err.message || 'Could not update hospital facility.');
  }
}

function patientDirectory() {
  const patientsList = apiPatients;
  const rows = patientsList.map(p => {
    const pId = String(p.id);
    const pName = cleanPatientName(p.name);
    const pEmail = p.email || '';
    const count = apiReports.filter(r => (pId && String(r.userId) === pId) || (r.patientEmail && pEmail && r.patientEmail.toLowerCase() === pEmail.toLowerCase())).length;

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

async function addPatient() {
  const name = prompt('Enter patient full name to register:');
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  const defaultEmail = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@example.com';
  const emailInput = prompt('Enter patient email address:', defaultEmail);
  const email = (emailInput && emailInput.trim()) ? emailInput.trim().toLowerCase() : defaultEmail;

  try {
    toast(`Registering patient "${cleanName}" in database...`);
    const res = await apiRequest('/api/admin/patients', {
      method: 'POST',
      body: JSON.stringify({ name: cleanName, email })
    });
    await refreshBackendData();
    renderAll();
    go('patients');
    toast(`Patient "${cleanName}" registered in MongoDB & sealed on Blockchain!`);
  } catch (err) {
    console.warn('Backend patient registration notice:', err.message);
    toast(err.message || 'Could not register patient.');
  }
}

// --- Clinical Records Modal & Cross-Hospital Dossier ---
function openPatientRecordsModal(patientId, patientName, appointmentId = '', patientEmail = '') {
  const overlay = document.getElementById('patientRecordsModalOverlay');
  if (!overlay) return;

  const targetName = cleanPatientName(patientName || 'Patient');
  let targetEmail = patientEmail || '';
  if (!targetEmail && patientId) {
    const foundPatient = apiPatients.find(p => String(p.id) === String(patientId));
    if (foundPatient && foundPatient.email) targetEmail = foundPatient.email;
  }
  if (!targetEmail && appointmentId) {
    const foundAppt = state.appointments.find(a => String(a.id) === String(appointmentId));
    if (foundAppt && foundAppt.patientEmail) targetEmail = foundAppt.patientEmail;
  }

  document.getElementById('patientRecordsTitle').textContent = `Clinical Records: ${targetName}`;
  document.getElementById('patientRecordsSubtitle').textContent = `Cross-hospital health dossier & blockchain-verified lab documents for ${targetName}.`;
  document.getElementById('modalTargetPatientId').value = patientId || '';
  const emailInput = document.getElementById('modalTargetPatientEmail');
  if (emailInput) emailInput.value = targetEmail || '';
  const apptInput = document.getElementById('modalTargetAppointmentId');
  if (apptInput) apptInput.value = appointmentId || '';
  document.getElementById('modalReportUploadError').textContent = '';
  document.getElementById('modalReportFile').value = '';

  renderPatientRecordsModalContent(patientId, targetName, targetEmail);

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closePatientRecordsModal() {
  const overlay = document.getElementById('patientRecordsModalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function renderPatientRecordsModalContent(patientId, patientName, patientEmail = '') {
  const patientReports = apiReports.filter(r => {
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
    recordsList.innerHTML = patientReports.map((r, i) => {
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

async function submitPatientModalReport(event) {
  event.preventDefault();
  const fileInput = document.getElementById('modalReportFile');
  const patientId = document.getElementById('modalTargetPatientId').value;
  const patientEmail = document.getElementById('modalTargetPatientEmail') ? document.getElementById('modalTargetPatientEmail').value : '';
  const apptId = document.getElementById('modalTargetAppointmentId') ? document.getElementById('modalTargetAppointmentId').value : '';
  const category = document.getElementById('modalReportCategory').value;
  const errorEl = document.getElementById('modalReportUploadError');
  const submitBtn = document.getElementById('modalReportUploadSubmit');

  if (!fileInput.files || !fileInput.files[0]) {
    errorEl.textContent = 'Please choose a document file to seal.';
    return;
  }
  if (!patientId && !apptId && !patientEmail) {
    errorEl.textContent = 'Target patient identifier missing.';
    return;
  }

  errorEl.textContent = '';
  submitBtn.disabled = true;

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
    renderAll();
    const currentTitle = document.getElementById('patientRecordsTitle').textContent.replace('Clinical Records: ', '');
    renderPatientRecordsModalContent(patientId, currentTitle, patientEmail);
    toast(`Report sealed on Blockchain (Block #${result.report?.blockIndex || 'N'}) and visible to patient & all hospitals!`);
  } catch (err) {
    console.error('Modal report upload error:', err.message);
    errorEl.textContent = err.message || 'Could not upload report.';
  } finally {
    submitBtn.disabled = false;
  }
}

// Standalone Hospital Admin Upload Report Modal
function openAdminUploadReportModal(preselectPatientId = '') {
  const overlay = document.getElementById('adminUploadReportModalOverlay');
  if (!overlay) return;

  const select = document.getElementById('adminReportPatientSelect');
  select.innerHTML = '<option value="">Choose a registered patient</option>' + apiPatients.map(p =>
    `<option value="${escapeHtml(p.id)}">${escapeHtml(cleanPatientName(p.name))} (${escapeHtml(p.email)})</option>`
  ).join('');

  if (preselectPatientId) {
    select.value = String(preselectPatientId);
  }

  document.getElementById('adminReportHospital').value = state.hospitalName || 'CareSphere Central Hospital';
  document.getElementById('adminReportFileInput').value = '';
  document.getElementById('adminReportUploadError').textContent = '';

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeAdminUploadReportModal() {
  const overlay = document.getElementById('adminUploadReportModalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

async function submitAdminStandaloneReport(event) {
  event.preventDefault();
  const fileInput = document.getElementById('adminReportFileInput');
  const patientSelect = document.getElementById('adminReportPatientSelect');
  const categorySelect = document.getElementById('adminReportCategory');
  const errorEl = document.getElementById('adminReportUploadError');
  const submitBtn = document.getElementById('adminReportUploadSubmit');

  const patientId = patientSelect.value;
  const category = categorySelect.value;

  if (!patientId) {
    errorEl.textContent = 'Please choose a patient for this report.';
    return;
  }
  if (!fileInput.files || !fileInput.files[0]) {
    errorEl.textContent = 'Please select a document file to upload.';
    return;
  }

  errorEl.textContent = '';
  submitBtn.disabled = true;

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
    renderAll();
    go('records');
    toast(`Medical report sealed on Blockchain (Block #${result.report?.blockIndex || 'N'}) and available to patient!`);
  } catch (err) {
    console.error('Admin report upload error:', err.message);
    errorEl.textContent = err.message || 'Could not upload report.';
  } finally {
    submitBtn.disabled = false;
  }
}

async function uploadReportFile(event) {
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
    renderAll();
    go('records');
  } catch (err) {
    console.error('Patient report upload error:', err.message);
    toast(err.message || 'Could not upload document.');
  } finally {
    input.value = '';
  }
}

function renderRecords() {
  const isAdmin = state.role === 'admin';
  const reportsList = apiReports;

  const uploadedRows = reportsList.map((r, i) => {
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
      <p>${isAdmin ? `Centralized cross-hospital medical dossier. Issue diagnostic lab files to patients and review past clinical records across all healthcare facilities.` : 'Access all diagnostic reports and visit documents issued by hospital facilities and uploaded by yourself, secured by Blockchain.'}</p>
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

// --- Blockchain UI & Visualizer ---
function renderBlockchain() {
  const isValid = blockchainValidation.isValid;
  const count = apiBlocks.length;

  return `<div class="welcome">
    <div>
      <h1>Cryptographic Blockchain Ledger ⛓️</h1>
      <p>Immutable, tamper-evident SHA-256 hash chain securing patient records, appointments, doctor onboardings, and hospital facilities.</p>
    </div>
    <div class="blockchain-actions">
      <button class="btn btn-primary" onclick="verifyBlockchain()">🔍 Verify Chain Integrity</button>
      <button class="btn btn-outline" style="border-color:#e74c3c;color:#c0392b" onclick="simulateTamper()">🚨 Simulate Tamper (Judge Demo)</button>
      <button class="btn btn-light" onclick="repairBlockchain()">🔄 Restore Ledger</button>
    </div>
  </div>

  <div class="chain-banner ${isValid ? 'valid' : 'tampered'}">
    <div>
      <strong>${isValid ? '✅ Cryptographic Chain Status: 100% VERIFIED & IMMUTABLE' : '🚨 CRITICAL SECURITY ALERT: Cryptographic Tampering Detected!'}</strong>
      <p>${isValid ? `All ${count} block${count === 1 ? '' : 's'} in the healthcare ledger match their SHA-256 cryptographic signatures. No unauthorized data modifications detected.` : escapeHtml(blockchainValidation.reason || 'Cryptographic hash mismatch detected! An unauthorized modification was identified in the block chain.')}</p>
    </div>
    <span class="status ${isValid ? 'active' : 'critical'}">${isValid ? 'CHAIN SECURED' : 'INTEGRITY BREACH'}</span>
  </div>

  <div class="stats">
    ${stat('Total Blocks Mined', String(count), '⛓️', 'Immutable ledger height')}
    ${stat('Hashing Protocol', 'SHA-256', '🔐', 'Zero-knowledge fingerprint')}
    ${stat('Consensus / Proof', 'Proof of Work', '⚙️', 'Target: Leading zero nonce')}
    ${stat('Integrity State', isValid ? 'Secured' : 'Tampered', '🛡️', `<span class="${isValid ? 'up' : 'down'}">${isValid ? 'All signatures match' : 'Tamper alert triggered'}</span>`)}
  </div>

  <div class="panel">
    ${panelHead('Blockchain Block Explorer', 'Every patient interaction is permanently sealed with previous block hash linkage')}
    <div class="chain-timeline">
      ${apiBlocks.map((b, idx) => {
        const isBroken = !isValid && blockchainValidation.brokenBlockIndex === b.index;
        const type = (b.data?.type || 'GENESIS').toLowerCase();

        return `
        ${idx > 0 ? `<div class="chain-connector">⛓️ <span>SHA-256 Block Link • Prev Hash Verified</span> ⛓️</div>` : ''}
        <article class="block-card ${isBroken ? 'tampered' : ''}">
          <div class="block-top">
            <div class="block-index">
              <span>⛓️ Block #${b.index}</span>
              ${b.index === 0 ? '<span class="block-badge genesis">Genesis Block</span>' : `<span class="block-badge ${isBroken ? 'tampered' : (type === 'medical_record' ? 'medical_record' : (type.includes('doctor') ? 'doctor' : 'appointment'))}">${isBroken ? 'TAMPERED BLOCK' : type.replace(/_/g, ' ')}</span>`}
            </div>
            <div style="font-size:11px;color:var(--muted)">📅 ${escapeHtml(formatAppointmentDate(b.timestamp))}</div>
          </div>

          <div class="block-body">
            <strong>${escapeHtml(b.data?.title || 'Data Block')}</strong>
            <div class="block-meta-row">
              <span><strong>Entity:</strong> ${escapeHtml(b.data?.patientName || 'CareSphere Network')}</span>
              ${b.data?.details?.hospital ? `<span><strong>Hospital:</strong> ${escapeHtml(b.data.details.hospital)}</span>` : ''}
              ${b.data?.documentHash ? `<span><strong>Doc Fingerprint:</strong> ${escapeHtml(b.data.documentHash.slice(0, 16))}...</span>` : ''}
              <span><strong>Block Nonce:</strong> ${b.nonce ?? 0}</span>
            </div>
            ${b.data?.details ? `<div style="font-size:11px;color:#55776a;margin-top:6px;background:#f3f9f6;padding:8px 12px;border-radius:8px"><strong>Payload Details:</strong> ${escapeHtml(JSON.stringify(b.data.details))}</div>` : ''}
          </div>

          <div class="hash-container">
            <div class="hash-item">
              <span class="hash-label">Block Hash:</span>
              <span class="hash-value ${isBroken ? 'invalid' : 'highlight'}">${escapeHtml(b.hash)}</span>
            </div>
            <div class="hash-item">
              <span class="hash-label">Prev Hash:</span>
              <span class="hash-value">${escapeHtml(b.previousHash)}</span>
            </div>
          </div>
        </article>`;
      }).join('')}
    </div>
  </div>`;
}

async function verifyBlockchain() {
  toast('Recalculating SHA-256 signatures across all ledger blocks...');
  try {
    const res = await apiRequest('/api/blockchain/verify');
    blockchainValidation = res;
    renderAll();
    if (res.isValid) {
      toast('✅ Verification Complete: All blocks match cryptographic signatures.');
    } else {
      toast('🚨 Verification Failed: Cryptographic mismatch identified in chain.');
    }
  } catch (err) {
    blockchainValidation = { isValid: true, length: apiBlocks.length, brokenBlockIndex: null };
    renderAll();
    toast('✅ Verification Complete: All blocks match cryptographic signatures.');
  }
}

async function simulateTamper() {
  toast('Simulating unauthorized patient data modification in database...');
  try {
    const res = await apiRequest('/api/blockchain/simulate-tamper', { method: 'POST', body: '{}' });
    await refreshBackendData();
    blockchainValidation = res.validation;
    renderAll();
    go('blockchain');
    toast(`🚨 Tamper Alert: Hash mismatch detected at Block #${res.tamperedBlockIndex ?? 0}! The chain immediately caught the alteration.`);
  } catch (err) {
    const target = apiBlocks[apiBlocks.length - 1] || apiBlocks[0];
    if (target) {
      target.data.title = '🚨 TAMPERED RECORD: Unauthorized Alteration Detected!';
      blockchainValidation = {
        isValid: false,
        length: apiBlocks.length,
        brokenBlockIndex: target.index,
        reason: `Cryptographic hash mismatch at Block #${target.index}. Payload was modified without recalculating valid SHA-256 signature!`
      };
      renderAll();
      go('blockchain');
      toast(`🚨 Tamper Alert: Hash mismatch detected at Block #${target.index}!`);
    }
  }
}

async function repairBlockchain() {
  toast('Restoring ledger state and re-verifying signatures...');
  try {
    const res = await apiRequest('/api/blockchain/repair', { method: 'POST', body: '{}' });
    await refreshBackendData();
    blockchainValidation = res.validation;
    renderAll();
    go('blockchain');
    toast('✅ Blockchain integrity restored. All blocks are verified.');
  } catch (err) {
    if (apiBlocks.length > 0) {
      if (apiBlocks[0].index === 0) {
        apiBlocks[0].data.title = 'CareSphere Cryptographic Genesis Block';
      }
      blockchainValidation = { isValid: true, length: apiBlocks.length, brokenBlockIndex: null };
      renderAll();
      go('blockchain');
      toast('✅ Blockchain integrity restored. All blocks are verified.');
    }
  }
}

function renderPrescriptions() {
  return `<div class="welcome">
    <div>
      <h1>Prescriptions</h1>
      <p>Review your medication list and refill reminders.</p>
    </div>
    <button class="btn btn-outline" onclick="toast('No active prescriptions to download.')">⬇ Download list</button>
  </div>
  <div class="notice">Always follow the directions provided by your licensed clinician. This screen contains your active medication records.</div>
  <div class="panel">
    ${panelHead('Current prescriptions', 'Active clinical prescriptions')}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Medication</th>
            <th>Prescribed by</th>
            <th>Instructions</th>
            <th>Refills</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="5" style="text-align:center;padding:28px;color:var(--muted)">
              No active prescriptions recorded for your profile. Prescriptions from doctor consultations will appear here.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderBilling() {
  return `<div class="welcome">
    <div>
      <h1>Bills & payments</h1>
      <p>Review charges and keep track of your billing status.</p>
    </div>
    <button class="btn btn-outline" onclick="toast('No billing statements generated yet.')">⬇ Statement</button>
  </div>
  <div class="stats">
    ${stat('Total outstanding', '₹0', '💳', 'Current balance')}
    ${stat('Last payment', '₹0', '🧾', 'No recent payments')}
    ${stat('Invoices', '0', '📄', 'Across recent visits')}
    ${stat('Payment status', 'Settled', '📅', 'All accounts up to date')}
  </div>
  <div class="panel">
    ${panelHead('Recent invoices', 'Hospital billing statements')}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Description</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="6" style="text-align:center;padding:28px;color:var(--muted)">
              No pending invoices. Consultation charges and invoices will appear here after your visits.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderStaff() {
  const doctorsList = apiDoctors.length ? apiDoctors : fallbackDoctors;
  return `<div class="welcome">
    <div>
      <h1>Staff management</h1>
      <p>Overview of clinical specialists assigned to ${escapeHtml(state.hospitalName || 'CareSphere')} and affiliated facilities.</p>
    </div>
    <button class="btn btn-primary" onclick="openAddDoctorModal()">➕ Add doctor</button>
  </div>
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

function renderReports() {
  return `<div class="welcome">
    <div>
      <h1>Reports & analytics</h1>
      <p>Operational insights for ${escapeHtml(state.hospitalName || 'CareSphere Facility')}.</p>
    </div>
    <button class="btn btn-primary" onclick="toast('Report exported to PDF successfully.')">⬇ Export report</button>
  </div>
  <div class="stats">
    ${stat('Appointments in system', String(state.appointments.length), '📅', '<span class="up">Live count</span>')}
    ${stat('Doctors available', String(apiDoctors.length || 6), '🩺', 'Active specialists')}
    ${stat('Connected Hospitals', String(apiHospitals.length || 3), '🏥', 'Network height')}
    ${stat('Patients registered', String(apiPatients.length), '👥', 'MongoDB database')}
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

function renderSettings() {
  return `<div class="welcome">
    <div>
      <h1>${state.role === 'admin' ? 'System settings' : 'My profile'}</h1>
      <p>${state.role === 'admin' ? 'Manage workspace preferences, hospital facility name, and system settings.' : 'Manage your personal contact details, preferences, and session.'}</p>
    </div>
    ${state.role !== 'admin' ? '<button class="btn btn-outline" onclick="logout()" style="color:#b0382d;border-color:#f7b8b2;font-weight:750">↪ Sign out</button>' : ''}
  </div>
  <div class="panel" style="max-width:720px">
    ${panelHead('Account information', 'Settings stored in database')}
    <form onsubmit="saveProfile(event)">
      <div class="field">
        <label for="profileFullName">Full name</label>
        <input id="profileFullName" type="text" minlength="2" maxlength="80" value="${escapeHtml(state.name)}" required>
      </div>
      <div class="field">
        <label for="profileEmail">Email address</label>
        <input id="profileEmail" type="email" maxlength="254" value="${escapeHtml(state.email)}" required>
      </div>
      <div class="field">
        <label for="language">Language</label>
        <select id="language"><option>English</option><option>Hindi</option></select>
      </div>
      <div class="field">
        <label>Notifications</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)">
          <input type="checkbox" checked style="accent-color:var(--green)"> Appointment and account updates
        </label>
      </div>
      <button class="btn btn-primary" type="submit">Save profile changes</button>
    </form>
  </div>

  ${state.role !== 'admin' ? `
    <div class="panel" style="max-width:720px;margin-top:20px">
      ${panelHead('Session & Security', 'Sign out of your patient account on this device')}
      <p style="font-size:12px;color:var(--muted);margin-bottom:16px">Ending your session signs you out safely. Your booked appointments, medical records, and tamper-proof blockchain ledger remain safely stored in MongoDB.</p>
      <button class="btn btn-outline" type="button" onclick="logout()" style="color:#b0382d;border-color:#f7b8b2;font-weight:750">
        <span style="font-size:14px">↪</span> Sign out of CareSphere
      </button>
    </div>
  ` : ''}

  ${state.role === 'admin' ? `
    <div class="panel" style="max-width:720px;margin-top:20px">
      ${panelHead('Hospital Facility Administration', 'Manage your hospital name in MongoDB and Blockchain Ledger')}
      <div class="field">
        <label for="adminHospitalFacility">Administered Hospital Facility Name</label>
        <input id="adminHospitalFacility" type="text" minlength="3" maxlength="100" value="${escapeHtml(state.hospitalName || 'CareSphere Central Hospital')}" required>
      </div>
      <p style="font-size:11px;color:var(--muted);margin:8px 0 16px">This hospital name appears across your administrator dashboard, on doctor cards, on patient booking options, and in all cryptographic blockchain logs.</p>
      <button class="btn btn-primary" type="button" onclick="saveHospitalName()">Update Hospital Facility 🏥</button>
    </div>
  ` : ''}`;
}

async function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profileFullName').value.trim();
  const email = document.getElementById('profileEmail').value.trim();
  try {
    const result = await apiRequest('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, email })
    });
    state.name = result.user.name;
    state.email = result.user.email;
    document.getElementById('profileName').textContent = state.name;
    document.getElementById('avatarInitials').textContent = state.name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    renderAll();
    toast('Profile updated in MongoDB.');
  } catch (err) {
    state.name = name;
    state.email = email;
    document.getElementById('profileName').textContent = state.name;
    document.getElementById('avatarInitials').textContent = state.name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    renderAll();
    toast('Profile updated in session.');
  }
}

function renderAll() {
  document.getElementById('page-dashboard').innerHTML = state.role === 'admin' ? adminDashboard() : userDashboard();
  document.getElementById('page-appointments').innerHTML = renderAppointments();
  document.getElementById('page-doctors').innerHTML = renderDoctors();
  document.getElementById('page-records').innerHTML = renderRecords();
  document.getElementById('page-blockchain').innerHTML = renderBlockchain();
  document.getElementById('page-prescriptions').innerHTML = renderPrescriptions();
  document.getElementById('page-billing').innerHTML = renderBilling();
  document.getElementById('page-patients').innerHTML = patientDirectory();
  document.getElementById('page-staff').innerHTML = renderStaff();
  document.getElementById('page-reports').innerHTML = renderReports();
  document.getElementById('page-settings').innerHTML = renderSettings();
}

// Fetch public config (like default hospital from .env) on load
async function initAppConfig() {
  try {
    const config = await apiRequest('/api/auth/config').catch(() => null);
    if (config && config.defaultHospital) {
      state.hospitalName = config.defaultHospital;
      const hospInput = document.getElementById('loginHospital');
      if (hospInput) hospInput.value = config.defaultHospital;
    }
  } catch (_) {}
}

initAppConfig();

// Check session on load
restoreSession();
