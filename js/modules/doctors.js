// Doctors Module: Specialist Directory, Search & Filtering, and Onboarding Modal
import { state, runtime, fallbackDoctors } from '../state.js';
import { apiRequest, refreshBackendData } from '../api.js';
import { escapeHtml, toast } from '../components/ui.js';

export function backendDoctorCards(items) {
  return items.map(d => {
    const initials = d.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    return `<article class="doctor-card">
    <div class="doctor-photo"><span class="doctor-initials">${escapeHtml(initials)}</span></div>
    <h3>${escapeHtml(d.name)}</h3>
    <p>${escapeHtml(d.specialty)}</p>
    <div class="doctor-meta">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      ${escapeHtml(d.hospital_name || 'CareSphere Central Hospital')}
    </div>
    <div class="doctor-meta">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ${escapeHtml(d.experience || 'Care specialist')}
    </div>
    <div class="doctor-meta">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Available today &middot; Outpatient Clinic
    </div>
    ${state.role === 'admin'
      ? `<button class="btn btn-light full" style="margin-top:12px" onclick="toast('Doctor: ${escapeHtml(d.name)} at ${escapeHtml(d.hospital_name || state.hospitalName)}')">View profile</button>`
      : `<button class="btn btn-primary full" style="margin-top:12px" onclick="bookAppointment('${escapeHtml(d.id)}')">Book appointment</button>`
    }
  </article>`;
  }).join('') || '<div class="empty-state"><strong>No doctors found matching filters.</strong></div>';
}

export function renderDoctors() {
  runtime.doctorSearch = '';
  runtime.doctorDepartment = 'all';
  runtime.doctorHospital = 'all';
  const doctorsList = state.role === 'admin' ? runtime.apiDoctors : (runtime.apiDoctors.length ? runtime.apiDoctors : fallbackDoctors);
  const specialties = [...new Set(doctorsList.map(doctor => doctor.specialty))];
  const hospitalsList = runtime.apiHospitals.length ? runtime.apiHospitals : [...new Set(doctorsList.map(d => d.hospital_name || 'CareSphere Central Hospital'))];
  const activeHospital = runtime.adminHospitals.find(hospital => hospital.name === state.hospitalName);
  const hospitalControl = state.role === 'admin' && state.isSuperAdmin
    ? `<select aria-label="Manage hospital roster" onchange="selectAdminHospital(this.value)">
        ${runtime.adminHospitals.map(hospital => `<option value="${escapeHtml(hospital.id)}" ${String(hospital.id) === String(activeHospital?.id) ? 'selected' : ''}>Manage ${escapeHtml(hospital.name)}</option>`).join('')}
      </select>`
    : state.role === 'admin'
      ? `<span class="status active">${escapeHtml(state.hospitalName)}</span>`
    : `<select onchange="filterDoctorHospital(this.value)" style="font-weight:600">
        <option value="all">All Hospitals</option>
        ${hospitalsList.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('')}
      </select>`;

  return `<div class="welcome">
    <div>
      <h1>${state.role === 'admin' ? 'Doctors & departments' : 'Find your doctor'}</h1>
      <p>${state.role === 'admin' ? `Manage this hospital’s roster. Doctors you add belong only to ${escapeHtml(state.hospitalName)}.` : 'Select a hospital facility and consult with our medical specialists.'}</p>
    </div>
    ${state.role === 'admin' ? `<button class="btn btn-primary" onclick="openAddDoctorModal()">Add Doctor to ${escapeHtml(state.hospitalName)}</button>` : ''}
  </div>
  <div class="searchbar">
    <input placeholder="Search doctors or specialties…" oninput="filterDoctors(this.value)">
    ${hospitalControl}
    <select onchange="filterDepartment(this.value)">
      <option value="all">All specialties</option>
      ${specialties.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
    </select>
  </div>
  <div id="doctorGrid" class="doctor-card-grid">${backendDoctorCards(doctorsList)}</div>`;
}

export function filterDoctors(query) {
  runtime.doctorSearch = query;
  applyDoctorFilters();
}

