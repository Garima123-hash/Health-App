// Authentication & Session Management Module
import { state, runtime } from '../state.js';
import { apiRequest, refreshBackendData, cleanPatientName } from '../api.js';
import { toast, escapeHtml } from '../components/ui.js';

export function openAuth(role = 'user') {
  setRole(role);
  if (role === 'admin' && runtime.authMode === 'register') {
    toggleAuthMode();
  }
  document.getElementById('authOverlay').classList.remove('hidden');
  showAuthError('');
}

export function closeAuth() {
  document.getElementById('authOverlay').classList.add('hidden');
  document.getElementById('authError').classList.add('hidden');
  document.getElementById('authError').textContent = '';
  if (runtime.authMode === 'register') {
    runtime.authMode = 'login';
    const note = document.getElementById('authModeNote');
    if (note) note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
  }
  showAuthError('');
}

export function setRole(role) {
  state.role = role;
  document.getElementById('roleUser').classList.toggle('active', role === 'user');
  document.getElementById('roleAdmin').classList.toggle('active', role === 'admin');

  const hospGroup = document.getElementById('hospitalSelectGroup');
  const hospSelect = document.getElementById('loginHospital');
  const hospLabel = document.getElementById('loginHospitalLabel');
  const nameField = document.getElementById('registerNameField');
  const toggleBtn = document.querySelector('#authModeNote button');

  if (role === 'admin') {
    if (runtime.authMode === 'register') {
      toggleAuthMode();
    }
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (nameField) nameField.classList.add('hidden');
    if (hospGroup) hospGroup.classList.remove('hidden');
    if (hospLabel) hospLabel.innerHTML = 'Assign Hospital Facility <span style="font-weight:400;font-size:11px;color:var(--muted)">(Updates .env &amp; Workspace)</span>';
    if (hospSelect) hospSelect.placeholder = 'e.g. CareSphere Central Hospital';
    const note = document.getElementById('authModeNote');
    if (note) note.innerHTML = '<small style="color:var(--muted)">Administrator authentication grants access to hospital governance, doctor rosters, patient records, and tamper-proof ledger auditing.</small>';
  } else {
    if (toggleBtn) toggleBtn.style.display = 'inline-block';
    if (runtime.authMode === 'register' && nameField) {
      nameField.classList.remove('hidden');
    }
    if (hospGroup) hospGroup.classList.remove('hidden');
    if (hospLabel) hospLabel.textContent = 'Preferred Hospital';
    if (hospSelect) hospSelect.placeholder = 'CareSphere Central Hospital';
    const note = document.getElementById('authModeNote');
    if (note && runtime.authMode === 'login') {
      note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
    }
  }
  showAuthError('');
}

export function showAuthError(message) {
  const el = document.getElementById('authError');
  if (!el) return;
  if (!message) {
    el.textContent = '';
    el.classList.add('hidden');
    return;
  }
  el.textContent = message;
  el.classList.remove('hidden');
}

export function toggleAuthMode() {
  runtime.authMode = runtime.authMode === 'login' ? 'register' : 'login';
  const heading = document.querySelector('.auth-heading');
  const sub = document.querySelector('.auth-sub');
  const submit = document.getElementById('authSubmit');
  const nameField = document.getElementById('registerNameField');
  const note = document.getElementById('authModeNote');

  if (runtime.authMode === 'register') {
    if (nameField) {
      nameField.classList.remove('hidden');
      nameField.id = 'registerNameField';
    }
    if (heading) heading.textContent = 'Create patient account';
    if (sub) sub.textContent = 'Register your personal health portal on CareSphere';
    if (submit) submit.textContent = 'Register account';
    const hospLabel = document.getElementById('loginHospitalLabel');
    if (hospLabel) hospLabel.textContent = 'Primary Hospital';
    const hospInput = document.getElementById('loginHospital');
    if (hospInput && !hospInput.value) hospInput.value = state.hospitalName || 'CareSphere Central Hospital';
    const roleAdminBtn = document.getElementById('roleAdmin');
    if (roleAdminBtn) roleAdminBtn.style.display = 'none';
    setRole('user');
    note.innerHTML = '<span>Already registered?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Sign in</button><br><small>Password must contain at least 4 characters.</small>';
  } else {
    if (nameField) nameField.classList.add('hidden');
    if (heading) heading.textContent = 'Sign in to CareSphere';
    if (sub) sub.textContent = 'Access your digital medical records and appointments';
    if (submit) submit.textContent = 'Sign in';
    const hospLabel = document.getElementById('loginHospitalLabel');
    if (hospLabel) hospLabel.textContent = state.role === 'admin' ? 'Assign Hospital Facility' : 'Hospital location';
    const roleAdminBtn = document.getElementById('roleAdmin');
    if (roleAdminBtn) roleAdminBtn.style.display = 'inline-block';
    note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
  }
  showAuthError('');
}

