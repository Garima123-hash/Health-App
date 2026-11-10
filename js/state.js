// Application State & Shared Constants

export const fallbackDoctors = [
  { id: '1', name: 'Dr. Ananya Mehta', specialty: 'Cardiology', experience: '12 years experience', hospital_name: 'CareSphere Central Hospital', symbol: '🫀' },
  { id: '2', name: 'Dr. Rahul Kapoor', specialty: 'General Medicine', experience: '9 years experience', hospital_name: 'CareSphere Central Hospital', symbol: '🩺' },
  { id: '3', name: 'Dr. Priya Nair', specialty: 'Dermatology', experience: '8 years experience', hospital_name: 'CareSphere Central Hospital', symbol: '🔬' },
  { id: '4', name: 'Dr. Vikram Rao', specialty: 'Orthopaedics', experience: '15 years experience', hospital_name: 'Apollo Multi-Specialty Hospital', symbol: '🦴' },
  { id: '5', name: 'Dr. Sana Khan', specialty: 'Paediatrics', experience: '10 years experience', hospital_name: 'Apollo Multi-Specialty Hospital', symbol: '👶' },
  { id: '6', name: 'Dr. Arjun Das', specialty: 'Neurology', experience: '11 years experience', hospital_name: 'Metro City Healthcare', symbol: '🧠' }
];

export const state = {
  page: 'dashboard',
  role: 'user', // 'user' (patient) or 'admin'
  isSuperAdmin: false,
  name: 'Patient',
  email: '',
  gender: 'unspecified',
  themeGender: 'unspecified',
  hospitalName: 'CareSphere Central Hospital',
  appointments: []
};

export const runtime = {
  authMode: 'login',
  apiDoctors: [],
  apiPatients: [],
  apiReports: [],
  adminHospitals: [],
  hospitalAdmins: [],
  recordVerifications: {},
  apiBlocks: [],
  apiHospitals: [
    'CareSphere Central Hospital',
    'Apollo Multi-Specialty Hospital',
    'Metro City Healthcare'
  ],
  blockchainValidation: { isValid: null, length: 0, brokenBlockIndex: null },
  appointmentSearch: '',
  appointmentStatus: 'all',
  doctorSearch: '',
  doctorDepartment: 'all',
  doctorHospital: 'all',
  womensHealthData: null,
  womensHealthAnswer: null
};

export const userNav = [
  ['dashboard', '📊', 'Overview'],
  ['appointments', '📅', 'My appointments'],
  ['doctors', '👨‍⚕️', 'Find a doctor'],
  ['records', '📄', 'Health records'],
  ['blockchain', '⛓️', 'Record protection'],
  ['womens-health', '🌸', "Women's Health"],
  ['billing', '💳', 'Bills & payments'],
  ['settings', '⚙️', 'My profile']
];

export const adminNav = [
  ['dashboard', '📊', 'Overview'],
  ['appointments', '📅', 'Appointments'],
  ['patients', '👥', 'Patients'],
  ['doctors', '👨‍⚕️', 'Doctors & departments'],
  ['records', '📄', 'Medical records & integrity'],
  ['blockchain', '⛓️', 'Blockchain Ledger'],
  ['staff', '🩺', 'Staff management'],
  ['reports', '📈', 'Reports & analytics'],
  ['settings', '⚙️', 'System settings']
];
