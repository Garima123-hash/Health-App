/**
 * CareSphere Enterprise Healthcare Portal & Cryptographic Blockchain
 * Root Application Entry Point (ES Module)
 */

import { state, runtime, fallbackDoctors, userNav, adminNav } from './state.js';
import { apiRequest, refreshBackendData, cleanPatientName, formatAppointmentDate } from './api.js';
import { escapeHtml, toast, stat, panelHead, quick, chart, toLocalDateTimeValue } from './components/ui.js';

import {
  openAuth,
  closeAuth,
  setRole,
  showAuthError,
  toggleAuthMode,
  submitAuth,
  enterDashboard,
  logout,
  restoreSession
} from './modules/auth.js';

import {
  userDashboard,
  adminDashboard,
  showNotifications
} from './modules/dashboard.js';

import {
  appointmentsTable,
  updateAppointmentStatus,
  openStatusModal,
  closeStatusModal,
  submitStatusModal,
  appointmentAction,
  renderAppointments,
  applyAppointmentFilters,
  filterTable,
  filterStatus,
  bookAppointment,
  onBookingHospitalChange,
  closeBooking,
  toggleOtherReason,
  submitAppointment
} from './modules/appointments.js';

import {
  backendDoctorCards,
  renderDoctors,
  filterDoctors,
  filterDoctorHospital,
  filterDepartment,
  applyDoctorFilters,
  selectAdminHospital,
  openAddDoctorModal,
  closeAddDoctorModal,
  submitAddDoctor
} from './modules/doctors.js';

import {
  openPatientRecordsModal,
  closePatientRecordsModal,
  renderPatientRecordsModalContent,
  submitPatientModalReport,
  openAdminUploadReportModal,
  closeAdminUploadReportModal,
  submitAdminStandaloneReport,
  uploadReportFile,
  explainReportInSimpleLanguage,
  verifyMedicalRecord,
  renderRecords
} from './modules/records.js';

import {
  renderBlockchain,
  verifyBlockchain,
  simulateTamper,
  repairBlockchain
} from './modules/blockchain.js';

import {
  fetchWomensHealth,
  renderWomensHealth,
  toggleWomensConsent,
  saveWomensMood,
  saveWomensCycle,
  searchWomensGuide,
  deleteWomensHealthData
} from './modules/womensHealth.js';

import { renderBilling } from './modules/billing.js';

import {
  patientDirectory,
  addPatient,
  createHospitalAdmin,
  renderStaff,
  renderReports
} from './modules/admin.js';

import {
  renderSettings,
  saveProfile,
  saveHospitalName
} from './modules/settings.js';

import {
  toggleSidebar,
  buildNav,
  go,
  renderAll
} from './modules/navigation.js';

// Expose functions globally to maintain full backwards compatibility with HTML inline event handlers
const globalExports = {
  // State & Data
  state,
  runtime,
  fallbackDoctors,
  userNav,
  adminNav,
  apiRequest,
  refreshBackendData,
  cleanPatientName,
  formatAppointmentDate,

  // UI Utilities
  escapeHtml,
  toast,
  stat,
  panelHead,
  quick,
  chart,
  toLocalDateTimeValue,

  // Auth & Session
  openAuth,
  closeAuth,
  setRole,
  showAuthError,
  toggleAuthMode,
  submitAuth,
  login: submitAuth, // Alias for onsubmit="login(event)" in index.html
  enterDashboard,
  logout,
  restoreSession,

  // Dashboards & Notifications
  userDashboard,
  adminDashboard,
  showNotifications,

  // Appointments
  appointmentsTable,
  updateAppointmentStatus,
  openStatusModal,
  closeStatusModal,
  submitStatusModal,
  appointmentAction,
  renderAppointments,
  applyAppointmentFilters,
  filterTable,
  filterStatus,
  bookAppointment,
  onBookingHospitalChange,
  closeBooking,
  toggleOtherReason,
  submitAppointment,

  // Doctors
  backendDoctorCards,
  renderDoctors,
  filterDoctors,
  filterDoctorHospital,
  filterDepartment,
  applyDoctorFilters,
  selectAdminHospital,
  openAddDoctorModal,
  closeAddDoctorModal,
  submitAddDoctor,

  // Records & Vault
  openPatientRecordsModal,
  closePatientRecordsModal,
  renderPatientRecordsModalContent,
  submitPatientModalReport,
  openAdminUploadReportModal,
  closeAdminUploadReportModal,
  submitAdminStandaloneReport,
  uploadReportFile,
  explainReportInSimpleLanguage,
  verifyMedicalRecord,
  renderRecords,

  // Blockchain Ledger
  renderBlockchain,
  verifyBlockchain,
  simulateTamper,
  repairBlockchain,

  // Women's Health & PCOS
  fetchWomensHealth,
  renderWomensHealth,
  toggleWomensConsent,
  saveWomensMood,
  saveWomensCycle,
  searchWomensGuide,
  deleteWomensHealthData,

  // Prescriptions & Billing
  renderBilling,

  // Admin & Settings
  patientDirectory,
  addPatient,
  createHospitalAdmin,
  renderStaff,
  renderReports,
  renderSettings,
  saveProfile,
  saveHospitalName,

  // Navigation
  toggleSidebar,
  buildNav,
  go,
  renderAll
};

Object.assign(window, globalExports);

async function initAppConfig() {
  const config = await apiRequest('/api/auth/config').catch(() => null);
  if (config?.defaultHospital) state.hospitalName = config.defaultHospital;
}

// Bootstrap Application
initAppConfig();
restoreSession();
