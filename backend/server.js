require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const multer = require('multer');
const pdfjs = import('pdfjs-dist/legacy/build/pdf.mjs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
// Store uploaded medical reports outside the public frontend.
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'caresphere.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS hospitals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE COLLATE NOCASE,
 city TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'patient' CHECK(role IN ('patient','admin')),
 age INTEGER CHECK(age BETWEEN 0 AND 120),
 hospital_id INTEGER REFERENCES hospitals(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS doctors (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 specialty TEXT NOT NULL,
 experience TEXT NOT NULL DEFAULT '',
 available INTEGER NOT NULL DEFAULT 1,
 hospital_id INTEGER REFERENCES hospitals(id)
);
CREATE TABLE IF NOT EXISTS appointments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 doctor_id INTEGER NOT NULL REFERENCES doctors(id),
 appointment_at TEXT NOT NULL,
 reason TEXT NOT NULL DEFAULT 'Consultation',
 status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Confirmed','Completed','Cancelled')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 original_name TEXT NOT NULL,
 stored_name TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL,
 file_size INTEGER NOT NULL,
 shared_with_hospital INTEGER NOT NULL DEFAULT 0 CHECK(shared_with_hospital IN (0,1)),
 status TEXT NOT NULL DEFAULT 'Uploaded',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS prescriptions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
 medication TEXT NOT NULL,
 directions TEXT NOT NULL,
 refills INTEGER NOT NULL DEFAULT 0 CHECK(refills BETWEEN 0 AND 20),
 status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Completed','Stopped')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 status TEXT NOT NULL DEFAULT 'Due' CHECK(status IN ('Due','Paid')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 paid_at TEXT
);
CREATE INDEX IF NOT EXISTS appointments_user_date ON appointments(user_id, appointment_at);
CREATE INDEX IF NOT EXISTS reports_user_date ON reports(user_id, created_at);
CREATE INDEX IF NOT EXISTS prescriptions_user_date ON prescriptions(user_id, created_at);
CREATE INDEX IF NOT EXISTS invoices_user_date ON invoices(user_id, created_at);
CREATE TABLE IF NOT EXISTS hospital_admins (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,hospital_id)
);
`);

function ensureColumn(table, column, definition) {
 const columns = db.prepare(`PRAGMA table_info(${table})`).all();
 if (!columns.some(item => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('users', 'age', 'INTEGER');
ensureColumn('users', 'hospital_id', 'INTEGER REFERENCES hospitals(id)');
ensureColumn('doctors', 'hospital_id', 'INTEGER REFERENCES hospitals(id)');
ensureColumn('reports', 'shared_with_hospital', 'INTEGER NOT NULL DEFAULT 0');
const defaultHospitalName = cleanEnv(process.env.DEFAULT_HOSPITAL_NAME, 'CareSphere Community Hospital');
db.prepare('INSERT OR IGNORE INTO hospitals(name) VALUES(?)').run(defaultHospitalName);
const defaultHospital = db.prepare('SELECT id FROM hospitals WHERE name=? COLLATE NOCASE').get(defaultHospitalName);
db.prepare('UPDATE users SET hospital_id=? WHERE hospital_id IS NULL').run(defaultHospital.id);
db.prepare('UPDATE doctors SET hospital_id=? WHERE hospital_id IS NULL').run(defaultHospital.id);
db.exec(`CREATE INDEX IF NOT EXISTS doctors_hospital_name ON doctors(hospital_id,name);
CREATE INDEX IF NOT EXISTS users_hospital_role ON users(hospital_id,role);
CREATE INDEX IF NOT EXISTS reports_hospital_share ON reports(user_id,shared_with_hospital);`);
db.prepare(`INSERT OR IGNORE INTO hospital_admins(user_id,hospital_id)
 SELECT id,hospital_id FROM users WHERE role='admin' AND hospital_id IS NOT NULL`).run();

const seedDoctors = [
 ['Dr. Ananya Mehta','Cardiology','12 years experience'],
 ['Dr. Rahul Kapoor','General Medicine','9 years experience'],
 ['Dr. Priya Nair','Dermatology','8 years experience'],
 ['Dr. Vikram Rao','Orthopaedics','15 years experience'],
 ['Dr. Sana Khan','Paediatrics','10 years experience'],
 ['Dr. Arjun Das','Neurology','11 years experience']
];
const addDoctor = db.prepare('INSERT INTO doctors (name,specialty,experience,hospital_id) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name = ? COLLATE NOCASE AND hospital_id = ?)');
for (const [name, specialty, experience] of seedDoctors) addDoctor.run(name, specialty, experience, defaultHospital.id, name, defaultHospital.id);

function cleanEnv(value, fallback) {
 const normalized = typeof value === 'string' ? value.trim().slice(0,120) : '';
 return normalized || fallback;
}

async function seedAdmin() {
 const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
 const password = process.env.ADMIN_PASSWORD || '';
 if (!email || !password) return;
 if (password.length < 12) {
   console.warn('ADMIN_PASSWORD must be at least 12 characters; administrator seed skipped.');
   return;
 }
 const hospitalName = cleanEnv(process.env.ADMIN_HOSPITAL_NAME, defaultHospitalName);
 db.prepare('INSERT OR IGNORE INTO hospitals(name) VALUES(?)').run(hospitalName);
 const hospital = db.prepare('SELECT id FROM hospitals WHERE name=? COLLATE NOCASE').get(hospitalName);
 const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
 const hash = await bcrypt.hash(password, 12);
 let userId;
 if (existing) {
   db.prepare("UPDATE users SET role='admin', password_hash=?, hospital_id=? WHERE id=?").run(hash, hospital.id, existing.id);
   userId = existing.id;
 } else {
   const result = db.prepare("INSERT INTO users(name,email,password_hash,role,hospital_id) VALUES(?,?,?,'admin',?)").run('CareSphere Administrator', email, hash, hospital.id);
   userId = Number(result.lastInsertRowid);
 }
 db.prepare('INSERT OR IGNORE INTO hospital_admins(user_id,hospital_id) VALUES(?,?)').run(userId,hospital.id);
 console.log(`Administrator account configured for ${email}`);
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({
 name: 'caresphere.sid',
 secret: process.env.SESSION_SECRET || 'local-development-only-change-this-secret',
 resave: false,
 saveUninitialized: false,
 cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);

function publicUser(row) {
 return {
   id: row.id, name: row.name, email: row.email, role: row.role,
   age: row.age ?? null, hospital_id: row.hospital_id ?? null,
   hospital_name: row.hospital_name || ''
 };
}
function requireAuth(req, res, next) {
 if (!req.session.user) return res.status(401).json({ error: 'Please sign in to continue.' });
 next();
}
function requireAdmin(req, res, next) {
 if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
 const assigned = db.prepare('SELECT 1 FROM hospital_admins WHERE user_id=? AND hospital_id=?').get(req.session.user.id,req.session.user.hospital_id);
 if (!assigned) return res.status(403).json({ error: 'No hospital is assigned to this administrator account.' });
 next();
}
function validEmail(email) { return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254; }
function cleanText(value, max=100) { return typeof value === 'string' ? value.trim().slice(0,max) : ''; }
// Allowed medical report formats
const allowedReportTypes = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

// Configure secure file storage
const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + extension);
  }
});

// Configure report upload
const reportUpload = multer({
  storage: reportStorage,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (
      !allowedReportTypes[extension] ||
      allowedReportTypes[extension] !== file.mimetype
    ) {
      return cb(
        new Error('Only PDF, JPG and PNG files are allowed.')
      );
    }

    cb(null, true);
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'CareSphere API', database: 'connected' }));
app.get('/api/hospitals', (req,res) => {
 res.json({ hospitals: db.prepare('SELECT id,name,city FROM hospitals ORDER BY name').all() });
});
app.post('/api/auth/register', (req, res) => {
 const name = cleanText(req.body.name, 80);
 const email = cleanText(req.body.email, 254).toLowerCase();
 const password = typeof req.body.password === 'string' ? req.body.password : '';
 const hospitalId = Number(req.body.hospitalId);
 const age = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
 if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
 if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
 if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must contain 8–128 characters.' });
 if (!Number.isInteger(hospitalId) || !db.prepare('SELECT id FROM hospitals WHERE id=?').get(hospitalId)) return res.status(400).json({ error: 'Choose a hospital for your patient account.' });
 if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) return res.status(400).json({ error: 'Age must be a whole number between 0 and 120.' });
 if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
 const hash = bcrypt.hashSync(password, 12);
 const result = db.prepare("INSERT INTO users(name,email,password_hash,role,age,hospital_id) VALUES(?,?,?,'patient',?,?)").run(name,email,hash,age,hospitalId);
 const user = publicUser(db.prepare('SELECT u.id,u.name,u.email,u.role,u.age,u.hospital_id,h.name AS hospital_name FROM users u JOIN hospitals h ON h.id=u.hospital_id WHERE u.id=?').get(result.lastInsertRowid));
 req.session.user = user;
 res.status(201).json({ user });
});
app.post('/api/auth/login', (req, res) => {
 const email = cleanText(req.body.email, 254).toLowerCase();
 const password = typeof req.body.password === 'string' ? req.body.password : '';
 if (!validEmail(email) || !password) return res.status(400).json({ error: 'Enter your email address and password.' });
 const row = db.prepare('SELECT u.*,h.name AS hospital_name FROM users u LEFT JOIN hospitals h ON h.id=u.hospital_id WHERE u.email = ?').get(email);
 if (!row || !bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
 const user = publicUser(row);
 req.session.regenerate(err => {
   if (err) return res.status(500).json({ error: 'Could not start a secure session. Please try again.' });
   req.session.user = user;
   res.json({ user });
 });
});
app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));
app.post('/api/auth/logout', (req, res) => req.session.destroy(err => {
 if (err) return res.status(500).json({ error: 'Could not sign out. Please try again.' });
 res.clearCookie('caresphere.sid', { httpOnly: true, sameSite: 'lax' });
 res.json({ ok: true });
}));
app.get('/api/hospital/me', requireAuth, (req,res) => {
 const hospital = db.prepare('SELECT id,name,city,phone FROM hospitals WHERE id=?').get(req.session.user.hospital_id);
 if (!hospital) return res.status(404).json({ error: 'Your hospital is not available.' });
 res.json({ hospital });
});
app.get('/api/admin/hospitals', requireAdmin, (req,res) => {
 const hospitals = db.prepare(`SELECT h.id,h.name,h.city,h.phone FROM hospitals h
   JOIN hospital_admins ha ON ha.hospital_id=h.id WHERE ha.user_id=? ORDER BY h.name`).all(req.session.user.id);
 res.json({ hospitals });
});
app.post('/api/admin/hospitals', requireAdmin, (req,res) => {
 const name = cleanText(req.body.name,120);
 const city = cleanText(req.body.city,100);
 if (name.length < 3) return res.status(400).json({ error: 'Hospital name must contain at least 3 characters.' });
 if (db.prepare('SELECT id FROM hospitals WHERE name=? COLLATE NOCASE').get(name)) return res.status(409).json({ error: 'A hospital with that name already exists.' });
 const result = db.prepare('INSERT INTO hospitals(name,city) VALUES(?,?)').run(name,city);
 db.prepare('INSERT INTO hospital_admins(user_id,hospital_id) VALUES(?,?)').run(req.session.user.id,result.lastInsertRowid);
 res.status(201).json({ hospital: db.prepare('SELECT id,name,city,phone FROM hospitals WHERE id=?').get(result.lastInsertRowid) });
});
app.post('/api/admin/hospitals/select', requireAdmin, (req,res) => {
 const hospitalId = Number(req.body.hospitalId);
 const hospital = db.prepare(`SELECT h.id,h.name,h.city,h.phone FROM hospitals h
   JOIN hospital_admins ha ON ha.hospital_id=h.id
   WHERE h.id=? AND ha.user_id=?`).get(hospitalId,req.session.user.id);
 if (!hospital) return res.status(403).json({ error: 'You are not assigned to that hospital.' });
 req.session.user.hospital_id = hospital.id;
 req.session.user.hospital_name = hospital.name;
 res.json({ hospital });
});
app.patch('/api/admin/hospital', requireAdmin, (req,res) => {
 const name = cleanText(req.body.name,120);
 const city = cleanText(req.body.city,100);
 const phone = cleanText(req.body.phone,40);
 if (name.length < 3) return res.status(400).json({ error: 'Hospital name must contain at least 3 characters.' });
 const duplicate = db.prepare('SELECT id FROM hospitals WHERE name=? COLLATE NOCASE AND id<>?').get(name,req.session.user.hospital_id);
 if (duplicate) return res.status(409).json({ error: 'Another hospital already uses that name.' });
 db.prepare('UPDATE hospitals SET name=?,city=?,phone=? WHERE id=?').run(name,city,phone,req.session.user.hospital_id);
 req.session.user.hospital_name = name;
 res.json({ hospital: db.prepare('SELECT id,name,city,phone FROM hospitals WHERE id=?').get(req.session.user.hospital_id) });
});

app.get('/api/doctors', requireAuth, (req, res) => {
 const rows = db.prepare(`SELECT id,name,specialty,experience,available FROM doctors
   WHERE hospital_id=? ${req.session.user.role === 'admin' ? '' : 'AND available=1'} ORDER BY name`).all(req.session.user.hospital_id);
 res.json({ doctors: rows });
});
app.post('/api/admin/doctors', requireAdmin, (req, res) => {
 const name = cleanText(req.body.name, 100);
 const specialty = cleanText(req.body.specialty, 80);
 const experience = cleanText(req.body.experience, 80);
 if (name.length < 3 || specialty.length < 2) return res.status(400).json({ error: 'Enter a doctor name and specialty.' });
 if (db.prepare('SELECT id FROM doctors WHERE name = ? COLLATE NOCASE AND hospital_id=?').get(name,req.session.user.hospital_id)) return res.status(409).json({ error: 'A doctor with that name already exists at this hospital.' });
 const result = db.prepare('INSERT INTO doctors(name,specialty,experience,hospital_id) VALUES(?,?,?,?)').run(name,specialty,experience,req.session.user.hospital_id);
 res.status(201).json({ doctor: db.prepare('SELECT id,name,specialty,experience,available FROM doctors WHERE id=?').get(result.lastInsertRowid) });
});
app.patch('/api/admin/doctors/:id', requireAdmin, (req, res) => {
 if (typeof req.body.available !== 'boolean') return res.status(400).json({ error: 'Availability must be true or false.' });
 const result = db.prepare('UPDATE doctors SET available=? WHERE id=? AND hospital_id=?').run(req.body.available ? 1 : 0, Number(req.params.id),req.session.user.hospital_id);
 if (!result.changes) return res.status(404).json({ error: 'Doctor not found.' });
 res.json({ ok: true });
});
function appointmentRows(user) {
 const admin = user.role === 'admin';
 const sql = `SELECT a.id,a.appointment_at,a.reason,a.status,a.created_at,d.id AS doctor_id,d.name AS doctor_name,d.specialty,u.name AS patient_name,u.email AS patient_email
 FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN users u ON u.id=a.user_id
 WHERE ${admin?'d.hospital_id=?':'a.user_id=? AND d.hospital_id=?'} ORDER BY a.appointment_at ASC`;
 return admin ? db.prepare(sql).all(user.hospital_id) : db.prepare(sql).all(user.id,user.hospital_id);
}
app.get('/api/appointments', requireAuth, (req,res) => {
 const rows = appointmentRows(req.session.user);
 res.json({ appointments: rows });
});
app.post('/api/appointments', requireAuth, (req,res) => {
 if (req.session.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts can request appointments.' });
 const doctorId = Number(req.body.doctorId);
 const appointmentAt = cleanText(req.body.appointmentAt, 40);
 const reason = cleanText(req.body.reason || 'Consultation', 120) || 'Consultation';
 const doctor = db.prepare('SELECT id FROM doctors WHERE id=? AND available=1 AND hospital_id=?').get(doctorId,req.session.user.hospital_id);
 if (!doctor) return res.status(400).json({ error: 'Please choose a valid doctor.' });
 const parsed = new Date(appointmentAt);
 if (!appointmentAt || Number.isNaN(parsed.getTime()) || parsed <= new Date()) return res.status(400).json({ error: 'Choose a valid future date and time.' });
 const result = db.prepare('INSERT INTO appointments(user_id,doctor_id,appointment_at,reason,status) VALUES(?,?,?,?,\'Pending\')').run(req.session.user.id,doctorId,parsed.toISOString(),reason);
 const item = db.prepare(`SELECT a.id,a.appointment_at,a.reason,a.status,d.id AS doctor_id,d.name AS doctor_name,d.specialty FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.id=?`).get(result.lastInsertRowid);
 res.status(201).json({ appointment: item });
});
app.patch('/api/appointments/:id/status', requireAdmin, (req,res) => {
 const status = req.body.status;
 if (!['Pending','Confirmed','Completed','Cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid appointment status.' });
 const result = db.prepare(`UPDATE appointments SET status=? WHERE id=? AND EXISTS(
   SELECT 1 FROM doctors d WHERE d.id=appointments.doctor_id AND d.hospital_id=?)`).run(status, Number(req.params.id),req.session.user.hospital_id);
 if (!result.changes) return res.status(404).json({ error: 'Appointment not found.' });
 res.json({ ok: true });
});
app.patch('/api/profile', requireAuth, (req,res) => {
 const name = cleanText(req.body.name,80);
 const email = cleanText(req.body.email,254).toLowerCase();
 const age = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
 if (name.length < 2) return res.status(400).json({ error: 'Name must contain at least 2 characters.' });
 if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
 if (req.session.user.role === 'patient' && age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) return res.status(400).json({ error: 'Age must be a whole number between 0 and 120.' });
 const duplicate = db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email, req.session.user.id);
 if (duplicate) return res.status(409).json({ error: 'That email address is already in use.' });
 db.prepare('UPDATE users SET name=?, email=?, age=? WHERE id=?').run(name,email,req.session.user.role === 'patient' ? age : null,req.session.user.id);
 Object.assign(req.session.user,{name,email,age:req.session.user.role === 'patient'?age:null});
 res.json({ user: req.session.user });
});
app.get('/api/admin/patients', requireAdmin, (req,res) => {
 res.json({ patients: db.prepare("SELECT id,name,email,age,created_at FROM users WHERE role='patient' AND hospital_id=? ORDER BY created_at DESC").all(req.session.user.hospital_id) });
});
app.get('/api/reports', requireAuth, (req,res) => {
 const reports = db.prepare('SELECT id,original_name,mime_type,file_size,status,shared_with_hospital,created_at FROM reports WHERE user_id=? ORDER BY created_at DESC').all(req.session.user.id);
 res.json({ reports });
});
app.get('/api/admin/reports', requireAdmin, (req,res) => {
 const reports = db.prepare(`SELECT r.id,r.original_name,r.mime_type,r.file_size,r.created_at,u.name AS patient_name,u.email AS patient_email
   FROM reports r JOIN users u ON u.id=r.user_id
   WHERE r.shared_with_hospital=1 AND u.hospital_id=? ORDER BY r.created_at DESC`).all(req.session.user.hospital_id);
 res.json({ reports });
});
app.post('/api/reports', requireAuth, (req,res,next) => {
 if (req.session.user.role !== 'patient') return res.status(403).json({ error: 'Medical history uploads are available to patient accounts.' });
 reportUpload.single('report')(req,res,err => {
   if (err) return next(err);
   if (!req.file) return res.status(400).json({ error: 'Choose a PDF, JPG, or PNG report to upload.' });
   const originalName = path.basename(req.file.originalname).replace(/[\r\n"]/g, '_').slice(0,160);
   try {
     const shared = req.body.shareWithHospital === 'true' ? 1 : 0;
     const result = db.prepare('INSERT INTO reports(user_id,original_name,stored_name,mime_type,file_size,shared_with_hospital) VALUES(?,?,?,?,?,?)')
       .run(req.session.user.id,originalName,req.file.filename,req.file.mimetype,req.file.size,shared);
     res.status(201).json({ report: { id: Number(result.lastInsertRowid), original_name: originalName, mime_type: req.file.mimetype, file_size: req.file.size, shared_with_hospital: shared, status: 'Uploaded' } });
   } catch (error) {
     fs.unlink(req.file.path, unlinkError => {
       if (unlinkError) console.error('Could not remove report upload after database error:', unlinkError);
       next(error);
     });
   }
 });
});
app.get('/api/reports/:id/download', requireAuth, (req,res) => {
 if (req.session.user.role === 'admin' && !db.prepare('SELECT 1 FROM hospital_admins WHERE user_id=? AND hospital_id=?').get(req.session.user.id,req.session.user.hospital_id)) {
   return res.status(403).json({ error: 'This administrator is not assigned to the active hospital.' });
 }
 const report = req.session.user.role === 'admin'
   ? db.prepare(`SELECT r.original_name,r.stored_name FROM reports r JOIN users u ON u.id=r.user_id
      WHERE r.id=? AND r.shared_with_hospital=1 AND u.hospital_id=?`).get(Number(req.params.id),req.session.user.hospital_id)
   : db.prepare('SELECT original_name,stored_name FROM reports WHERE id=? AND user_id=?').get(Number(req.params.id),req.session.user.id);
 if (!report) return res.status(404).json({ error: 'Report not found.' });
 res.download(path.join(UPLOAD_DIR,report.stored_name),report.original_name,error => {
   if (error && !res.headersSent) res.status(404).json({ error: 'The report file is no longer available.' });
 });
});
app.patch('/api/reports/:id/share', requireAuth, (req,res) => {
  if (req.session.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts control report sharing.' });
  if (typeof req.body.shared !== 'boolean') return res.status(400).json({ error: 'Choose whether to share this report with your hospital.' });
  const result = db.prepare('UPDATE reports SET shared_with_hospital=? WHERE id=? AND user_id=?').run(req.body.shared?1:0,Number(req.params.id),req.session.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Report not found.' });
  res.json({ ok: true, shared_with_hospital: req.body.shared });
 });
app.post('/api/reports/:id/summary', requireAuth, async (req,res,next) => {
  if (req.session.user.role !== 'patient') return res.status(403).json({ error: 'Report summaries are available to the patient who uploaded the file.' });
  const report = db.prepare('SELECT stored_name,mime_type FROM reports WHERE id=? AND user_id=?').get(Number(req.params.id),req.session.user.id);
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  if (report.mime_type !== 'application/pdf') return res.status(415).json({ error: 'The local text summary currently supports text-based PDF files only.' });
  try {
    const { getDocument } = await pdfjs;
    const document = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(UPLOAD_DIR,report.stored_name))), verbosity: 0 }).promise;
    const sentences = [];
    const pagesToRead = Math.min(document.numPages,20);
    for (let pageNumber=1; pageNumber<=pagesToRead; pageNumber+=1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map(item => 'str' in item ? item.str : '').join(' ').replace(/\s+/g,' ').trim();
      sentences.push(...(text.match(/[^.!?]+[.!?]?/g) || []).map(sentence=>sentence.trim()).filter(sentence=>sentence.length>35));
    }
    if (!sentences.length) return res.status(422).json({ error: 'No selectable text was found. Scanned PDFs and images need OCR, which is not enabled.' });
    const stopWords = new Set('about after again against also among because before being between could does during each from further have having into more most other over same should some such than that their them then there these they this through under until very what when where which while with would your'.split(' '));
    const frequencies = new Map();
    for (const word of sentences.join(' ').toLowerCase().match(/[a-z]{3,}/g) || []) {
      if (!stopWords.has(word)) frequencies.set(word,(frequencies.get(word)||0)+1);
    }
    const ranked = sentences.map((sentence,index) => {
      const words = sentence.toLowerCase().match(/[a-z]{3,}/g) || [];
      const score = words.reduce((sum,word)=>sum+(frequencies.get(word)||0),0)/Math.max(words.length,1);
      return {sentence,index,score};
    }).sort((a,b)=>b.score-a.score).slice(0,4).sort((a,b)=>a.index-b.index);
    res.json({
      summary: ranked.map(item=>item.sentence.slice(0,500)),
      pagesRead: pagesToRead,
      totalPages: document.numPages,
      method: 'local-extractive',
      notice: 'This is an automatically selected text extract, not AI diagnosis or medical advice. Confirm all details with your clinician.'
    });
  } catch (error) {
    next(error);
  }
});
app.delete('/api/reports/:id', requireAuth, (req,res) => {
 const report = db.prepare('SELECT id,stored_name FROM reports WHERE id=? AND user_id=?').get(Number(req.params.id),req.session.user.id);
 if (!report) return res.status(404).json({ error: 'Report not found.' });
 const filePath = path.join(UPLOAD_DIR,report.stored_name);
 try {
   fs.unlinkSync(filePath);
 } catch (error) {
   if (error.code !== 'ENOENT') throw error;
   console.warn(`Uploaded report file ${report.stored_name} was already missing.`);
 }
 db.prepare('DELETE FROM reports WHERE id=? AND user_id=?').run(report.id,req.session.user.id);
 res.json({ ok: true });
});
app.get('/api/prescriptions', requireAuth, (req,res) => {
 const admin = req.session.user.role === 'admin';
 const prescriptions = db.prepare(`SELECT p.id,p.user_id,p.medication,p.directions,p.refills,p.status,p.created_at,u.name AS patient_name,d.name AS doctor_name
   FROM prescriptions p JOIN users u ON u.id=p.user_id LEFT JOIN doctors d ON d.id=p.doctor_id
   WHERE ${admin ? 'u.hospital_id=?' : 'p.user_id=?'} ORDER BY p.created_at DESC`).all(req.session.user.role==='admin'?req.session.user.hospital_id:req.session.user.id);
 res.json({ prescriptions });
});
app.post('/api/admin/prescriptions', requireAdmin, (req,res) => {
 const userId = Number(req.body.userId);
 const doctorId = req.body.doctorId === '' || req.body.doctorId == null ? null : Number(req.body.doctorId);
 const medication = cleanText(req.body.medication,120);
 const directions = cleanText(req.body.directions,500);
 const refills = Number(req.body.refills);
 if (!Number.isInteger(userId) || !db.prepare("SELECT id FROM users WHERE id=? AND role='patient' AND hospital_id=?").get(userId,req.session.user.hospital_id)) return res.status(400).json({ error: 'Choose a registered patient at your hospital.' });
 if (doctorId !== null && !db.prepare('SELECT id FROM doctors WHERE id=? AND hospital_id=?').get(doctorId,req.session.user.hospital_id)) return res.status(400).json({ error: 'Choose a valid clinician at your hospital.' });
 if (medication.length < 2 || directions.length < 2) return res.status(400).json({ error: 'Enter the prescription name and directions.' });
 if (!Number.isInteger(refills) || refills < 0 || refills > 20) return res.status(400).json({ error: 'Refills must be a whole number from 0 to 20.' });
 const result = db.prepare('INSERT INTO prescriptions(user_id,doctor_id,medication,directions,refills) VALUES(?,?,?,?,?)').run(userId,doctorId,medication,directions,refills);
 res.status(201).json({ prescription: db.prepare('SELECT id,user_id,medication,directions,refills,status,created_at FROM prescriptions WHERE id=?').get(result.lastInsertRowid) });
});
app.get('/api/invoices', requireAuth, (req,res) => {
 const admin = req.session.user.role === 'admin';
 const invoices = db.prepare(`SELECT i.id,i.user_id,i.description,i.amount_cents,i.status,i.created_at,i.paid_at,u.name AS patient_name,u.email AS patient_email
   FROM invoices i JOIN users u ON u.id=i.user_id WHERE ${admin ? 'u.hospital_id=?' : 'i.user_id=?'} ORDER BY i.created_at DESC`).all(req.session.user.role==='admin'?req.session.user.hospital_id:req.session.user.id);
 res.json({ invoices });
});
app.post('/api/admin/invoices', requireAdmin, (req,res) => {
 const userId = Number(req.body.userId);
 const description = cleanText(req.body.description,160);
 const amountCents = Number(req.body.amountCents);
 if (!Number.isInteger(userId) || !db.prepare("SELECT id FROM users WHERE id=? AND role='patient' AND hospital_id=?").get(userId,req.session.user.hospital_id)) return res.status(400).json({ error: 'Choose a registered patient at your hospital.' });
 if (description.length < 2) return res.status(400).json({ error: 'Enter an invoice description.' });
 if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 100000000) return res.status(400).json({ error: 'Enter a valid invoice amount.' });
 const result = db.prepare('INSERT INTO invoices(user_id,description,amount_cents) VALUES(?,?,?)').run(userId,description,amountCents);
 res.status(201).json({ invoice: db.prepare('SELECT id,user_id,description,amount_cents,status,created_at FROM invoices WHERE id=?').get(result.lastInsertRowid) });
});
app.post('/api/invoices/:id/pay-demo', requireAuth, (req,res) => {
 if (req.session.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts can update their demo payment status.' });
 const result = db.prepare("UPDATE invoices SET status='Paid',paid_at=datetime('now') WHERE id=? AND user_id=? AND status='Due'").run(Number(req.params.id),req.session.user.id);
 if (!result.changes) {
   const invoice = db.prepare('SELECT status FROM invoices WHERE id=? AND user_id=?').get(Number(req.params.id),req.session.user.id);
   if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
   return res.status(409).json({ error: 'This invoice has already been paid.' });
 }
 res.json({ ok: true, payment: 'demo-only-no-charge' });
});
app.get('/api/admin/analytics', requireAdmin, (req,res) => {
 const hospitalId = req.session.user.hospital_id;
 const totals = {
   patients: db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='patient' AND hospital_id=?").get(hospitalId).count,
   doctors: db.prepare('SELECT COUNT(*) AS count FROM doctors WHERE available=1 AND hospital_id=?').get(hospitalId).count,
   appointments: db.prepare('SELECT COUNT(*) AS count FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE d.hospital_id=?').get(hospitalId).count,
   pendingAppointments: db.prepare("SELECT COUNT(*) AS count FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.status='Pending' AND d.hospital_id=?").get(hospitalId).count,
   dueInvoices: db.prepare("SELECT COUNT(*) AS count FROM invoices i JOIN users u ON u.id=i.user_id WHERE i.status='Due' AND u.hospital_id=?").get(hospitalId).count,
   uploadedReports: db.prepare('SELECT COUNT(*) AS count FROM reports r JOIN users u ON u.id=r.user_id WHERE r.shared_with_hospital=1 AND u.hospital_id=?').get(hospitalId).count
 };
 const recentAppointments = db.prepare(`SELECT a.id,a.appointment_at,a.reason,a.status,a.created_at,d.id AS doctor_id,d.name AS doctor_name,d.specialty,u.name AS patient_name,u.email AS patient_email
   FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN users u ON u.id=a.user_id
   WHERE d.hospital_id=? ORDER BY a.created_at DESC LIMIT 100`).all(hospitalId);
 res.json({ totals, recentAppointments });
});
app.get('/api/notifications', requireAuth, (req,res) => {
 const admin = req.session.user.role === 'admin';
 const appointments = admin
   ? db.prepare("SELECT a.id,a.appointment_at AS detail,'Appointment request pending' AS message FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.status='Pending' AND d.hospital_id=? ORDER BY a.appointment_at LIMIT 10").all(req.session.user.hospital_id)
   : db.prepare("SELECT id,appointment_at AS detail,'Appointment ' || lower(status) AS message FROM appointments WHERE user_id=? AND status IN ('Pending','Confirmed') ORDER BY appointment_at LIMIT 10").all(req.session.user.id);
 const invoices = admin
   ? db.prepare("SELECT i.id,i.description AS detail,'Invoice due' AS message FROM invoices i JOIN users u ON u.id=i.user_id WHERE i.status='Due' AND u.hospital_id=? ORDER BY i.created_at DESC LIMIT 10").all(req.session.user.hospital_id)
   : db.prepare("SELECT id,description AS detail,'Payment due' AS message FROM invoices WHERE user_id=? AND status='Due' ORDER BY created_at DESC LIMIT 10").all(req.session.user.id);
 res.json({ notifications: [...appointments,...invoices] });
});

// Never expose backend source files or the SQLite database through static hosting.
app.use('/backend', (req,res) => res.status(404).send('Not found'));
// Serve the existing frontend and API from the same origin.
app.use(express.static(ROOT, {
 extensions: ['html'],
 dotfiles: 'deny',
 setHeaders(res, filePath) {
   if (/\.(?:html|js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-store');
 }
}));
app.get('/', (req,res) => res.sendFile(path.join(ROOT,'index.html')));
app.use('/api', (req,res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((err,req,res,next) => {
 console.error(err);
 const status = err instanceof multer.MulterError || err.message === 'Only PDF, JPG and PNG files are allowed.' ? 400 : 500;
 res.status(status).json({ error: status === 400 ? err.message : 'Unexpected server error. Check the terminal for details.' });
});

seedAdmin().then(() => app.listen(PORT, () => {
 console.log(`CareSphere running at http://localhost:${PORT}`);
 console.log(`API health: http://localhost:${PORT}/api/health`);
})).catch(err => { console.error('Startup failed:', err); process.exit(1); });
