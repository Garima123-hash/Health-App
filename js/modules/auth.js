// Authentication & Session Management Module
import { state, runtime } from '../state.js';
import { apiRequest, refreshBackendData, cleanPatientName } from '../api.js';
import { toast, escapeHtml } from '../components/ui.js';

export function openAuth(role = 'user') {
  setRole(role);
  if (role === 'admin' && runtime.authMode === 'register') {
    toggleAuthMode();
  }
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.classList.remove('hidden');
  showAuthError('');
}

export function closeAuth() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.classList.add('hidden');
  const nameField = document.getElementById('registerNameField');
  if (nameField) nameField.remove();
  if (runtime.authMode === 'register') {
    runtime.authMode = 'login';
    const note = document.getElementById('authModeNote');
    if (note) note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
    const form = document.getElementById('loginForm');
    const button = form ? form.querySelector('button[type="submit"]') : null;
    if (button) button.textContent = 'Sign in securely →';
    const heading = document.querySelector('.auth-heading');
    if (heading) heading.textContent = 'Welcome back';
    const sub = document.querySelector('.auth-sub');
    if (sub) sub.textContent = 'Sign in to continue to your personalised healthcare workspace.';
    const roleAdminBtn = document.getElementById('roleAdmin');
    if (roleAdminBtn) roleAdminBtn.disabled = false;
  }
  showAuthError('');
}

export function setRole(role) {
  state.role = role;
  const userBtn = document.getElementById('roleUser');
  if (userBtn) userBtn.classList.toggle('active', role === 'user');
  const adminBtn = document.getElementById('roleAdmin');
  if (adminBtn) adminBtn.classList.toggle('active', role === 'admin');

  const hospField = document.getElementById('loginHospitalField');
  const hospLabel = document.getElementById('loginHospitalLabel');
  const hospBadge = document.getElementById('loginHospitalBadge');
  const hospNote = document.getElementById('loginHospitalNote');
  const hospInput = document.getElementById('loginHospital');
  const note = document.getElementById('authModeNote');

  if (role === 'admin') {
    if (runtime.authMode === 'register') {
      toggleAuthMode();
    }
    const nameField = document.getElementById('registerNameField');
    if (nameField) nameField.remove();
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
    if (note && runtime.authMode === 'login') {
      note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
    }
  }
  showAuthError('');
}

export function showAuthError(message) {
  const el = document.getElementById('loginError') || document.getElementById('authError');
  if (!el) return;
  el.textContent = message || '';
  if (!message) {
    el.classList.add('hidden');
  } else {
    el.classList.remove('hidden');
  }
}

export function toggleAuthMode() {
  runtime.authMode = runtime.authMode === 'login' ? 'register' : 'login';
  const heading = document.querySelector('.auth-heading');
  const sub = document.querySelector('.auth-sub');
  const form = document.getElementById('loginForm');
  const button = form ? form.querySelector('button[type="submit"]') : (document.getElementById('authSubmit') || document.querySelector('button[type="submit"]'));
  const note = document.getElementById('authModeNote');
  let nameField = document.getElementById('registerNameField');

  if (runtime.authMode === 'register') {
    if (!nameField && form) {
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
    if (nameField) nameField.classList.remove('hidden');
    const pwdInput = document.getElementById('password');
    if (pwdInput) {
      pwdInput.minLength = 4;
      pwdInput.autocomplete = 'new-password';
    }
    if (heading) heading.textContent = 'Create your account';
    if (sub) sub.textContent = 'Register to save appointments and seal medical records on the blockchain.';
    if (button) button.textContent = 'Create account →';
    if (note) note.innerHTML = '<span>Already registered?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Sign in</button><br><small>Password must contain at least 4 characters.</small>';
    const roleAdminBtn = document.getElementById('roleAdmin');
    if (roleAdminBtn) roleAdminBtn.disabled = true;
    setRole('user');
  } else {
    if (nameField) {
      nameField.remove();
    }
    const pwdInput = document.getElementById('password');
    if (pwdInput) {
      pwdInput.minLength = 4;
      pwdInput.autocomplete = 'current-password';
    }
    if (heading) heading.textContent = 'Welcome back';
    if (sub) sub.textContent = 'Sign in to continue to your personalised healthcare workspace.';
    if (button) button.textContent = 'Sign in securely →';
    if (note) note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Register your patient profile to begin or sign in as administrator.</small>';
    const roleAdminBtn = document.getElementById('roleAdmin');
    if (roleAdminBtn) roleAdminBtn.disabled = false;
  }
  showAuthError('');
}

export async function submitAuth(event) {
  if (event && event.preventDefault) event.preventDefault();
  showAuthError('');
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passInput ? passInput.value : '';
  const hospitalName = document.getElementById('loginHospital')?.value?.trim() || state.hospitalName || 'CareSphere Central Hospital';
  const form = document.getElementById('loginForm');
  const submit = form ? form.querySelector('button[type="submit"]') : (document.getElementById('authSubmit') || document.querySelector('button[type="submit"]'));
  if (submit) submit.disabled = true;

  try {
    let result;
    if (runtime.authMode === 'register') {
      const name = document.getElementById('registerName')?.value?.trim() || '';
      if (!name || name.length < 2) {
        showAuthError('Please enter your full name (at least 2 characters).');
        if (submit) submit.disabled = false;
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
    if (submit) submit.disabled = false;
  }
}

export const login = submitAuth;

export async function enterDashboard() {
  closeAuth();
  const landingEl = document.getElementById('landing');
  if (landingEl) landingEl.classList.add('hidden');
  const appEl = document.getElementById('app');
  if (appEl) appEl.classList.remove('hidden');

  const displayName = state.role === 'admin' ? state.name : cleanPatientName(state.name);
  const pName = document.getElementById('profileName');
  if (pName) pName.textContent = displayName;
  const pRole = document.getElementById('profileRole');
  if (pRole) pRole.textContent = state.role === 'admin' ? `Administrator • ${state.hospitalName || 'CareSphere'}` : 'Patient account';
  const aInit = document.getElementById('avatarInitials');
  if (aInit) aInit.textContent = displayName.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

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

  const appEl = document.getElementById('app');
  if (appEl) appEl.classList.add('hidden');
  const landingEl = document.getElementById('landing');
  if (landingEl) landingEl.classList.remove('hidden');
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('open');
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
