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
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'patient' CHECK(role IN ('patient','admin')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS doctors (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 specialty TEXT NOT NULL,
 experience TEXT NOT NULL DEFAULT '',
 available INTEGER NOT NULL DEFAULT 1
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
 status TEXT NOT NULL DEFAULT 'Uploaded',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const seedDoctors = [
 ['Dr. Ananya Mehta','Cardiology','12 years experience'],
 ['Dr. Rahul Kapoor','General Medicine','9 years experience'],
 ['Dr. Priya Nair','Dermatology','8 years experience'],
 ['Dr. Vikram Rao','Orthopaedics','15 years experience'],
 ['Dr. Sana Khan','Paediatrics','10 years experience'],
 ['Dr. Arjun Das','Neurology','11 years experience']
];
const addDoctor = db.prepare('INSERT INTO doctors (name,specialty,experience) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name = ?)');
for (const [name, specialty, experience] of seedDoctors) addDoctor.run(name, specialty, experience, name);

async function seedAdmin() {
 const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
 const password = process.env.ADMIN_PASSWORD || '';
 if (!email || !password) return;
 if (password.length < 12) {
   console.warn('ADMIN_PASSWORD must be at least 12 characters; administrator seed skipped.');
   return;
 }
 const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
 const hash = await bcrypt.hash(password, 12);
 if (existing) db.prepare("UPDATE users SET role='admin', password_hash=? WHERE id=?").run(hash, existing.id);
 else db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run('CareSphere Administrator', email, hash);
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

function publicUser(row) { return { id: row.id, name: row.name, email: row.email, role: row.role }; }
function requireAuth(req, res, next) {
 if (!req.session.user) return res.status(401).json({ error: 'Please sign in to continue.' });
 next();
}
function requireAdmin(req, res, next) {
 if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
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
app.post('/api/auth/register', (req, res) => {
 const name = cleanText(req.body.name, 80);
 const email = cleanText(req.body.email, 254).toLowerCase();
 const password = typeof req.body.password === 'string' ? req.body.password : '';
 if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
 if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
 if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must contain 8–128 characters.' });
 if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
 const hash = bcrypt.hashSync(password, 12);
 const result = db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'patient')").run(name,email,hash);
 const user = publicUser(db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(result.lastInsertRowid));
 req.session.user = user;
 res.status(201).json({ user });
});
app.post('/api/auth/login', (req, res) => {
 const email = cleanText(req.body.email, 254).toLowerCase();
 const password = typeof req.body.password === 'string' ? req.body.password : '';
 if (!validEmail(email) || !password) return res.status(400).json({ error: 'Enter your email address and password.' });
 const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
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

app.get('/api/doctors', requireAuth, (req, res) => {
 const rows = db.prepare('SELECT id,name,specialty,experience,available FROM doctors WHERE available=1 ORDER BY name').all();
 res.json({ doctors: rows });
});
function appointmentRows(userId, admin=false) {
 const sql = `SELECT a.id,a.appointment_at,a.reason,a.status,a.created_at,d.id AS doctor_id,d.name AS doctor_name,d.specialty,u.name AS patient_name,u.email AS patient_email
 FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN users u ON u.id=a.user_id ${admin?'':'WHERE a.user_id=?'} ORDER BY a.appointment_at ASC`;
 return admin ? db.prepare(sql).all() : db.prepare(sql).all(userId);
}
app.get('/api/appointments', requireAuth, (req,res) => {
 const rows = appointmentRows(req.session.user.id, req.session.user.role === 'admin');
 res.json({ appointments: rows });
});
app.post('/api/appointments', requireAuth, (req,res) => {
 if (req.session.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts can request appointments.' });
 const doctorId = Number(req.body.doctorId);
 const appointmentAt = cleanText(req.body.appointmentAt, 40);
 const reason = cleanText(req.body.reason || 'Consultation', 120) || 'Consultation';
 const doctor = db.prepare('SELECT id FROM doctors WHERE id=? AND available=1').get(doctorId);
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
 const result = db.prepare('UPDATE appointments SET status=? WHERE id=?').run(status, Number(req.params.id));
 if (!result.changes) return res.status(404).json({ error: 'Appointment not found.' });
 res.json({ ok: true });
});
app.patch('/api/profile', requireAuth, (req,res) => {
 const name = cleanText(req.body.name,80);
 const email = cleanText(req.body.email,254).toLowerCase();
 if (name.length < 2) return res.status(400).json({ error: 'Name must contain at least 2 characters.' });
 if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
 const duplicate = db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email, req.session.user.id);
 if (duplicate) return res.status(409).json({ error: 'That email address is already in use.' });
 db.prepare('UPDATE users SET name=?, email=? WHERE id=?').run(name,email,req.session.user.id);
 req.session.user.name = name; req.session.user.email = email;
 res.json({ user: req.session.user });
});
app.get('/api/admin/patients', requireAdmin, (req,res) => {
 res.json({ patients: db.prepare("SELECT id,name,email,created_at FROM users WHERE role='patient' ORDER BY created_at DESC").all() });
});

// Never expose backend source files or the SQLite database through static hosting.
app.use('/backend', (req,res) => res.status(404).send('Not found'));
// Serve the existing frontend and API from the same origin.
app.use(express.static(ROOT, { extensions: ['html'], dotfiles: 'deny' }));
app.get('/', (req,res) => res.sendFile(path.join(ROOT,'index.html')));
app.use('/api', (req,res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((err,req,res,next) => {
 console.error(err);
 res.status(500).json({ error: 'Unexpected server error. Check the terminal for details.' });
});

seedAdmin().then(() => app.listen(PORT, () => {
 console.log(`CareSphere running at http://localhost:${PORT}`);
 console.log(`API health: http://localhost:${PORT}/api/health`);
})).catch(err => { console.error('Startup failed:', err); process.exit(1); });