export function filterDoctorHospital(hospital) {
  runtime.doctorHospital = hospital;
  applyDoctorFilters();
}

export function filterDepartment(department) {
  runtime.doctorDepartment = department;
  applyDoctorFilters();
}

export async function selectAdminHospital(hospitalId) {
  try {
    const result = await apiRequest('/api/admin/hospitals/select', {
      method: 'POST',
      body: JSON.stringify({ hospitalId })
    });
    state.hospitalName = result.hospital.name;
    const storedUser = JSON.parse(localStorage.getItem('caresphere_user') || '{}');
    localStorage.setItem('caresphere_user', JSON.stringify({
      ...storedUser,
      hospital_id: result.hospital.id,
      hospital_name: result.hospital.name
    }));
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    toast(`Now managing ${state.hospitalName}.`);
  } catch (error) {
    console.error('Hospital selection error:', error.message);
    toast(error.message || 'Could not change hospital roster.');
  }
}

export function applyDoctorFilters() {
  const doctorsList = state.role === 'admin' ? runtime.apiDoctors : (runtime.apiDoctors.length ? runtime.apiDoctors : fallbackDoctors);
  const filtered = doctorsList.filter(doctor => {
    const matchesQuery = (doctor.name + ' ' + doctor.specialty + ' ' + (doctor.hospital_name || '')).toLowerCase().includes((runtime.doctorSearch || '').toLowerCase());
    const matchesDept = runtime.doctorDepartment === 'all' || doctor.specialty === runtime.doctorDepartment;
    const matchesHosp = runtime.doctorHospital === 'all' || (doctor.hospital_name || 'CareSphere Central Hospital') === runtime.doctorHospital;
    return matchesQuery && matchesDept && matchesHosp;
  });
  const grid = document.getElementById('doctorGrid');
  if (grid) grid.innerHTML = backendDoctorCards(filtered);
}

export function openAddDoctorModal() {
  const overlay = document.getElementById('addDoctorModalOverlay');
  if (!overlay) return;
  const hospInput = document.getElementById('addDoctorHospital');
  if (hospInput) hospInput.value = state.hospitalName || 'CareSphere Central Hospital';
  const nameInput = document.getElementById('addDoctorName');
  if (nameInput) nameInput.value = '';
  const specInput = document.getElementById('addDoctorSpecialty');
  if (specInput) specInput.value = '';
  const expInput = document.getElementById('addDoctorExperience');
  if (expInput) expInput.value = '10 years experience';
  const errEl = document.getElementById('addDoctorError');
  if (errEl) errEl.textContent = '';

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  if (nameInput) nameInput.focus();
}

export function closeAddDoctorModal() {
  const overlay = document.getElementById('addDoctorModalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

export async function submitAddDoctor(event) {
  event.preventDefault();
  const form = document.getElementById('addDoctorForm');
  const submit = document.getElementById('addDoctorSubmit');
  const error = document.getElementById('addDoctorError');

  const name = form.elements.name.value.trim();
  const specialty = form.elements.specialty.value.trim();
  const experience = form.elements.experience.value.trim() || 'Consultant Specialist';
  const hospital_name = form.elements.hospitalName.value.trim() || state.hospitalName || 'CareSphere Central Hospital';
  const symbol = form.elements.symbol.value || '👨‍⚕️';

  if (error) error.textContent = '';
  if (submit) submit.disabled = true;

  try {
    toast(`Onboarding ${name} to ${hospital_name}...`);
    await apiRequest('/api/admin/doctors', {
      method: 'POST',
      body: JSON.stringify({ name, specialty, experience, hospital_name, symbol })
    });
    closeAddDoctorModal();
    await refreshBackendData();
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.go === 'function') window.go('doctors');
    toast(`Doctor ${name} successfully onboarded to ${hospital_name} & sealed on Blockchain!`);
  } catch (err) {
    console.error('Add doctor error:', err.message);
    if (error) error.textContent = err.message || 'Could not onboard doctor.';
  } finally {
    if (submit) submit.disabled = false;
  }
}
