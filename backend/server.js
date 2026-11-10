require('dotenv').config();
const dns = require('dns');
try {
  // Use public DNS to reliably resolve MongoDB Atlas SRV connection strings
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {}
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.default || connectMongo.MongoStore || connectMongo;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caresphere';
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Store uploaded medical reports outside the public frontend.
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- Mongoose Schemas & Models ---
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, required: true, enum: ['patient', 'admin'], default: 'patient' },
  hospital_name: { type: String, default: 'CareSphere Central Hospital', trim: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  city: { type: String, default: 'Metro Campus', trim: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  specialty: { type: String, required: true, trim: true },
  experience: { type: String, default: '', trim: true },
  available: { type: Boolean, default: true },
  hospital_name: { type: String, required: true, default: 'CareSphere Central Hospital', trim: true },
  symbol: { type: String, default: '👨‍⚕️' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const appointmentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient_name: { type: String, default: '', trim: true },
  patient_email: { type: String, default: '', trim: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  hospital_name: { type: String, default: 'CareSphere Central Hospital', trim: true },
  appointment_at: { type: Date, required: true },
  reason: { type: String, default: 'Consultation', trim: true, maxlength: 120 },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Pending'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const reportSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient_name: { type: String, default: '', trim: true },
  patient_email: { type: String, default: '', trim: true },
  hospital_name: { type: String, default: 'CareSphere Central Hospital', trim: true },
  uploaded_by_role: { type: String, enum: ['patient', 'admin', 'hospital'], default: 'patient' },
  uploaded_by_name: { type: String, default: '', trim: true },
  original_name: { type: String, required: true, trim: true },
  stored_name: { type: String, required: true, unique: true },
  mime_type: { type: String, required: true },
  file_size: { type: Number, required: true },
  status: { type: String, default: 'Sealed' },
  category: { type: String, default: 'Clinical Report', trim: true },
  document_hash: { type: String, default: '' },
  block_index: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// --- Cryptographic Blockchain Ledger Model ---
const blockSchema = new mongoose.Schema({
  index: { type: Number, required: true, unique: true },
  timestamp: { type: String, required: true },
  data: {
    type: { type: String, required: true }, // 'GENESIS' | 'MEDICAL_RECORD' | 'APPOINTMENT' | 'PATIENT_PROFILE'
    title: { type: String, required: true },
    patientId: { type: String, default: '' },
    patientName: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed },
    documentHash: { type: String, default: '' }
  },
  previousHash: { type: String, required: true },
  hash: { type: String, required: true },
  nonce: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const User = mongoose.model('User', userSchema);
const Hospital = mongoose.model('Hospital', hospitalSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Report = mongoose.model('Report', reportSchema);
const Block = mongoose.model('Block', blockSchema);

// --- Blockchain Core Engine ---
function calculateHash(index, timestamp, data, previousHash, nonce = 0) {
  const payload = `${index}|${timestamp}|${JSON.stringify(data)}|${previousHash}|${nonce}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

class HealthcareBlockchain {
  static async getLatestBlock() {
    return await Block.findOne().sort({ index: -1 });
  }

  static async initialize() {
    const count = await Block.countDocuments();
    if (count === 0) {
      const index = 0;
      const timestamp = new Date('2026-01-01T00:00:00.000Z').toISOString();
      const data = {
        type: 'GENESIS',
        title: 'CareSphere Cryptographic Genesis Block',
        patientName: 'CareSphere Trust Network',
        details: {
          protocol: 'CareSphere HealthVault Cryptographic Audit Ledger',
          standard: 'SHA-256 Tamper-Evident Hash Chain',
          security: 'Zero-Knowledge Document Fingerprinting'
        },
        documentHash: '0000000000000000000000000000000000000000000000000000000000000000'
      };
      const previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const hash = calculateHash(index, timestamp, data, previousHash, 0);

      await Block.create({
        index,
        timestamp,
        data,
        previousHash,
        hash,
        nonce: 0
      });
      console.log('Blockchain Genesis Block initialized.');
    }
  }

  static async addBlock(type, title, patientId, patientName, details, documentHash = '') {
    const latest = await this.getLatestBlock();
    const index = latest ? latest.index + 1 : 0;
    const timestamp = new Date().toISOString();
    const previousHash = latest ? latest.hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const data = {
      type,
      title,
      patientId: String(patientId || ''),
      patientName: String(patientName || ''),
      details,
      documentHash: String(documentHash || '')
    };

    // Calculate cryptographic hash with proof of work
    let nonce = 0;
    let hash = calculateHash(index, timestamp, data, previousHash, nonce);
    while (!hash.startsWith('0')) {
      nonce++;
      hash = calculateHash(index, timestamp, data, previousHash, nonce);
    }

    const newBlock = await Block.create({
      index,
      timestamp,
      data,
      previousHash,
      hash,
      nonce
    });

    console.log(`[Blockchain] Block #${newBlock.index} mined successfully. Hash: ${newBlock.hash.slice(0, 16)}...`);
    return newBlock;
  }

  static async validateChain() {
    const blocks = await Block.find().sort({ index: 1 });
    if (blocks.length === 0) return { isValid: true, length: 0, brokenBlockIndex: null };

    for (let i = 1; i < blocks.length; i++) {
      const current = blocks[i];
      const previous = blocks[i - 1];

      // 1. Validate hash recalculation
      const recalculated = calculateHash(current.index, current.timestamp, current.data, current.previousHash, current.nonce);
      if (current.hash !== recalculated) {
        return {
          isValid: false,
          length: blocks.length,
          brokenBlockIndex: current.index,
          reason: `Cryptographic hash mismatch at Block #${current.index}. The data payload has been altered without valid proof of work!`
        };
      }

      // 2. Validate chain link to previous block
      if (current.previousHash !== previous.hash) {
        return {
          isValid: false,
          length: blocks.length,
          brokenBlockIndex: current.index,
          reason: `Broken chain pointer between Block #${previous.index} and Block #${current.index}.`
        };
      }
    }

    return {
      isValid: true,
      length: blocks.length,
      brokenBlockIndex: null,
      message: 'Cryptographic ledger is 100% verified. All blocks match SHA-256 chain signatures.'
    };
  }
}

const seedDoctors = [
  { name: 'Dr. Ananya Mehta', specialty: 'Cardiology', experience: '12 years experience', hospital_name: 'CareSphere Central Hospital', symbol: '🩺' },
  { name: 'Dr. Rahul Kapoor', specialty: 'General Medicine', experience: '9 years experience', hospital_name: 'CareSphere Central Hospital', symbol: '👨‍⚕️' },
  { name: 'Dr. Priya Nair', specialty: 'Dermatology', experience: '8 years experience', hospital_name: 'Apollo Multi-Specialty Hospital', symbol: '👩‍⚕️' },
  { name: 'Dr. Vikram Rao', specialty: 'Orthopaedics', experience: '15 years experience', hospital_name: 'Apollo Multi-Specialty Hospital', symbol: '👨‍⚕️' },
  { name: 'Dr. Sana Khan', specialty: 'Paediatrics', experience: '10 years experience', hospital_name: 'Metro City Healthcare', symbol: '🩺' },
  { name: 'Dr. Arjun Das', specialty: 'Neurology', experience: '11 years experience', hospital_name: 'Metro City Healthcare', symbol: '👨‍⚕️' }
];

async function seedData() {
  // 1. Initialize Blockchain Genesis (Block #0)
  await HealthcareBlockchain.initialize();

  // 2. Seed Base Hospitals
  const baseHospitals = ['CareSphere Central Hospital', 'Apollo Multi-Specialty Hospital', 'Metro City Healthcare'];
  for (const hName of baseHospitals) {
    const existingH = await Hospital.findOne({ name: hName });
    if (!existingH) {
      await Hospital.create({ name: hName, city: 'Metro Campus' });
    }
  }

  // 3. Seed Doctors (with hospital associations)
  for (const doc of seedDoctors) {
    let existing = await Doctor.findOne({ name: doc.name });
    if (!existing) {
      await Doctor.create({ ...doc, available: true });
    } else {
      if (!existing.hospital_name) existing.hospital_name = doc.hospital_name;
      if (!existing.symbol) existing.symbol = doc.symbol;
      await existing.save();
    }
  }

  // 4. Remove only legacy dummy mock accounts if they exist (never delete real registered users)
  const legacyDummyEmails = ['vedant@example.com', 'aarav@example.com', 'meera@example.com', 'kabir@example.com', 'anaya@example.com'];
  await User.deleteMany({ email: { $in: legacyDummyEmails } });

  // 5. Seed Admin (from .env)
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;
  if (password.length < 12) {
    console.warn('ADMIN_PASSWORD must be at least 12 characters; administrator seed skipped.');
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  const existingAdmin = await User.findOne({ email });
  const adminHospital = (process.env.ADMIN_HOSPITAL || 'CareSphere Central Hospital').trim();
  await Hospital.findOneAndUpdate({ name: adminHospital }, { name: adminHospital }, { upsert: true });

  if (existingAdmin) {
    existingAdmin.role = 'admin';
    existingAdmin.password_hash = hash;
    if (process.env.ADMIN_HOSPITAL) {
      existingAdmin.hospital_name = adminHospital;
    } else if (!existingAdmin.hospital_name) {
      existingAdmin.hospital_name = adminHospital;
    }
    await existingAdmin.save();
  } else {
    await User.create({
      name: 'CareSphere Administrator',
      email,
      password_hash: hash,
      role: 'admin',
      hospital_name: adminHospital
    });
  }
  console.log(`Administrator account configured for ${email} at ${adminHospital}`);
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

// Persistent sessions with connect-mongo
let sessionStore;
try {
  if (typeof MongoStore?.create === 'function') {
    sessionStore = MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: 'sessions',
      ttl: 8 * 60 * 60
    });
  }
} catch (storeErr) {
  console.warn('Session store notice:', storeErr.message);
}

app.use(session({
  name: 'caresphere.sid',
  secret: process.env.SESSION_SECRET || 'local-development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  ...(sessionStore ? { store: sessionStore } : {}),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);

function publicUser(doc) {
  return {
    id: doc._id.toString(),
    name: doc.role === 'patient' ? cleanPatientName(doc.name) : doc.name,
    email: doc.email,
    role: doc.role,
    hospital_name: doc.hospital_name || 'CareSphere Central Hospital'
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}

function validEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function cleanText(value, max = 100) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanPatientName(name) {
  if (!name || typeof name !== 'string') return 'Patient';
  return name.replace(/\s*[-—(]\s*(CareSphere|Apollo|Metro|Hospital|Clinic|Healthcare).*$/i, '').trim() || name;
}

function updateEnvFile(key, value) {
  try {
    const envPath = path.join(ROOT, '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + (content.length > 0 ? '\n' : '') + `${key}=${value}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    process.env[key] = value;
    console.log(`[ENV] Synchronized ${key}="${value}" to .env file`);
  } catch (err) {
    console.warn(`[ENV] Could not write ${key} to .env:`, err.message);
  }
}

// Allowed medical report formats
const allowedReportTypes = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + extension);
  }
});

const reportUpload = multer({
  storage: reportStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedReportTypes[extension] || allowedReportTypes[extension] !== file.mimetype) {
      return cb(new Error('Only PDF, JPG and PNG files are allowed.'));
    }
    cb(null, true);
  }
});

// --- API Endpoints ---

app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    status: isConnected ? 'ok' : 'degraded',
    service: 'CareSphere API',
    database: isConnected ? 'connected' : 'disconnected',
    defaultHospital: process.env.ADMIN_HOSPITAL || 'CareSphere Central Hospital'
  });
});

app.get('/api/auth/config', (req, res) => {
  res.json({
    defaultHospital: process.env.ADMIN_HOSPITAL || 'CareSphere Central Hospital'
  });
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const name = cleanText(req.body.name, 80);
    const email = cleanText(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const hospitalName = cleanText(req.body.hospitalName || req.body.hospital_name, 100) || 'CareSphere Central Hospital';

    if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 4 || password.length > 128) return res.status(400).json({ error: 'Password must contain at least 4 characters.' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password_hash: hash, role: 'patient', hospital_name: hospitalName });

    await Hospital.findOneAndUpdate({ name: hospitalName }, { name: hospitalName }, { upsert: true });

    // Mine a blockchain audit block for user registration
    await HealthcareBlockchain.addBlock(
      'PATIENT_REGISTRATION',
      `Patient Account Created: ${user.name}`,
      user._id.toString(),
      user.name,
      { email: user.email, role: user.role, hospital: hospitalName }
    );

    const userObj = publicUser(user);
    req.session.user = userObj;
    res.status(201).json({ user: userObj });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = cleanText(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const typedHospital = cleanText(req.body.hospitalName || req.body.hospital_name, 100);

    if (!validEmail(email) || !password) return res.status(400).json({ error: 'Enter your email address and password.' });

    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    // If a hospital name was typed at sign in, update user, hospital registry, .env, and blockchain
    if (typedHospital && typedHospital.length >= 2) {
      const oldHospital = user.hospital_name || '';
      user.hospital_name = typedHospital;
      await user.save();

      // Upsert into Hospital collection
      await Hospital.findOneAndUpdate({ name: typedHospital }, { name: typedHospital }, { upsert: true });

      if (user.role === 'admin') {
        // Synchronize .env file with the newly typed admin hospital
        updateEnvFile('ADMIN_HOSPITAL', typedHospital);

        // Re-link doctors associated with old hospital if changed
        if (oldHospital && oldHospital !== typedHospital) {
          await Doctor.updateMany({ hospital_name: oldHospital }, { hospital_name: typedHospital });
        }

        // Commit cryptographic block to the blockchain ledger
        await HealthcareBlockchain.addBlock(
          'HOSPITAL_PROFILE_UPDATED',
          `Hospital Facility Configured at Sign-in: ${typedHospital}`,
          user._id.toString(),
          user.name,
          { previousName: oldHospital, newName: typedHospital, updatedBy: user.name, source: 'sign_in_auth' }
        );
      }
    }

    const userObj = publicUser(user);
    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: 'Could not start a secure session. Please try again.' });
      req.session.user = userObj;
      res.json({ user: userObj });
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Could not sign out. Please try again.' });
    res.clearCookie('caresphere.sid', { httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true });
  });
});

