// Settings Module: Profile Customization & Admin Hospital Facility Configuration
import { state, runtime } from '../state.js';
import { apiRequest, refreshBackendData } from '../api.js';
import { escapeHtml, toast, panelHead } from '../components/ui.js';

export function renderSettings() {
  return `<div class="welcome">
    <div>
      <h1>${state.role === 'admin' ? 'System settings' : 'My profile'}</h1>
      <p>${state.role === 'admin' ? 'Manage workspace preferences, hospital facility name, and system settings.' : 'Manage your personal contact details and preferences.'}</p>
    </div>
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
      ${state.role !== 'admin' ? `<div class="field">
        <label for="profileGender">Gender</label>
        <select id="profileGender" required>
          <option value="unspecified" ${state.gender === 'unspecified' ? 'selected' : ''}>Not specified</option>
          <option value="female" ${state.gender === 'female' ? 'selected' : ''}>Female</option>
          <option value="male" ${state.gender === 'male' ? 'selected' : ''}>Male</option>
          <option value="non_binary" ${state.gender === 'non_binary' ? 'selected' : ''}>Non-binary</option>
          <option value="prefer_not_to_say" ${state.gender === 'prefer_not_to_say' ? 'selected' : ''}>Prefer not to say</option>
        </select>
      </div>` : ''}
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

export async function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profileFullName')?.value?.trim();
  const email = document.getElementById('profileEmail')?.value?.trim();
  const gender = state.role !== 'admin' ? document.getElementById('profileGender')?.value : undefined;
  try {
    const result = await apiRequest('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, email, ...(gender ? { gender } : {}) })
    });
    state.name = result.user.name;
    state.email = result.user.email;
    state.gender = result.user.gender || state.gender;
    const themePreference = localStorage.getItem('caresphere_theme_gender');
    if (state.role !== 'admin' && themePreference !== 'female' && themePreference !== 'male') {
      state.themeGender = state.gender;
    }
    if (gender) {
      runtime.womensHealthData = null;
      runtime.womensHealthAnswer = null;
    }
    const appEl = document.getElementById('app');
    if (appEl) appEl.dataset.gender = state.themeGender;
    const pName = document.getElementById('profileName');
    if (pName) pName.textContent = state.name;
    const aInit = document.getElementById('avatarInitials');
    if (aInit) aInit.textContent = state.name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.buildNav === 'function') window.buildNav();
    if (gender && state.gender === 'female' && typeof window.fetchWomensHealth === 'function') {
      await window.fetchWomensHealth();
      if (typeof window.renderAll === 'function') window.renderAll();
    }
    toast('Profile updated in MongoDB.');
  } catch (err) {
    if (name) state.name = name;
    if (email) state.email = email;
    const pName = document.getElementById('profileName');
    if (pName) pName.textContent = state.name;
    const aInit = document.getElementById('avatarInitials');
    if (aInit) aInit.textContent = state.name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    if (typeof window.renderAll === 'function') window.renderAll();
    toast('Profile updated in session.');
  }
}

export async function saveHospitalName() {
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
    if (typeof window.renderAll === 'function') window.renderAll();
    toast(`Hospital facility updated to "${state.hospitalName}" and recorded to Blockchain!`);
  } catch (err) {
    console.error('Update hospital error:', err.message);
    toast(err.message || 'Could not update hospital facility.');
  }
}
