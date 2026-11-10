// Navigation & Page Orchestration Module
import { state, userNav, adminNav } from '../state.js';
import { escapeHtml } from '../components/ui.js';
import { adminDashboard, userDashboard } from './dashboard.js';
import { renderAppointments } from './appointments.js';
import { renderDoctors } from './doctors.js';
import { renderRecords } from './records.js';
import { renderBlockchain } from './blockchain.js';
import { renderWomensHealth } from './womensHealth.js';
import { renderBilling } from './billing.js';
import { patientDirectory, renderStaff, renderReports } from './admin.js';
import { renderSettings } from './settings.js';

export function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('open');
}

export function buildNav() {
  const nav = state.role === 'admin'
    ? adminNav
    : userNav.filter(([id]) => id !== 'womens-health' || state.gender === 'female');
  let html = nav.map(([id, ico, label]) =>
    `<button class="nav-item ${state.page === id ? 'active' : ''}" onclick="go('${id}')"><span class="nav-ico">${ico}</span>${escapeHtml(label)}</button>`
  ).join('');
  const navContainer = document.getElementById('navItems');
  if (navContainer) navContainer.innerHTML = html;
}

export function go(page) {
  if (page === 'womens-health' && (state.role !== 'user' || state.gender !== 'female')) {
    page = 'dashboard';
  }
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
    'womens-health': "Women's Health & PCOS Companion",
    billing: 'Bills & payments',
    patients: 'Patients',
    staff: 'Staff management',
    reports: 'Reports & analytics',
    settings: state.role === 'admin' ? 'System settings' : 'My profile'
  };

  const topTitle = document.getElementById('topPage');
  if (topTitle) topTitle.textContent = titles[page] || 'Overview';
  buildNav();
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('open');
}

export function renderAll() {
  const pDash = document.getElementById('page-dashboard');
  if (pDash) pDash.innerHTML = state.role === 'admin' ? adminDashboard() : userDashboard();
  const pAppt = document.getElementById('page-appointments');
  if (pAppt) pAppt.innerHTML = renderAppointments();
  const pDoc = document.getElementById('page-doctors');
  if (pDoc) pDoc.innerHTML = renderDoctors();
  const pRec = document.getElementById('page-records');
  if (pRec) pRec.innerHTML = renderRecords();
  const pBc = document.getElementById('page-blockchain');
  if (pBc) pBc.innerHTML = renderBlockchain();
  const whEl = document.getElementById('page-womens-health');
  if (whEl) whEl.innerHTML = renderWomensHealth();
  const pBill = document.getElementById('page-billing');
  if (pBill) pBill.innerHTML = renderBilling();
  const pPat = document.getElementById('page-patients');
  if (pPat) pPat.innerHTML = patientDirectory();
  const pStaff = document.getElementById('page-staff');
  if (pStaff) pStaff.innerHTML = renderStaff();
  const pRep = document.getElementById('page-reports');
  if (pRep) pRep.innerHTML = renderReports();
  const pSet = document.getElementById('page-settings');
  if (pSet) pSet.innerHTML = renderSettings();
}