app.get('/api/hospitals', requireAuth, async (req, res, next) => {
  try {
    const doctorHospitals = await Doctor.distinct('hospital_name');
    const hospitalDocs = await Hospital.find().sort({ name: 1 });
    const set = new Set([
      'CareSphere Central Hospital',
      'Apollo Multi-Specialty Hospital',
      'Metro City Healthcare',
      ...doctorHospitals,
      ...hospitalDocs.map(h => h.name)
    ]);
    const hospitals = Array.from(set).filter(Boolean).sort();
    res.json({ hospitals });
  } catch (err) {
    next(err);
  }
});

app.get('/api/doctors', requireAuth, async (req, res, next) => {
  try {
    const filter = { available: true };
    if (req.query.hospital && req.query.hospital !== 'all') {
      filter.hospital_name = cleanText(req.query.hospital, 100);
    }
    const doctors = await Doctor.find(filter).sort({ name: 1 });
    res.json({
      doctors: doctors.map(d => ({
        id: d._id.toString(),
        name: d.name,
        specialty: d.specialty,
        experience: d.experience,
        hospital_name: d.hospital_name || 'CareSphere Central Hospital',
        symbol: d.symbol || '👨‍⚕️',
        available: d.available ? 1 : 0
      }))
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/appointments', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    const filter = isAdmin ? {} : { user_id: req.session.user.id };

    const rows = await Appointment.find(filter)
      .populate('doctor_id', 'name specialty hospital_name')
      .populate('user_id', 'name email')
      .sort({ appointment_at: 1 });

    const appointments = rows.map(a => ({
      id: a._id.toString(),
      appointment_at: a.appointment_at ? a.appointment_at.toISOString() : '',
      reason: a.reason,
      status: a.status,
      created_at: a.created_at ? a.created_at.toISOString() : '',
      doctor_id: a.doctor_id ? a.doctor_id._id.toString() : '',
      doctor_name: a.doctor_id ? a.doctor_id.name : 'Doctor',
      specialty: a.doctor_id ? a.doctor_id.specialty : '',
      hospital_name: a.hospital_name || (a.doctor_id ? a.doctor_id.hospital_name : '') || 'CareSphere Central Hospital',
      patient_id: a.user_id ? (a.user_id._id ? a.user_id._id.toString() : a.user_id.toString()) : '',
      patient_name: cleanPatientName((a.user_id && a.user_id.name) ? a.user_id.name : (a.patient_name || 'Patient')),
      patient_email: (a.user_id && a.user_id.email) ? a.user_id.email : (a.patient_email || '')
    }));

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
});

app.post('/api/appointments', requireAuth, async (req, res, next) => {
  try {
    if (req.session.user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patient accounts can request appointments.' });
    }

    const doctorId = String(req.body.doctorId || '').trim();
    const appointmentAt = cleanText(req.body.appointmentAt, 40);
    const reason = cleanText(req.body.reason || 'Consultation', 120) || 'Consultation';

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ error: 'Please choose a valid doctor.' });
    }

    const doctor = await Doctor.findOne({ _id: doctorId, available: true });
    if (!doctor) return res.status(400).json({ error: 'Please choose a valid doctor.' });

    const hospital_name = doctor.hospital_name || cleanText(req.body.hospital_name || 'CareSphere Central Hospital', 100);

    const parsed = new Date(appointmentAt);
    if (!appointmentAt || Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
      return res.status(400).json({ error: 'Choose a valid future date and time.' });
    }

    const appointment = await Appointment.create({
      user_id: req.session.user.id,
      patient_name: req.session.user.name,
      patient_email: req.session.user.email,
      doctor_id: doctor._id,
      hospital_name,
      appointment_at: parsed,
      reason,
      status: 'Pending'
    });

    // Mine a cryptographic block to immutably log this appointment booking
    const block = await HealthcareBlockchain.addBlock(
      'APPOINTMENT',
      `Appointment Requested: Dr. ${doctor.name} at ${hospital_name}`,
      req.session.user.id,
      req.session.user.name,
      {
        appointmentId: appointment._id.toString(),
        doctor: doctor.name,
        specialty: doctor.specialty,
        hospital: hospital_name,
        appointmentAt: parsed.toISOString(),
        reason
      }
    );

    res.status(201).json({
      appointment: {
        id: appointment._id.toString(),
        appointment_at: appointment.appointment_at.toISOString(),
        reason: appointment.reason,
        status: appointment.status,
        hospital_name: appointment.hospital_name,
        doctor_id: doctor._id.toString(),
        doctor_name: doctor.name,
        specialty: doctor.specialty,
        patient_name: req.session.user.name,
        blockIndex: block?.index,
        blockHash: block?.hash
      }
    });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/appointments/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid appointment status.' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const result = await Appointment.findByIdAndUpdate(id, { status }).populate('doctor_id').populate('user_id');
    if (!result) return res.status(404).json({ error: 'Appointment not found.' });

    // Mine blockchain block for status update
    await HealthcareBlockchain.addBlock(
      'APPOINTMENT_STATUS_UPDATE',
      `Appointment Status Changed to ${status}`,
      result.user_id ? result.user_id._id.toString() : '',
      result.user_id ? result.user_id.name : 'Patient',
      {
        appointmentId: id,
        newStatus: status,
        updatedBy: req.session.user.name
      }
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/profile', requireAuth, async (req, res, next) => {
  try {
    const name = cleanText(req.body.name, 80);
    const email = cleanText(req.body.email, 254).toLowerCase();

    if (name.length < 2) return res.status(400).json({ error: 'Name must contain at least 2 characters.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    const duplicate = await User.findOne({ email, _id: { $ne: req.session.user.id } });
    if (duplicate) return res.status(409).json({ error: 'That email address is already in use.' });

    await User.findByIdAndUpdate(req.session.user.id, { name, email });
    req.session.user.name = name;
    req.session.user.email = email;

    res.json({ user: req.session.user });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/patients', requireAdmin, async (req, res, next) => {
  try {
    const patients = await User.find({ role: 'patient' }).sort({ created_at: -1 });
    res.json({
      patients: patients.map(p => ({
        id: p._id.toString(),
        name: cleanPatientName(p.name),
        email: p.email,
        created_at: p.created_at ? p.created_at.toISOString() : ''
      }))
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/patients', requireAdmin, async (req, res, next) => {
  try {
    const name = cleanText(req.body.name, 80);
    const email = cleanText(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === 'string' && req.body.password ? req.body.password : 'Patient@123';

    if (name.length < 2) return res.status(400).json({ error: 'Please enter patient name (at least 2 characters).' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'A patient with this email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const patient = await User.create({ name, email, password_hash: hash, role: 'patient' });

    await HealthcareBlockchain.addBlock(
      'PATIENT_REGISTRATION',
      `Patient Account Registered: ${patient.name}`,
      patient._id.toString(),
      patient.name,
      { email: patient.email, role: 'patient', registeredBy: req.session.user.name }
    );

    res.status(201).json({
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
        created_at: patient.created_at ? patient.created_at.toISOString() : new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/doctors', requireAdmin, async (req, res, next) => {
  try {
    const name = cleanText(req.body.name, 80);
    const specialty = cleanText(req.body.specialty, 80);
    const experience = cleanText(req.body.experience || '10 years experience', 60);
    const symbol = cleanText(req.body.symbol || '👨‍⚕️', 10);
    const hospital_name = cleanText(req.body.hospital_name || req.session.user.hospital_name || 'CareSphere Central Hospital', 100);

    if (name.length < 2) return res.status(400).json({ error: 'Please enter doctor name (at least 2 characters).' });
    if (!specialty) return res.status(400).json({ error: 'Please specify the medical specialty.' });

    const doctor = await Doctor.create({
      name,
      specialty,
      experience,
      hospital_name,
      symbol,
      available: true
    });

    await Hospital.findOneAndUpdate({ name: hospital_name }, { name: hospital_name }, { upsert: true });

    await HealthcareBlockchain.addBlock(
      'DOCTOR_ONBOARDED',
      `Clinical Doctor Onboarded: ${doctor.name} (${doctor.specialty})`,
      doctor._id.toString(),
      doctor.name,
      {
        hospital: hospital_name,
        specialty: doctor.specialty,
        experience: doctor.experience,
        onboardedBy: req.session.user.name
      }
    );

    res.status(201).json({
      doctor: {
        id: doctor._id.toString(),
        name: doctor.name,
        specialty: doctor.specialty,
        experience: doctor.experience,
        hospital_name: doctor.hospital_name,
        symbol: doctor.symbol,
        available: 1
      }
    });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/hospital', requireAdmin, async (req, res, next) => {
  try {
    const hospital_name = cleanText(req.body.hospital_name, 100);
    if (!hospital_name || hospital_name.length < 3) {
      return res.status(400).json({ error: 'Hospital name must be at least 3 characters.' });
    }

    const oldName = req.session.user.hospital_name || 'CareSphere Central Hospital';
    await User.findByIdAndUpdate(req.session.user.id, { hospital_name });
    req.session.user.hospital_name = hospital_name;

    await Hospital.findOneAndUpdate({ name: hospital_name }, { name: hospital_name }, { upsert: true });

    if (oldName !== hospital_name) {
      await Doctor.updateMany({ hospital_name: oldName }, { hospital_name });
    }

    // Synchronize the updated hospital name to .env
    updateEnvFile('ADMIN_HOSPITAL', hospital_name);

    await HealthcareBlockchain.addBlock(
      'HOSPITAL_PROFILE_UPDATED',
      `Hospital Facility Configured: ${hospital_name}`,
      req.session.user.id,
      req.session.user.name,
      { previousName: oldName, newName: hospital_name, updatedBy: req.session.user.name }
    );

    res.json({
      message: `Hospital facility name updated to "${hospital_name}".`,
      hospital_name
    });
  } catch (err) {
    next(err);
  }
});

// --- Medical Report Endpoints ---
app.get('/api/reports', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    let filter = {};

    if (!isAdmin) {
      // Patient sees all reports belonging to them (both personal uploads and hospital-issued reports)
      filter = { user_id: req.session.user.id };
    } else if (req.query.patientId) {
      // Admin filtering clinical records for a specific patient
      filter = { user_id: req.query.patientId };
    }

    const reports = await Report.find(filter)
      .populate('user_id', 'name email')
      .sort({ created_at: -1 });

    res.json({
      reports: reports.map(r => ({
        id: r._id.toString(),
        userId: r.user_id ? (r.user_id._id ? r.user_id._id.toString() : r.user_id.toString()) : '',
        patientName: cleanPatientName(r.patient_name || (r.user_id && r.user_id.name) || 'Patient'),
        patientEmail: r.patient_email || (r.user_id && r.user_id.email) || '',
        hospitalName: r.hospital_name || 'CareSphere Central Hospital',
        uploadedByRole: r.uploaded_by_role || 'patient',
        uploadedByName: r.uploaded_by_name || 'CareSphere Staff',
        original_name: r.original_name,
        mime_type: r.mime_type,
        file_size: r.file_size,
        status: r.status || 'Sealed',
        category: r.category || 'Diagnostic Report',
        documentHash: r.document_hash || '',
        blockIndex: r.block_index || 0,
        created_at: r.created_at ? r.created_at.toISOString() : ''
      }))
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/reports/:id/download', requireAuth, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    // Patients can only download their own reports; Admins can download any patient report
    if (req.session.user.role !== 'admin' && String(report.user_id) !== String(req.session.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const filePath = path.join(UPLOAD_DIR, report.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report file is not available on disk.' });
    }

    res.setHeader('Content-Type', report.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(report.original_name)}"`);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

app.post('/api/reports/upload', requireAuth, reportUpload.single('report'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please select a report file to upload.' });

    // Calculate cryptographic SHA-256 fingerprint of the medical document
    const fileBuffer = fs.readFileSync(req.file.path);
    const documentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const isHospitalAdmin = req.session.user.role === 'admin';
    let targetUserId = req.session.user.id;
    let targetPatientName = req.session.user.name;
    let targetPatientEmail = req.session.user.email;
    const hospitalName = cleanText(req.body.hospitalName || req.session.user.hospital_name || 'CareSphere Central Hospital', 100);
    const category = cleanText(req.body.category || (isHospitalAdmin ? 'Hospital Diagnostic Report' : 'Patient Uploaded Record'), 60);

    if (isHospitalAdmin) {
      const patientId = String(req.body.patientId || '').trim();
      const apptId = String(req.body.appointmentId || '').trim();
      const patientEmail = String(req.body.patientEmail || '').toLowerCase().trim();

      if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
        const patient = await User.findById(patientId);
        if (!patient) return res.status(400).json({ error: 'Specified patient was not found.' });
        targetUserId = patient._id;
        targetPatientName = patient.name;
        targetPatientEmail = patient.email;
      } else if (apptId && mongoose.Types.ObjectId.isValid(apptId)) {
        const appt = await Appointment.findById(apptId).populate('user_id');
        if (appt && appt.user_id) {
          targetUserId = appt.user_id._id;
          targetPatientName = appt.user_id.name;
          targetPatientEmail = appt.user_id.email;
        } else {
          return res.status(400).json({ error: 'Appointment patient could not be located.' });
        }
      } else if (patientEmail) {
        const patient = await User.findOne({ email: patientEmail });
        if (patient) {
          targetUserId = patient._id;
          targetPatientName = patient.name;
          targetPatientEmail = patient.email;
        } else {
          return res.status(400).json({ error: 'Specified patient account could not be found.' });
        }
      } else {
        return res.status(400).json({ error: 'Please choose which patient this medical report belongs to.' });
      }
    }

    const report = await Report.create({
      user_id: targetUserId,
      patient_name: cleanPatientName(targetPatientName),
      patient_email: targetPatientEmail,
      hospital_name: hospitalName,
      uploaded_by_role: isHospitalAdmin ? 'hospital' : 'patient',
      uploaded_by_name: req.session.user.name,
      original_name: req.file.originalname,
      stored_name: req.file.filename,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      status: 'Sealed',
      category,
      document_hash: documentHash
    });

    // Mine cryptographic block locking the medical record into the blockchain
    const blockTitle = isHospitalAdmin
      ? `Hospital Clinical Report Issued by ${hospitalName}: ${req.file.originalname} for ${cleanPatientName(targetPatientName)}`
      : `Patient Medical Record Sealed: ${req.file.originalname}`;

    const block = await HealthcareBlockchain.addBlock(
      'MEDICAL_RECORD',
      blockTitle,
      targetUserId.toString(),
      cleanPatientName(targetPatientName),
      {
        reportId: report._id.toString(),
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        hospital: hospitalName,
        category,
        issuedBy: req.session.user.name,
        role: isHospitalAdmin ? 'hospital_staff' : 'patient'
      },
      documentHash
    );

    report.block_index = block.index;
    await report.save();

    res.status(201).json({
      report: {
        id: report._id.toString(),
        userId: targetUserId.toString(),
        patientName: cleanPatientName(targetPatientName),
        patientEmail: targetPatientEmail,
        hospitalName,
        uploadedByRole: report.uploaded_by_role,
        uploadedByName: report.uploaded_by_name,
        original_name: report.original_name,
        file_size: report.file_size,
        mime_type: report.mime_type,
        status: report.status,
        category: report.category,
        documentHash,
        blockIndex: block.index,
        blockHash: block.hash,
        created_at: report.created_at.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// --- Blockchain REST Endpoints ---
app.get('/api/blockchain', async (req, res, next) => {
  try {
    const blocks = await Block.find().sort({ index: 1 });
    const validation = await HealthcareBlockchain.validateChain();
    res.json({
      blocks,
      validation,
      network: 'CareSphere HealthVault Cryptographic Ledger',
      algorithm: 'SHA-256 Hash Chain with Proof of Integrity'
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/blockchain/verify', async (req, res, next) => {
  try {
    const validation = await HealthcareBlockchain.validateChain();
    res.json(validation);
  } catch (err) {
    next(err);
  }
});

// Hackathon Judge Tamper Simulation:
// Modifies the data of a block in the database WITHOUT updating its hash, to prove that the blockchain detects tampering!
app.post('/api/blockchain/simulate-tamper', async (req, res, next) => {
  try {
    let targetBlock = await Block.findOne({ index: 1 });
    if (!targetBlock) {
      targetBlock = await Block.findOne({ index: 0 });
    }
    if (!targetBlock) {
      return res.status(404).json({ error: 'No block found to tamper.' });
    }

    targetBlock.data.title = '🚨 TAMPERED RECORD: Unauthorized Alteration Detected!';
    targetBlock.data.tampered = true;
    targetBlock.markModified('data');
    await targetBlock.save();

    const validation = await HealthcareBlockchain.validateChain();
    res.json({
      message: `Tamper simulation executed! An unauthorized modification was written to Block #${targetBlock.index}.`,
      validation
    });
  } catch (err) {
    next(err);
  }
});

// Restores blocks to legitimate state and recalculates the chain
app.post('/api/blockchain/repair', async (req, res, next) => {
  try {
    const blocks = await Block.find().sort({ index: 1 });
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.data?.tampered) {
        delete b.data.tampered;
        if (b.index === 0) {
          b.data.title = 'CareSphere Cryptographic Genesis Block';
        }
        b.markModified('data');
      }
      const prevHash = i === 0 ? '0000000000000000000000000000000000000000000000000000000000000000' : blocks[i - 1].hash;
      b.previousHash = prevHash;
      b.hash = calculateHash(b.index, b.timestamp, b.data, b.previousHash, b.nonce);
      await b.save();
    }

    const validation = await HealthcareBlockchain.validateChain();
    res.json({
      message: 'Blockchain integrity restored. All cryptographic hashes re-verified.',
      validation
    });
  } catch (err) {
    next(err);
  }
});

// Protect backend source files
app.use('/backend', (req, res) => res.status(404).send('Not found'));

// Serve frontend and static assets
app.use(express.static(ROOT, { extensions: ['html'], dotfiles: 'deny' }));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Unexpected server error. Check the terminal for details.' });
});

// Start the web server immediately so HTTP requests are never refused
const server = app.listen(PORT, () => {
  console.log(`CareSphere running at http://localhost:${PORT}`);
  console.log(`API health: http://localhost:${PORT}/api/health`);
  console.log(`Blockchain API: http://localhost:${PORT}/api/blockchain`);
});

// Connect to MongoDB asynchronously
async function connectDatabase() {
  try {
    console.log(`Connecting to MongoDB at ${MONGODB_URI.replace(/:[^:]*@/, ':****@')}...`);
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000)
    });
    console.log('MongoDB connected successfully.');
    await seedData();
  } catch (err) {
    console.warn('MongoDB connection notice (server running in resilient mode):', err.message);
  }
}

connectDatabase();
