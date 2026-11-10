// HTTP API Client & Data Synchronization
import { state, runtime, fallbackDoctors } from './state.js';

export async function apiRequest(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = localStorage.getItem('caresphere_token');
  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers,
    ...options
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function cleanPatientName(name) {
  if (!name || typeof name !== 'string') return 'Patient';
  return name.replace(/\s*[-—(]\s*(CareSphere|Apollo|Metro|Hospital|Clinic|Healthcare).*$/i, '').trim() || name;
}

export function formatAppointmentDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export async function refreshBackendData() {
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
  runtime.apiDoctors = (doctorData.doctors && doctorData.doctors.length > 0) ? doctorData.doctors : fallbackDoctors;
  runtime.apiPatients = patientData.patients || [];
  runtime.apiReports = (reportData.reports || []).map(r => ({
    id: String(r.id),
    userId: String(r.userId || ''),
    patientName: cleanPatientName(r.patientName || 'Patient'),
    patientEmail: r.patientEmail || '',
    hospitalName: r.hospitalName || 'CareSphere Central Hospital',
    uploadedByRole: r.uploadedByRole || 'hospital',
    uploadedByName: r.uploadedByName || 'CareSphere Staff',
    original_name: r.original_name,
    mime_type: r.mime_type,
    file_size: r.file_size,
    status: r.status || 'Sealed',
    category: r.category || 'Diagnostic Report',
    documentHash: r.documentHash || '',
    blockIndex: r.blockIndex || 1,
    created_at: r.created_at
  }));
  runtime.apiBlocks = blockchainData.blocks || [];
  if (hospitalData.hospitals && hospitalData.hospitals.length > 0) {
    runtime.apiHospitals = hospitalData.hospitals.map(h => h.name);
  }
}
