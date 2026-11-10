// Doctors Module: Specialist Directory, Search & Filtering, and Onboarding Modal
import { state, runtime, fallbackDoctors } from '../state.js';
import { apiRequest, refreshBackendData } from '../api.js';
import { escapeHtml, toast } from '../components/ui.js';

export function backendDoctorCards(items) {
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

export function renderDoctors() {
  runtime.doctorSearch = '';
  runtime.doctorDepartment = 'all';
  runtime.doctorHospital = 'all';
  const doctorsList = runtime.apiDoctors.length ? runtime.apiDoctors : fallbackDoctors;
  const specialties = [...new Set(doctorsList.map(doctor => doctor.specialty))];
  const hospitalsList = runtime.apiHospitals.length ? runtime.apiHospitals : [...new Set(doctorsList.map(d => d.hospital_name || 'CareSphere Central Hospital'))];

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

export function applyDoctorFilters() {
  const doctorsList = runtime.apiDoctors.length ? runtime.apiDoctors : fallbackDoctors;
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