export async function submitAuth(event) {
  event.preventDefault();
  showAuthError('');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const hospitalName = document.getElementById('loginHospital')?.value.trim() || state.hospitalName || 'CareSphere Central Hospital';
  const submit = document.getElementById('authSubmit');
  submit.disabled = true;

  try {
    let result;
    if (runtime.authMode === 'register') {
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

    if (result.token || result.accessToken) {
      localStorage.setItem('caresphere_token', result.token || result.accessToken);
    }
    if (result.user) {
      localStorage.setItem('caresphere_user', JSON.stringify(result.user));
    }

    state.email = result.user.email;
    state.name = result.user.name;
    state.role = result.user.role === 'admin' ? 'admin' : 'user';
    state.hospitalName = result.user.hospital_name || hospitalName || 'CareSphere Central Hospital';
    await enterDashboard();
    if (state.role === 'admin' && hospitalName) {
      toast(`Signed in as Administrator • Hospital set to "${state.hospitalName}" (.env updated)!`);
    } else {
      toast(runtime.authMode === 'register' ? `Account registered for ${state.name}!` : `Welcome back, ${state.name}!`);
    }
  } catch (err) {
    console.error('Authentication error:', err.message);
    showAuthError(err.message || 'Authentication error. Please check your credentials.');
  } finally {
    submit.disabled = false;
  }
}

export async function enterDashboard() {
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

  if (typeof window.buildNav === 'function') window.buildNav();
  if (typeof window.renderAll === 'function') window.renderAll();
  if (typeof window.go === 'function') window.go('dashboard');
}

export async function logout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' });
  } catch (err) {
    console.warn('Sign-out request failed:', err.message);
  }
  localStorage.removeItem('caresphere_token');
  localStorage.removeItem('caresphere_user');
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

  // Close modals
  if (typeof window.closeBooking === 'function') window.closeBooking();
  if (typeof window.closeStatusModal === 'function') window.closeStatusModal();
  if (typeof window.closeAddDoctorModal === 'function') window.closeAddDoctorModal();

  document.getElementById('app').classList.add('hidden');
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('sidebar').classList.remove('open');
  state.page = 'dashboard';
  toast('Signed out successfully.');
}

export async function restoreSession() {
  try {
    let result = await apiRequest('/api/auth/me').catch(() => null);
    if (!result || !result.user) {
      result = await apiRequest('/api/auth/refresh', { method: 'POST', body: '{}' }).catch(() => null);
      if (result && (result.token || result.accessToken)) {
        localStorage.setItem('caresphere_token', result.token || result.accessToken);
      }
    }
    if (result && result.user) {
      state.email = result.user.email;
      state.name = result.user.name;
      state.role = result.user.role === 'admin' ? 'admin' : 'user';
      state.hospitalName = result.user.hospital_name || 'CareSphere Central Hospital';
      localStorage.setItem('caresphere_user', JSON.stringify(result.user));
      await enterDashboard();
    } else {
      localStorage.removeItem('caresphere_token');
      localStorage.removeItem('caresphere_user');
    }
  } catch (err) {
    console.warn('Session restore unavailable:', err.message);
  }
}
