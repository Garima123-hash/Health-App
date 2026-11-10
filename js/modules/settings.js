// Settings Module: Profile Customization & Admin Hospital Facility Configuration
import { state } from '../state.js';
import { apiRequest, refreshBackendData } from '../api.js';
import { escapeHtml, toast, panelHead } from '../components/ui.js';

export function renderSettings() {
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

export async function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profileFullName')?.value?.trim();
  const email = document.getElementById('profileEmail')?.value?.trim();
  try {
    const result = await apiRequest('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, email })
    });
    state.name = result.user.name;
    state.email = result.user.email;
    const pName = document.getElementById('profileName');
    if (pName) pName.textContent = state.name;
    const aInit = document.getElementById('avatarInitials');
    if (aInit) aInit.textContent = state.name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    if (typeof window.renderAll === 'function') window.renderAll();
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

