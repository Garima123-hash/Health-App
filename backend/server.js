'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const multer = require('multer');

const {
  PORT,
  ROOT,
  UPLOAD_DIR,
  SESSION_SECRET,
  MONGODB_URI
} = require('./config');

const { connectDatabase, getDb } = require('./database/connection');
const { authenticate } = require('./middleware/auth.middleware');
const { seedData } = require('./services/seed.service');
const apiRouter = require('./routes');
const { asyncRoute } = require('./utils/helpers');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.CARESPHERE_DATA_DIR
  ? path.resolve(process.env.CARESPHERE_DATA_DIR)
  : path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let db;
const col = name => db.collection(name);
const nowIso = () => new Date().toISOString();
const cleanEnv = (value, fallback) => typeof value === 'string' && value.trim()
  ? value.trim().slice(0, 120)
  : fallback;
const cleanText = (value, max = 100) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validEmail = email => typeof email === 'string'
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  && email.length <= 254;
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const withoutMongoId = ({ _id, ...document }) => document;

function publicUser(user, hospitalName = '') {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    age: user.age ?? null,
    self_identifies_as_woman: user.role === 'patient' && user.self_identifies_as_woman === true,
    hospital_id: user.hospital_id ?? null,
    hospital_name: hospitalName || user.hospital_name || ''
  };
}

async function userWithHospital(userId) {
  const user = await col('users').findOne({ id: userId });
  if (!user) return null;
  const hospital = user.hospital_id == null ? null : await col('hospitals').findOne({ id: user.hospital_id });
  return publicUser(user, hospital?.name || '');
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readCookie(req, name) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  if (!value) return '';
  try { return decodeURIComponent(value.slice(name.length + 1)); } catch { return ''; }
}

const configuredJwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const JWT_SECRET = configuredJwtSecret || 'local-development-only-change-this-secret';
if (process.env.NODE_ENV === 'production' && (!configuredJwtSecret || Buffer.byteLength(configuredJwtSecret) < 32)) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 bytes before running in production.');
}
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'caresphere.refresh';
const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_MS
};

function createAccessToken(user, familyId) {
  return jwt.sign({ sub: String(user.id), sid: familyId }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    jwtid: crypto.randomUUID(),
    issuer: 'caresphere-api',
    audience: 'caresphere-web'
  });
}

async function issueAuthTokens(user, res) {
  const familyId = crypto.randomUUID();
  const token = crypto.randomBytes(48).toString('base64url');
  await col('auth_refresh_tokens').insertOne({
    token_hash: hashRefreshToken(token),
    family_id: familyId,
    user_id: user.id,
    expires_at: Date.now() + REFRESH_TOKEN_TTL_MS,
    created_at: nowIso()
  });
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions);
  return { user, accessToken: createAccessToken(user, familyId), expiresIn: 900 };
}

async function authenticate(req, res, next) {
  const authorization = req.get('authorization');
  if (!authorization) {
    req.user = null;
    return next();
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return res.status(401).json({ error: 'Use a valid bearer access token.' });
  try {
    const payload = jwt.verify(match[1], JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'caresphere-api',
      audience: 'caresphere-web'
    });
    const user = await userWithHospital(Number(payload.sub));
    if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
    const activeFamily = await col('auth_refresh_tokens').findOne({
      family_id: payload.sid,
      user_id: user.id,
      revoked_at: { $exists: false },
      expires_at: { $gt: Date.now() }
    }, { projection: { _id: 1 } });
    if (!activeFamily) return res.status(401).json({ error: 'Your login has expired. Please sign in again.' });
    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Your access token is invalid or expired. Please sign in again.' });
    }
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  return next();
}

const requireAdmin = asyncRoute(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  const assigned = await col('hospital_admins').findOne({
    user_id: req.user.id, hospital_id: req.user.hospital_id
  }, { projection: { _id: 1 } });
  if (!assigned) return res.status(403).json({ error: 'No hospital is assigned to this administrator account.' });
  return next();
});

function requirePatient(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Patient account access required.' });
  return next();
}

const idFrom = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

function validISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isPastOrToday = value => validISODate(value) && value <= nowIso().slice(0, 10);

async function extractReportSentences(storedName, maxPages = 20) {
  const { getDocument } = await pdfjs;
  const document = await getDocument({
    data: new Uint8Array(fs.readFileSync(path.join(UPLOAD_DIR, storedName))),
    verbosity: 0
  }).promise;
  const sentences = [];
  const pagesRead = Math.min(document.numPages, maxPages);
  for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => 'str' in item ? item.str : '').join(' ').replace(/\s+/g, ' ').trim();
    sentences.push(...(text.match(/[^.!?]+[.!?]?/g) || []).map(sentence => sentence.trim()).filter(sentence => sentence.length > 35));
  }
  return { sentences, pagesRead, totalPages: document.numPages };
}

const allowedReportTypes = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const reportStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) => callback(null, `${process.env.CARESPHERE_UPLOAD_PREFIX || ''}${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const reportUpload = multer({
  storage: reportStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedReportTypes[extension] || allowedReportTypes[extension] !== file.mimetype) {
      return callback(new Error('Only PDF, JPG and PNG files are allowed.'));
    }
    return callback(null, true);
  }
});

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api', asyncRoute(authenticate));
app.locals.getDatabase = () => db;

const starterDoctors = [
  ['Dr. Ananya Mehta', 'Cardiology', '12 years experience'],
  ['Dr. Rahul Kapoor', 'General Medicine', '9 years experience'],
  ['Dr. Priya Nair', 'Dermatology', '8 years experience'],
  ['Dr. Vikram Rao', 'Orthopaedics', '15 years experience'],
  ['Dr. Sana Khan', 'Paediatrics', '10 years experience'],
  ['Dr. Arjun Das', 'Neurology', '11 years experience']
];

async function ensureHospital(name, city = '') {
  const nameKey = name.toLocaleLowerCase('en');
  const existing = await col('hospitals').findOne({ name_key: nameKey });
  if (existing) {
    if (!existing.city && city) await col('hospitals').updateOne({ id: existing.id }, { $set: { city } });
    return existing;
  }
  const hospital = { id: await db.nextId('hospitals'), name, name_key: nameKey, city, phone: '', created_at: nowIso() };
  await col('hospitals').insertOne(hospital);
  return hospital;
}

async function seedData() {
  const defaultHospitalName = cleanEnv(process.env.DEFAULT_HOSPITAL_NAME, 'CareSphere Community Hospital');
  const locations = [
    { name: defaultHospitalName, city: 'Central District' },
    { name: 'CareSphere North Clinic', city: 'North District' },
    { name: 'CareSphere South Clinic', city: 'South District' }
  ].filter((hospital, index, list) => list.findIndex(item => item.name.toLowerCase() === hospital.name.toLowerCase()) === index);
  const hospitals = [];
  for (const location of locations) hospitals.push(await ensureHospital(location.name, location.city));
  await col('users').updateMany({ hospital_id: { $exists: false } }, { $set: { hospital_id: hospitals[0].id } });
  await col('doctors').updateMany({ hospital_id: { $exists: false } }, { $set: { hospital_id: hospitals[0].id } });
  for (const hospital of hospitals) {
    for (const [name, specialty, experience] of starterDoctors) {
      const nameKey = name.toLocaleLowerCase('en');
      if (!await col('doctors').findOne({ hospital_id: hospital.id, name_key: nameKey }, { projection: { _id: 1 } })) {
        try {
          await col('doctors').insertOne({
            id: await db.nextId('doctors'), name, name_key: nameKey, specialty, experience,
            available: true, hospital_id: hospital.id
          });
        } catch (error) {
          if (error.code !== 11000) throw error;
        }
      }
    }
  }
  const email = cleanText(process.env.ADMIN_EMAIL, 254).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;
  if (password.length < 12) {
    console.warn('ADMIN_PASSWORD must be at least 12 characters; administrator seed skipped.');
    return;
  }
  const hospitalName = cleanEnv(process.env.ADMIN_HOSPITAL_NAME, defaultHospitalName);
  const hospital = await ensureHospital(hospitalName);
  const passwordHash = await bcrypt.hash(password, 12);
  let user = await col('users').findOne({ email });
  if (user) {
    await col('users').updateOne({ id: user.id }, { $set: { role: 'admin', password_hash: passwordHash, hospital_id: hospital.id } });
  } else {
    user = {
      id: await db.nextId('users'), name: 'CareSphere Administrator', email,
      password_hash: passwordHash, role: 'admin', hospital_id: hospital.id,
      womens_health_enabled: false, created_at: nowIso()
    };
    await col('users').insertOne(user);
  }
  const assignments = [hospital, ...hospitals];
  for (const assignedHospital of assignments) {
    if (!await col('hospital_admins').findOne(
      { user_id: user.id, hospital_id: assignedHospital.id }, { projection: { _id: 1 } }
    )) {
      try {
        await col('hospital_admins').insertOne({
          id: await db.nextId('hospital_admins'), user_id: user.id, hospital_id: assignedHospital.id
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
  }
  console.log(`Administrator account configured for ${email}`);
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'CareSphere API', database: 'connected' }));
app.get('/api/hospitals', asyncRoute(async (_req, res) => {
  const hospitals = await col('hospitals').find({}, { projection: { _id: 0, id: 1, name: 1, city: 1 } }).sort({ name: 1 }).toArray();
  res.json({ hospitals });
}));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name, 80);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const hospitalId = idFrom(req.body.hospitalId);
  const age = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
  const selfIdentifiesAsWoman = req.body.selfIdentifiesAsWoman === true;
  if (req.body.selfIdentifiesAsWoman !== undefined && typeof req.body.selfIdentifiesAsWoman !== 'boolean') {
    return res.status(400).json({ error: 'Choose whether you self-identify as a woman.' });
  }
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must contain 8–128 characters.' });
  if (!hospitalId || !await col('hospitals').findOne({ id: hospitalId }, { projection: { _id: 1 } })) {
    return res.status(400).json({ error: 'Choose a hospital for your patient account.' });
  }
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) return res.status(400).json({ error: 'Age must be a whole number between 0 and 120.' });
  if (await col('users').findOne({ email }, { projection: { _id: 1 } })) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  const user = {
    id: await db.nextId('users'), name, email, password_hash: await bcrypt.hash(password, 12),
    role: 'patient', age, hospital_id: hospitalId, self_identifies_as_woman: selfIdentifiesAsWoman,
    womens_health_enabled: false, created_at: nowIso()
  };
  try {
    await col('users').insertOne(user);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    throw error;
  }
  let claimedPrescriptions = 0;
  const pending = col('pending_prescriptions');
  while (true) {
    const pendingPrescription = await pending.findOneAndDelete({
      hospital_id: hospitalId, patient_email: email, claimed_by: { $exists: false }
    }, { includeResultMetadata: false });
    if (!pendingPrescription) break;
    try {
      const { _id, id, ...fields } = pendingPrescription;
      await col('prescriptions').insertOne({
        ...fields, id: await db.nextId('prescriptions'), user_id: user.id, source_pending_id: id,
        created_at: fields.created_at || nowIso()
      });
      claimedPrescriptions += 1;
    } catch (error) {
      await pending.insertOne(pendingPrescription).catch(() => {});
      throw error;
    }
  }
  const publicUserData = publicUser(user, (await col('hospitals').findOne({ id: hospitalId })).name);
  const tokens = await issueAuthTokens(publicUserData, res);
  return res.status(201).json({ ...tokens, claimedPrescriptions });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!validEmail(email) || !password) return res.status(400).json({ error: 'Enter your email address and password.' });
  const user = await col('users').findOne({ email });
  if (!user || !await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  return res.json(await issueAuthTokens(await userWithHospital(user.id), res));
}));

app.post('/api/auth/refresh', asyncRoute(async (req, res) => {
  const token = readCookie(req, REFRESH_COOKIE);
  const clearCookie = () => res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/auth'
  });
  if (!token) {
    clearCookie();
    return res.status(401).json({ error: 'Refresh token is missing. Please sign in again.' });
  }
  const tokens = col('auth_refresh_tokens');
  const tokenHash = hashRefreshToken(token);
  const current = await tokens.findOne({ token_hash: tokenHash });
  if (!current) {
    clearCookie();
    return res.status(401).json({ error: 'Refresh token is invalid. Please sign in again.' });
  }
  if (current.revoked_at !== undefined) {
    await tokens.updateMany({ family_id: current.family_id, revoked_at: { $exists: false } }, { $set: { revoked_at: Date.now() } });
    clearCookie();
    return res.status(401).json({ error: 'Refresh token reuse detected. Please sign in again.' });
  }
  const now = Date.now();
  if (current.expires_at <= now) {
    await tokens.updateOne({ token_hash: tokenHash, revoked_at: { $exists: false } }, { $set: { revoked_at: now } });
    clearCookie();
    return res.status(401).json({ error: 'Refresh token expired. Please sign in again.' });
  }
  const nextToken = crypto.randomBytes(48).toString('base64url');
  const rotation = await tokens.updateOne(
    { token_hash: tokenHash, revoked_at: { $exists: false }, expires_at: { $gt: now } },
    { $set: { revoked_at: now } }
  );
  if (!rotation.modifiedCount) {
    await tokens.updateMany({ family_id: current.family_id, revoked_at: { $exists: false } }, { $set: { revoked_at: now } });
    clearCookie();
    return res.status(401).json({ error: 'Refresh token reuse detected. Please sign in again.' });
  }
  await tokens.insertOne({
    token_hash: hashRefreshToken(nextToken), family_id: current.family_id, user_id: current.user_id,
    expires_at: now + REFRESH_TOKEN_TTL_MS, created_at: nowIso()
  });
  const user = await userWithHospital(current.user_id);
  if (!user) {
    await tokens.updateMany({ family_id: current.family_id, revoked_at: { $exists: false } }, { $set: { revoked_at: now } });
    clearCookie();
    return res.status(401).json({ error: 'Account no longer exists. Please sign in again.' });
  }
  res.cookie(REFRESH_COOKIE, nextToken, refreshCookieOptions);
  return res.json({ user, accessToken: createAccessToken(user, current.family_id), expiresIn: 900 });
}));

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));
app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  const token = readCookie(req, REFRESH_COOKIE);
  if (token) {
    const current = await col('auth_refresh_tokens').findOne({ token_hash: hashRefreshToken(token) });
    if (current) await col('auth_refresh_tokens').updateMany(
      { family_id: current.family_id, revoked_at: { $exists: false } }, { $set: { revoked_at: Date.now() } }
    );
  }
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/auth'
  });
  return res.json({ ok: true });
}));

app.get('/api/hospital/me', requireAuth, asyncRoute(async (req, res) => {
  const hospital = await col('hospitals').findOne(
    { id: req.user.hospital_id }, { projection: { _id: 0, id: 1, name: 1, city: 1, phone: 1 } }
  );
  if (!hospital) return res.status(404).json({ error: 'Your hospital is not available.' });
  return res.json({ hospital });
}));
app.get('/api/admin/hospitals', requireAdmin, asyncRoute(async (req, res) => {
  const assignments = await col('hospital_admins').find({ user_id: req.user.id }).toArray();
  const ids = assignments.map(item => item.hospital_id);
  const hospitals = await col('hospitals').find({ id: { $in: ids } }, {
    projection: { _id: 0, id: 1, name: 1, city: 1, phone: 1 }
  }).sort({ name: 1 }).toArray();
  return res.json({ hospitals });
}));
app.post('/api/admin/hospitals', requireAdmin, asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const city = cleanText(req.body.city, 100);
  if (name.length < 3) return res.status(400).json({ error: 'Hospital name must contain at least 3 characters.' });
  const hospital = {
    id: await db.nextId('hospitals'), name, name_key: name.toLocaleLowerCase('en'),
    city, phone: '', created_at: nowIso()
  };
  try { await col('hospitals').insertOne(hospital); } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A hospital with that name already exists.' });
    throw error;
  }
  await col('hospital_admins').insertOne({
    id: await db.nextId('hospital_admins'), user_id: req.user.id, hospital_id: hospital.id
  });
  return res.status(201).json({ hospital: withoutMongoId(hospital) });
}));
app.post('/api/admin/hospitals/select', requireAdmin, asyncRoute(async (req, res) => {
  const hospitalId = idFrom(req.body.hospitalId);
  if (!hospitalId) return res.status(403).json({ error: 'You are not assigned to that hospital.' });
  const [hospital, assignment] = await Promise.all([
    col('hospitals').findOne({ id: hospitalId }, { projection: { _id: 0, id: 1, name: 1, city: 1, phone: 1 } }),
    col('hospital_admins').findOne({ user_id: req.user.id, hospital_id: hospitalId }, { projection: { _id: 1 } })
  ]);
  if (!hospital || !assignment) return res.status(403).json({ error: 'You are not assigned to that hospital.' });
  await col('users').updateOne({ id: req.user.id }, { $set: { hospital_id: hospital.id } });
  req.user.hospital_id = hospital.id;
  req.user.hospital_name = hospital.name;
  return res.json({ hospital });
}));
app.patch('/api/admin/hospital', requireAdmin, asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const city = cleanText(req.body.city, 100);
  const phone = cleanText(req.body.phone, 40);
  if (name.length < 3) return res.status(400).json({ error: 'Hospital name must contain at least 3 characters.' });
  const nameKey = name.toLocaleLowerCase('en');
  if (await col('hospitals').findOne({ name_key: nameKey, id: { $ne: req.user.hospital_id } }, { projection: { _id: 1 } })) {
    return res.status(409).json({ error: 'Another hospital already uses that name.' });
  }
  await col('hospitals').updateOne({ id: req.user.hospital_id }, { $set: { name, name_key: nameKey, city, phone } });
  req.user.hospital_name = name;
  const hospital = await col('hospitals').findOne(
    { id: req.user.hospital_id }, { projection: { _id: 0, id: 1, name: 1, city: 1, phone: 1 } }
  );
  return res.json({ hospital });
}));

app.get('/api/doctors', requireAuth, asyncRoute(async (req, res) => {
  const filter = { hospital_id: req.user.hospital_id };
  if (req.user.role !== 'admin') filter.available = true;
  const doctors = await col('doctors').find(filter, {
    projection: { _id: 0, id: 1, name: 1, specialty: 1, experience: 1, available: 1 }
  }).sort({ name: 1 }).toArray();
  return res.json({ doctors });
}));
app.post('/api/admin/doctors', requireAdmin, asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const specialty = cleanText(req.body.specialty, 80);
  const experience = cleanText(req.body.experience, 80);
  if (name.length < 3) return res.status(400).json({ error: 'Enter a doctor name with at least 3 characters.' });
  if (specialty.length < 2) return res.status(400).json({ error: 'Enter a specialty with at least 2 characters.' });
  const doctor = {
    id: await db.nextId('doctors'), name, name_key: name.toLocaleLowerCase('en'), specialty,
    experience, available: true, hospital_id: req.user.hospital_id
  };
  try { await col('doctors').insertOne(doctor); } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A doctor with that name already exists at this hospital.' });
    throw error;
  }
  return res.status(201).json({ doctor: withoutMongoId(doctor) });
}));
app.patch('/api/admin/doctors/:id', requireAdmin, asyncRoute(async (req, res) => {
  if (typeof req.body.available !== 'boolean') return res.status(400).json({ error: 'Availability must be true or false.' });
  const result = await col('doctors').updateOne(
    { id: idFrom(req.params.id), hospital_id: req.user.hospital_id },
    { $set: { available: req.body.available } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Doctor not found.' });
  return res.json({ ok: true });
}));

async function appointmentRows(user) {
  const filter = user.role === 'admin'
    ? { hospital_id: user.hospital_id }
    : { user_id: user.id, hospital_id: user.hospital_id };
  const doctors = await col('doctors').find(filter.hospital_id ? { hospital_id: filter.hospital_id } : {}).toArray();
  const doctorIds = doctors.map(doctor => doctor.id);
  const appointmentFilter = user.role === 'admin'
    ? { doctor_id: { $in: doctorIds } }
    : { user_id: user.id, doctor_id: { $in: doctorIds } };
  const appointments = await col('appointments').find(appointmentFilter).sort({ appointment_at: 1 }).toArray();
  const userIds = [...new Set(appointments.map(item => item.user_id))];
  const patients = await col('users').find({ id: { $in: userIds } }).toArray();
  const doctorById = new Map(doctors.map(item => [item.id, item]));
  const userByIdMap = new Map(patients.map(item => [item.id, item]));
  return appointments.map(item => {
    const doctor = doctorById.get(item.doctor_id);
    const patient = userByIdMap.get(item.user_id);
    return {
      id: item.id, appointment_at: item.appointment_at, reason: item.reason, status: item.status,
      created_at: item.created_at, doctor_id: item.doctor_id, doctor_name: doctor?.name || '',
      specialty: doctor?.specialty || '', patient_name: patient?.name || '', patient_email: patient?.email || ''
    };
  });
}

app.get('/api/appointments', requireAuth, asyncRoute(async (req, res) => res.json({ appointments: await appointmentRows(req.user) })));
app.post('/api/appointments', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts can request appointments.' });
  const doctorId = idFrom(req.body.doctorId);
  const appointmentAt = cleanText(req.body.appointmentAt, 40);
  const reason = cleanText(req.body.reason, 120);
  const visitReasons = ['General consultation', 'Follow-up visit', 'New or worsening symptoms', 'Prescription review', 'Test results discussion', 'Preventive check-up'];
  if (!visitReasons.includes(reason) && !/^Other: .{1,110}$/.test(reason)) return res.status(400).json({ error: 'Choose a visit reason or briefly describe another reason.' });
  const doctor = doctorId && await col('doctors').findOne({ id: doctorId, available: true, hospital_id: req.user.hospital_id });
  if (!doctor) return res.status(400).json({ error: 'Please choose a valid doctor.' });
  const parsed = new Date(appointmentAt);
  if (!appointmentAt || Number.isNaN(parsed.getTime()) || parsed <= new Date()) return res.status(400).json({ error: 'Choose a valid future date and time.' });
  const appointment = {
    id: await db.nextId('appointments'), user_id: req.user.id, doctor_id: doctorId,
    appointment_at: parsed.toISOString(), reason, status: 'Pending', created_at: nowIso()
  };
  await col('appointments').insertOne(appointment);
  return res.status(201).json({ appointment: {
    id: appointment.id, appointment_at: appointment.appointment_at, reason, status: appointment.status,
    doctor_id: doctor.id, doctor_name: doctor.name, specialty: doctor.specialty
  } });
}));
app.patch('/api/appointments/:id/status', requireAdmin, asyncRoute(async (req, res) => {
  const status = req.body.status;
  if (!['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid appointment status.' });
  const doctors = await col('doctors').find({ hospital_id: req.user.hospital_id }, { projection: { id: 1 } }).toArray();
  const result = await col('appointments').updateOne(
    { id: idFrom(req.params.id), doctor_id: { $in: doctors.map(item => item.id) } }, { $set: { status } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Appointment not found.' });
  return res.json({ ok: true });
}));
app.patch('/api/profile', requireAuth, asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name, 80);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const age = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
  if (req.user.role === 'patient' && req.body.selfIdentifiesAsWoman !== undefined
      && typeof req.body.selfIdentifiesAsWoman !== 'boolean') {
    return res.status(400).json({ error: 'Choose whether you self-identify as a woman.' });
  }
  if (name.length < 2) return res.status(400).json({ error: 'Name must contain at least 2 characters.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (req.user.role === 'patient' && age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) return res.status(400).json({ error: 'Age must be a whole number between 0 and 120.' });
  if (await col('users').findOne({ email, id: { $ne: req.user.id } }, { projection: { _id: 1 } })) return res.status(409).json({ error: 'That email address is already in use.' });
  try {
    const updates = { name, email, age: req.user.role === 'patient' ? age : null };
    if (req.user.role === 'patient' && req.body.selfIdentifiesAsWoman !== undefined) {
      updates.self_identifies_as_woman = req.body.selfIdentifiesAsWoman;
      if (!req.body.selfIdentifiesAsWoman) updates.womens_health_enabled = false;
    }
    await col('users').updateOne({ id: req.user.id }, { $set: updates });
    if (req.user.role === 'patient' && req.body.selfIdentifiesAsWoman === false) {
      await Promise.all([
        col('womens_health_mood_entries').deleteMany({ user_id: req.user.id }),
        col('womens_health_cycle_entries').deleteMany({ user_id: req.user.id })
      ]);
    }
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That email address is already in use.' });
    throw error;
  }
  Object.assign(req.user, { name, email, age: req.user.role === 'patient' ? age : null });
  if (req.user.role === 'patient' && req.body.selfIdentifiesAsWoman !== undefined) {
    req.user.self_identifies_as_woman = req.body.selfIdentifiesAsWoman;
  }
  return res.json({ user: req.user });
}));

const womensHealthGuideLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
app.get('/api/admin/womens-health/knowledge', requireAdmin, asyncRoute(async (req, res) => {
  const documents = await col('womens_health_knowledge_documents').find(
    { hospital_id: req.user.hospital_id },
    { projection: { _id: 0, id: 1, original_name: 1, created_at: 1 } }
  ).sort({ created_at: -1 }).toArray();
  return res.json({ documents });
}));
app.post('/api/admin/womens-health/knowledge', requireAdmin, (req, res, next) => {
  reportUpload.single('document')(req, res, error => {
    if (error) return next(error);
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF education resource to upload.' });
    const removeUpload = async () => {
      try { await fs.promises.unlink(req.file.path); }
      catch (unlinkError) {
        if (unlinkError.code !== 'ENOENT') console.error('Could not remove temporary knowledge upload:', unlinkError.message);
      }
    };
    (async () => {
      if (req.file.mimetype !== 'application/pdf') {
        await removeUpload();
        return res.status(415).json({ error: 'Only text-based PDF resources can be added to the knowledge library.' });
      }
      const { sentences } = await extractReportSentences(req.file.filename, 30);
      const text = sentences.join(' ').slice(0, 120000);
      await removeUpload();
      if (!text.trim()) return res.status(422).json({ error: 'No selectable text was found in this PDF.' });
      const originalName = path.basename(req.file.originalname).replace(/[\r\n"]/g, '_').slice(0, 160);
      const document = {
        id: await db.nextId('womens_health_knowledge_documents'),
        hospital_id: req.user.hospital_id,
        original_name: originalName,
        text,
        uploaded_by: req.user.id,
        created_at: nowIso()
      };
      await col('womens_health_knowledge_documents').insertOne(document);
      return res.status(201).json({
        document: { id: document.id, original_name: document.original_name, created_at: document.created_at }
      });
    })().catch(async uploadError => {
      await removeUpload();
      next(uploadError);
    });
  });
});
app.delete('/api/admin/womens-health/knowledge/:id', requireAdmin, asyncRoute(async (req, res) => {
  const result = await col('womens_health_knowledge_documents').deleteOne({
    id: idFrom(req.params.id), hospital_id: req.user.hospital_id
  });
  if (!result.deletedCount) return res.status(404).json({ error: 'Knowledge resource not found.' });
  return res.json({ ok: true });
}));
app.get('/api/womens-health', requirePatient, asyncRoute(async (req, res) => {
  const user = await col('users').findOne({ id: req.user.id }, { projection: { womens_health_enabled: 1, self_identifies_as_woman: 1 } });
  if (!user?.self_identifies_as_woman) return res.status(403).json({ error: 'This section is available to patients who self-identify as women.' });
  if (!user?.womens_health_enabled) return res.json({ enabled: false });
  const [moodEntries, cycleEntries, reportOptions] = await Promise.all([
    col('womens_health_mood_entries').find({ user_id: req.user.id }, { projection: { _id: 0, id: 1, entry_date: 1, mood: 1, stress_level: 1, sleep_hours: 1, energy_level: 1, symptoms: 1 } }).sort({ entry_date: -1 }).limit(30).toArray(),
    col('womens_health_cycle_entries').find({ user_id: req.user.id }, { projection: { _id: 0, id: 1, start_date: 1, end_date: 1 } }).sort({ start_date: -1 }).limit(24).toArray(),
    col('reports').find({ user_id: req.user.id, mime_type: 'application/pdf' }, { projection: { _id: 0, id: 1, original_name: 1, created_at: 1 } }).sort({ created_at: -1 }).limit(10).toArray()
  ]);
  return res.json({ enabled: true, moodEntries, cycleEntries, reportOptions, funFacts });
}));
app.post('/api/womens-health/consent', requirePatient, asyncRoute(async (req, res) => {
  if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ error: 'Choose whether to enable the optional Women’s Health section.' });
  if (req.body.enabled) {
    const user = await col('users').findOne({ id: req.user.id }, { projection: { self_identifies_as_woman: 1 } });
    if (!user?.self_identifies_as_woman) return res.status(403).json({ error: 'This section is available to patients who self-identify as women.' });
  }
  await col('users').updateOne({ id: req.user.id }, { $set: { womens_health_enabled: req.body.enabled } });
  return res.json({ enabled: req.body.enabled });
}));
app.post('/api/womens-health/mood', requirePatient, asyncRoute(async (req, res) => {
  const user = await col('users').findOne({ id: req.user.id }, { projection: { womens_health_enabled: 1, self_identifies_as_woman: 1 } });
  if (!user?.self_identifies_as_woman) return res.status(403).json({ error: 'This section is available to patients who self-identify as women.' });
  if (!user?.womens_health_enabled) return res.status(403).json({ error: 'Enable the optional Women’s Health section before saving check-ins.' });
  const { entryDate, mood, stressLevel, sleepHours, energyLevel } = req.body;
  const allowedMoods = ['great', 'good', 'okay', 'low', 'very_low'];
  const allowedSymptoms = ['anxiety', 'irritability', 'fatigue', 'cramps', 'headache', 'bloating', 'acne', 'irregular_periods'];
  const symptoms = req.body.symptoms;
  const stress = Number(stressLevel);
  const sleep = Number(sleepHours);
  const energy = Number(energyLevel);
  if (!isPastOrToday(entryDate) || entryDate < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Choose a check-in date within the past year, not a future date.' });
  }
  if (!allowedMoods.includes(mood)) return res.status(400).json({ error: 'Choose a mood from the list.' });
  if (!Number.isInteger(stress) || stress < 1 || stress > 5) return res.status(400).json({ error: 'Stress level must be from 1 to 5.' });
  if (!Number.isFinite(sleep) || sleep < 0 || sleep > 24) return res.status(400).json({ error: 'Sleep hours must be between 0 and 24.' });
  if (!Number.isInteger(energy) || energy < 1 || energy > 5) return res.status(400).json({ error: 'Energy level must be from 1 to 5.' });
  if (!Array.isArray(symptoms) || symptoms.length > allowedSymptoms.length || symptoms.some(item => !allowedSymptoms.includes(item)) || new Set(symptoms).size !== symptoms.length) {
    return res.status(400).json({ error: 'Choose valid symptoms from the check-in list.' });
  }
  await col('womens_health_mood_entries').updateOne(
    { user_id: req.user.id, entry_date: entryDate },
    { $set: { mood, stress_level: stress, sleep_hours: sleep, energy_level: energy, symptoms },
      $setOnInsert: { id: await db.nextId('womens_health_mood_entries'), user_id: req.user.id, entry_date: entryDate, created_at: nowIso() } },
    { upsert: true }
  );
  return res.status(201).json({ ok: true, entryDate });
}));
app.post('/api/womens-health/cycle', requirePatient, asyncRoute(async (req, res) => {
  const user = await col('users').findOne({ id: req.user.id }, { projection: { womens_health_enabled: 1, self_identifies_as_woman: 1 } });
  if (!user?.self_identifies_as_woman) return res.status(403).json({ error: 'This section is available to patients who self-identify as women.' });
  if (!user?.womens_health_enabled) return res.status(403).json({ error: 'Enable the optional Women’s Health section before saving cycle dates.' });
  const { startDate } = req.body;
  const endDate = req.body.endDate || null;
  if (!isPastOrToday(startDate) || startDate < new Date(Date.now() - 5 * 366 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Choose a period start date within the past five years, not a future date.' });
  }
  if (endDate !== null && (!isPastOrToday(endDate) || endDate < startDate)) return res.status(400).json({ error: 'End date must be on or after the start date and not in the future.' });
  await col('womens_health_cycle_entries').updateOne(
    { user_id: req.user.id, start_date: startDate },
    { $set: { end_date: endDate }, $setOnInsert: { id: await db.nextId('womens_health_cycle_entries'), user_id: req.user.id, start_date: startDate, created_at: nowIso() } },
    { upsert: true }
  );
  return res.status(201).json({ ok: true, startDate, endDate });
}));
app.post('/api/womens-health/guide', womensHealthGuideLimiter, requirePatient, asyncRoute(async (req, res) => {
  const user = await col('users').findOne({ id: req.user.id }, { projection: { womens_health_enabled: 1, self_identifies_as_woman: 1 } });
  if (!user?.self_identifies_as_woman) return res.status(403).json({ error: 'This section is available to patients who self-identify as women.' });
  if (!user?.womens_health_enabled) return res.status(403).json({ error: 'Enable the optional Women’s Health section before using the health guide.' });
  const question = cleanText(req.body.question, 500);
  if (question.length < 3) return res.status(400).json({ error: 'Enter a health question of at least 3 characters.' });
  if (req.body.includeMoodHistory !== undefined && typeof req.body.includeMoodHistory !== 'boolean') return res.status(400).json({ error: 'Choose whether to include mood check-ins.' });
  if (req.body.includeReports !== undefined && typeof req.body.includeReports !== 'boolean') return res.status(400).json({ error: 'Choose whether to include uploaded reports.' });
  const includeMoodHistory = req.body.includeMoodHistory === true;
  const includeReports = req.body.includeReports === true;
  const reportIds = req.body.reportIds === undefined ? [] : req.body.reportIds;
  if (!Array.isArray(reportIds) || reportIds.length > 3 || reportIds.some(id => !Number.isSafeInteger(Number(id)) || Number(id) < 1) || new Set(reportIds.map(Number)).size !== reportIds.length) {
    return res.status(400).json({ error: 'Select up to three valid PDF reports.' });
  }
  if (!includeReports && reportIds.length) return res.status(400).json({ error: 'Confirm report use before selecting medical history files.' });
  const uploadedDocuments = await col('womens_health_knowledge_documents').find(
    { hospital_id: req.user.hospital_id },
    { projection: { _id: 0, id: 1, original_name: 1, text: 1 } }
  ).sort({ created_at: -1 }).limit(50).toArray();
  const knowledge = retrieveKnowledge(question, uploadedDocuments.map(document => ({
    id: document.id,
    title: `Hospital resource: ${document.original_name}`,
    text: document.text
  })));
  const reportsUsed = [];
  const reportMatches = [];
  for (const id of reportIds.map(Number)) {
    const report = await col('reports').findOne({ id, user_id: req.user.id });
    if (!report) return res.status(404).json({ error: 'A selected report was not found in your account.' });
    if (report.mime_type !== 'application/pdf') return res.status(415).json({ error: 'Only text-based PDF reports can be searched locally.' });
    const { sentences } = await extractReportSentences(report.stored_name, 10);
    const queryTerms = new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    const matches = sentences.map((text, index) => ({
      text, index,
      score: [...new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter(word => queryTerms.has(word)).length
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2);
    reportsUsed.push({ id: report.id, name: report.original_name, hadSelectableText: sentences.length > 0 });
    reportMatches.push(...matches.map(match => ({ reportName: report.original_name, excerpt: match.text.slice(0, 350) })));
  }
  let moodReflection = null;
  if (includeMoodHistory) {
    const entries = await col('womens_health_mood_entries').find(
      { user_id: req.user.id }, { projection: { _id: 0, entry_date: 1, mood: 1, stress_level: 1, sleep_hours: 1, energy_level: 1 } }
    ).sort({ entry_date: -1 }).limit(30).toArray();
    const lowerMoodCount = entries.filter(entry => entry.mood === 'low' || entry.mood === 'very_low').length;
    const averageStress = entries.length ? Number((entries.reduce((total, entry) => total + entry.stress_level, 0) / entries.length).toFixed(1)) : null;
    moodReflection = {
      checkInsReviewed: entries.length, lowerMoodCheckIns: lowerMoodCount, averageStressLevel: averageStress,
      message: entries.length
        ? 'This is a simple count of your own recent check-ins, not a mental-health assessment or explanation of why you felt this way.'
        : 'There are no mood check-ins to include yet.'
    };
  }
  const mentionsPcos = /\b(pcos|pcod|polycystic|ovarian)\b/i.test(question);
  const answer = [
    mentionsPcos
      ? 'I cannot determine whether you have PCOS/PCOD from symptoms, mood check-ins, or uploaded records. A clinician needs to review your health history and may use an examination or tests to consider other causes.'
      : 'This is general health education, not a diagnosis or personalized treatment plan.',
    ...(knowledge.length ? knowledge.map(item => item.text) : ['I could not find a close match in the local health-information library. Try asking about PCOS/PCOD, clinical assessment, balanced eating, or mood check-ins, and discuss personal concerns with a clinician.']),
    ...(reportMatches.length ? ['Selected report text that matched your question is shown separately as an unverified excerpt; the app does not interpret it.'] : []),
    'Do not start, stop, or change medicines, supplements, or a restrictive diet based on this guide. Contact a qualified clinician for advice about your situation.'
  ].join('\n\n');
  return res.json({
    method: 'local-keyword-rag', answer,
    sources: knowledge.map(({ id, title, url }) => ({ id, title, url })),
    reportMatches, reportsUsed, moodReflection,
    notice: 'Local retrieval only: no external AI model or service is connected. This feature does not diagnose PCOS/PCOD, interpret medical records, or provide treatment advice.'
  });
}));
app.delete('/api/womens-health/data', requirePatient, asyncRoute(async (req, res) => {
  await Promise.all([
    col('womens_health_mood_entries').deleteMany({ user_id: req.user.id }),
    col('womens_health_cycle_entries').deleteMany({ user_id: req.user.id }),
    col('users').updateOne({ id: req.user.id }, { $set: { womens_health_enabled: false } })
  ]);
  return res.json({ ok: true, enabled: false });
}));

app.get('/api/admin/patients', requireAdmin, asyncRoute(async (req, res) => {
  const patients = await col('users').find({ role: 'patient', hospital_id: req.user.hospital_id }, {
    projection: { _id: 0, id: 1, name: 1, email: 1, age: 1, created_at: 1 }
  }).sort({ created_at: -1 }).toArray();
  return res.json({ patients });
}));
app.get('/api/reports', requireAuth, asyncRoute(async (req, res) => {
  const reports = await col('reports').find({ user_id: req.user.id }, {
    projection: { _id: 0, id: 1, original_name: 1, mime_type: 1, file_size: 1, status: 1, shared_with_hospital: 1, summary_count: 1, summary_last_used_at: 1, created_at: 1 }
  }).sort({ created_at: -1 }).toArray();
  return res.json({ reports: reports.map(report => ({ ...report, shared_with_hospital: report.shared_with_hospital ? 1 : 0 })) });
}));
app.get('/api/admin/reports', requireAdmin, asyncRoute(async (req, res) => {
  const users = await col('users').find({ hospital_id: req.user.hospital_id }, { projection: { id: 1, name: 1, email: 1 } }).toArray();
  const patientById = new Map(users.map(user => [user.id, user]));
  const reports = await col('reports').find(
    { user_id: { $in: users.map(user => user.id) }, shared_with_hospital: true },
    { projection: { _id: 0, id: 1, original_name: 1, mime_type: 1, file_size: 1, created_at: 1, user_id: 1 } }
  ).sort({ created_at: -1 }).toArray();
  return res.json({ reports: reports.map(report => ({
    id: report.id, original_name: report.original_name, mime_type: report.mime_type, file_size: report.file_size,
    created_at: report.created_at, patient_name: patientById.get(report.user_id)?.name || '',
    patient_email: patientById.get(report.user_id)?.email || ''
  })) });
}));
app.post('/api/reports', requireAuth, asyncRoute(async (req, res, next) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Medical history uploads are available to patient accounts.' });
  reportUpload.single('report')(req, res, error => {
    if (error) return next(error);
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF, JPG, or PNG report to upload.' });
    (async () => {
      const originalName = path.basename(req.file.originalname).replace(/[\r\n"]/g, '_').slice(0, 160);
      const report = {
        id: await db.nextId('reports'), user_id: req.user.id, original_name: originalName,
        stored_name: req.file.filename, mime_type: req.file.mimetype, file_size: req.file.size,
        shared_with_hospital: req.body.shareWithHospital === 'true', summary_count: 0,
        summary_last_used_at: null, status: 'Uploaded', created_at: nowIso()
      };
      try {
        await col('reports').insertOne(report);
        return res.status(201).json({ report: {
          id: report.id, original_name: originalName, mime_type: report.mime_type,
          file_size: report.file_size, shared_with_hospital: report.shared_with_hospital ? 1 : 0, status: report.status
        } });
      } catch (insertError) {
        fs.unlink(req.file.path, unlinkError => {
          if (unlinkError) console.error('Could not remove report upload after database error:', unlinkError);
          next(insertError);
        });
      }
    })().catch(next);
  });
}));
app.get('/api/reports/:id/download', requireAuth, asyncRoute(async (req, res) => {
  const reportId = idFrom(req.params.id);
  let report;
  if (req.user.role === 'admin') {
    const assigned = await col('hospital_admins').findOne({ user_id: req.user.id, hospital_id: req.user.hospital_id });
    if (!assigned) return res.status(403).json({ error: 'This administrator is not assigned to the active hospital.' });
    const users = await col('users').find({ hospital_id: req.user.hospital_id }, { projection: { id: 1 } }).toArray();
    report = await col('reports').findOne({
      id: reportId, shared_with_hospital: true, user_id: { $in: users.map(user => user.id) }
    });
  } else {
    report = await col('reports').findOne({ id: reportId, user_id: req.user.id });
  }
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  return res.download(path.join(UPLOAD_DIR, report.stored_name), report.original_name, error => {
    if (error && !res.headersSent) res.status(404).json({ error: 'The report file is no longer available.' });
  });
}));
app.patch('/api/reports/:id/share', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts control report sharing.' });
  if (typeof req.body.shared !== 'boolean') return res.status(400).json({ error: 'Choose whether to share this report with your hospital.' });
  const result = await col('reports').updateOne(
    { id: idFrom(req.params.id), user_id: req.user.id }, { $set: { shared_with_hospital: req.body.shared } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Report not found.' });
  return res.json({ ok: true, shared_with_hospital: req.body.shared });
}));
app.post('/api/reports/:id/summary', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Report summaries are available to the patient who uploaded the file.' });
  const report = await col('reports').findOne({ id: idFrom(req.params.id), user_id: req.user.id });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  if (report.mime_type !== 'application/pdf') return res.status(415).json({ error: 'The local text summary currently supports text-based PDF files only.' });
  const { sentences, pagesRead, totalPages } = await extractReportSentences(report.stored_name);
  if (!sentences.length) return res.status(422).json({ error: 'No selectable text was found. Scanned PDFs and images need OCR, which is not enabled.' });
  const stopWords = new Set('about after again against also among because before being between could does during each from further have having into more most other over same should some such than that their them then there these they this through under until very what when where which while with would your'.split(' '));
  const frequencies = new Map();
  for (const word of sentences.join(' ').toLowerCase().match(/[a-z]{3,}/g) || []) {
    if (!stopWords.has(word)) frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }
  const ranked = sentences.map((sentence, index) => {
    const words = sentence.toLowerCase().match(/[a-z]{3,}/g) || [];
    return { sentence, index, score: words.reduce((sum, word) => sum + (frequencies.get(word) || 0), 0) / Math.max(words.length, 1) };
  }).sort((a, b) => b.score - a.score).slice(0, 4).sort((a, b) => a.index - b.index);
  const lastUsedAt = nowIso();
  const usageUpdate = await col('reports').findOneAndUpdate(
    { id: report.id, user_id: req.user.id },
    { $inc: { summary_count: 1 }, $set: { summary_last_used_at: lastUsedAt } },
    { returnDocument: 'after', includeResultMetadata: false }
  );
  return res.json({
    summary: ranked.map(item => item.sentence.slice(0, 500)), pagesRead, totalPages,
    usageCount: usageUpdate.summary_count, lastUsedAt: usageUpdate.summary_last_used_at,
    method: 'local-extractive',
    notice: 'This is an automatically selected text extract, not AI diagnosis or medical advice. Confirm all details with your clinician.'
  });
}));
app.delete('/api/reports/:id', requireAuth, asyncRoute(async (req, res) => {
  const report = await col('reports').findOne({ id: idFrom(req.params.id), user_id: req.user.id });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  try { fs.unlinkSync(path.join(UPLOAD_DIR, report.stored_name)); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.warn('An uploaded report file was already missing.');
  }
  await col('reports').deleteOne({ id: report.id, user_id: req.user.id });
  return res.json({ ok: true });
}));

async function prescriptionRows(user) {
  const admin = user.role === 'admin';
  const users = await col('users').find(
    admin ? { hospital_id: user.hospital_id } : { id: user.id },
    { projection: { id: 1, name: 1 } }
  ).toArray();
  const ids = users.map(item => item.id);
  const [saved, pending] = await Promise.all([
    col('prescriptions').find({ user_id: { $in: ids } }).sort({ created_at: -1 }).toArray(),
    admin ? col('pending_prescriptions').find({ hospital_id: user.hospital_id }).sort({ created_at: -1 }).toArray() : []
  ]);
  const doctors = await col('doctors').find({
    id: { $in: [...new Set([...saved, ...pending].map(item => item.doctor_id).filter(Number.isInteger))] }
  }).toArray();
  const userMap = new Map(users.map(item => [item.id, item]));
  const doctorMap = new Map(doctors.map(item => [item.id, item]));
  const prescriptions = saved.map(item => ({
    id: item.id, user_id: item.user_id, doctor_id: item.doctor_id ?? null,
    medication: item.medication, directions: item.directions, refills: item.refills,
    status: item.status, created_at: item.created_at, patient_name: userMap.get(item.user_id)?.name || '',
    doctor_name: doctorMap.get(item.doctor_id)?.name || null
  }));
  const pendingPrescriptions = pending.map(item => ({
    id: item.id, patient_name: item.patient_name, patient_email: item.patient_email,
    doctor_id: item.doctor_id ?? null, medication: item.medication, directions: item.directions,
    refills: item.refills, status: item.status, created_at: item.created_at,
    doctor_name: doctorMap.get(item.doctor_id)?.name || null
  }));
  return { prescriptions, pendingPrescriptions };
}

app.get('/api/prescriptions', requireAuth, asyncRoute(async (req, res) => res.json(await prescriptionRows(req.user))));
app.post('/api/admin/prescriptions', requireAdmin, asyncRoute(async (req, res) => {
  const patientType = req.body.patientType;
  const userId = idFrom(req.body.userId);
  const patientName = cleanText(req.body.patientName, 80);
  const patientEmail = cleanText(req.body.patientEmail, 254).toLowerCase();
  const doctorId = req.body.doctorId === '' || req.body.doctorId == null ? null : idFrom(req.body.doctorId);
  const medication = cleanText(req.body.medication, 120);
  const directions = cleanText(req.body.directions, 500);
  const refills = Number(req.body.refills);
  if (!['registered', 'new'].includes(patientType)) return res.status(400).json({ error: 'Choose an existing patient or enter details for a new patient.' });
  if (patientType === 'registered' && (!userId || !await col('users').findOne({ id: userId, role: 'patient', hospital_id: req.user.hospital_id }))) {
    return res.status(400).json({ error: 'Choose a registered patient at your hospital.' });
  }
  if (patientType === 'new') {
    if (patientName.length < 2) return res.status(400).json({ error: 'Enter the new patient’s full name.' });
    if (!validEmail(patientEmail)) return res.status(400).json({ error: 'Enter a valid email address for the new patient.' });
    if (await col('users').findOne({ email: patientEmail })) return res.status(409).json({ error: 'This email already has a CareSphere account. Choose that patient from the existing-patient option.' });
  }
  if (req.body.doctorId != null && req.body.doctorId !== '' && !doctorId) return res.status(400).json({ error: 'Choose a valid clinician at your hospital.' });
  if (doctorId !== null && !await col('doctors').findOne({ id: doctorId, hospital_id: req.user.hospital_id })) return res.status(400).json({ error: 'Choose a valid clinician at your hospital.' });
  if (medication.length < 2 || directions.length < 2) return res.status(400).json({ error: 'Enter the prescription name and directions.' });
  if (!Number.isInteger(refills) || refills < 0 || refills > 20) return res.status(400).json({ error: 'Refills must be a whole number from 0 to 20.' });
  if (patientType === 'new') {
    const pending = {
      id: await db.nextId('pending_prescriptions'), hospital_id: req.user.hospital_id, patient_name: patientName,
      patient_email: patientEmail, doctor_id: doctorId, medication, directions, refills,
      status: 'Active', created_at: nowIso()
    };
    await col('pending_prescriptions').insertOne(pending);
    return res.status(201).json({ pendingPrescription: withoutMongoId(pending) });
  }
  const prescription = {
    id: await db.nextId('prescriptions'), user_id: userId, doctor_id: doctorId,
    medication, directions, refills, status: 'Active', created_at: nowIso()
  };
  await col('prescriptions').insertOne(prescription);
  return res.status(201).json({ prescription: withoutMongoId(prescription) });
}));
app.patch('/api/admin/prescriptions/:id', requireAdmin, asyncRoute(async (req, res) => {
  const doctorId = req.body.doctorId === '' || req.body.doctorId == null ? null : idFrom(req.body.doctorId);
  const medication = cleanText(req.body.medication, 120);
  const directions = cleanText(req.body.directions, 500);
  const refills = Number(req.body.refills);
  const status = req.body.status;
  if (req.body.doctorId != null && req.body.doctorId !== '' && !doctorId) return res.status(400).json({ error: 'Choose a valid clinician at your hospital.' });
  if (doctorId !== null && !await col('doctors').findOne({ id: doctorId, hospital_id: req.user.hospital_id })) return res.status(400).json({ error: 'Choose a valid clinician at your hospital.' });
  if (medication.length < 2 || directions.length < 2) return res.status(400).json({ error: 'Enter the prescription name and directions.' });
  if (!Number.isInteger(refills) || refills < 0 || refills > 20) return res.status(400).json({ error: 'Refills must be a whole number from 0 to 20.' });
  if (!['Active', 'Completed', 'Stopped'].includes(status)) return res.status(400).json({ error: 'Choose a valid prescription status.' });
  const patients = await col('users').find({ hospital_id: req.user.hospital_id }, { projection: { id: 1 } }).toArray();
  const result = await col('prescriptions').updateOne(
    { id: idFrom(req.params.id), user_id: { $in: patients.map(item => item.id) } },
    { $set: { doctor_id: doctorId, medication, directions, refills, status } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Prescription not found in your hospital.' });
  return res.json({ ok: true });
}));

async function invoiceRows(user) {
  const patients = await col('users').find(
    user.role === 'admin' ? { hospital_id: user.hospital_id } : { id: user.id },
    { projection: { id: 1, name: 1, email: 1 } }
  ).toArray();
  const invoices = await col('invoices').find({ user_id: { $in: patients.map(item => item.id) } }).sort({ created_at: -1 }).toArray();
  const patientMap = new Map(patients.map(item => [item.id, item]));
  return invoices.map(item => ({
    id: item.id, user_id: item.user_id, description: item.description, amount_cents: item.amount_cents,
    status: item.status, created_at: item.created_at, paid_at: item.paid_at ?? null,
    payment_method: item.payment_method ?? null, patient_name: patientMap.get(item.user_id)?.name || '',
    patient_email: patientMap.get(item.user_id)?.email || ''
  }));
}
app.get('/api/invoices', requireAuth, asyncRoute(async (req, res) => res.json({ invoices: await invoiceRows(req.user) })));
app.post('/api/admin/invoices', requireAdmin, asyncRoute(async (req, res) => {
  const userId = idFrom(req.body.userId);
  const description = cleanText(req.body.description, 160);
  const amountCents = Number(req.body.amountCents);
  if (!userId || !await col('users').findOne({ id: userId, role: 'patient', hospital_id: req.user.hospital_id })) return res.status(400).json({ error: 'Choose a registered patient at your hospital.' });
  if (description.length < 2) return res.status(400).json({ error: 'Enter an invoice description.' });
  if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 100000000) return res.status(400).json({ error: 'Enter a valid invoice amount.' });
  const invoice = { id: await db.nextId('invoices'), user_id: userId, description, amount_cents: amountCents, status: 'Due', created_at: nowIso() };
  await col('invoices').insertOne(invoice);
  return res.status(201).json({ invoice: withoutMongoId(invoice) });
}));
app.post('/api/invoices/:id/pay-demo', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts can update their demo payment status.' });
  const paymentMethod = req.body.paymentMethod;
  if (!['pay-at-hospital', 'upi-demo', 'card-demo'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose one of the available demonstration payment methods.' });
  const result = await col('invoices').updateOne(
    { id: idFrom(req.params.id), user_id: req.user.id, status: 'Due' },
    { $set: { status: 'Paid', paid_at: nowIso(), payment_method: paymentMethod } }
  );
  if (!result.matchedCount) {
    const invoice = await col('invoices').findOne({ id: idFrom(req.params.id), user_id: req.user.id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    return res.status(409).json({ error: 'This invoice has already been paid.' });
  }
  return res.json({ ok: true, payment: 'demo-only-no-charge', paymentMethod });
}));
app.get('/api/admin/analytics', requireAdmin, asyncRoute(async (req, res) => {
  const hospitalId = req.user.hospital_id;
  const [patients, doctors, invoices, sharedPatients] = await Promise.all([
    col('users').find({ role: 'patient', hospital_id: hospitalId }, { projection: { id: 1 } }).toArray(),
    col('doctors').find({ hospital_id: hospitalId }, { projection: { id: 1, available: 1 } }).toArray(),
    col('users').find({ hospital_id: hospitalId }, { projection: { id: 1 } }).toArray(),
    col('users').find({ hospital_id: hospitalId }, { projection: { id: 1 } }).toArray()
  ]);
  const doctorIds = doctors.map(item => item.id);
  const patientIds = patients.map(item => item.id);
  const allUsers = invoices.map(item => item.id);
  const [appointments, pendingAppointments, dueInvoices, uploadedReports, recent] = await Promise.all([
    col('appointments').countDocuments({ doctor_id: { $in: doctorIds } }),
    col('appointments').countDocuments({ doctor_id: { $in: doctorIds }, status: 'Pending' }),
    col('invoices').countDocuments({ user_id: { $in: allUsers }, status: 'Due' }),
    col('reports').countDocuments({ user_id: { $in: sharedPatients.map(item => item.id) }, shared_with_hospital: true }),
    col('appointments').find({ doctor_id: { $in: doctorIds } }).sort({ created_at: -1 }).limit(100).toArray()
  ]);
  const recentUsers = await col('users').find({ id: { $in: [...new Set(recent.map(item => item.user_id))] } }).toArray();
  const recentDoctors = await col('doctors').find({ id: { $in: [...new Set(recent.map(item => item.doctor_id))] } }).toArray();
  const userMap = new Map(recentUsers.map(item => [item.id, item]));
  const doctorMap = new Map(recentDoctors.map(item => [item.id, item]));
  const recentAppointments = recent.map(item => ({
    id: item.id, appointment_at: item.appointment_at, reason: item.reason, status: item.status, created_at: item.created_at,
    doctor_id: item.doctor_id, doctor_name: doctorMap.get(item.doctor_id)?.name || '',
    specialty: doctorMap.get(item.doctor_id)?.specialty || '',
    patient_name: userMap.get(item.user_id)?.name || '', patient_email: userMap.get(item.user_id)?.email || ''
  }));
  return res.json({
    totals: {
      patients: patientIds.length, doctors: doctors.filter(item => item.available).length,
      appointments, pendingAppointments, dueInvoices, uploadedReports
    },
    recentAppointments
  });
}));
app.get('/api/notifications', requireAuth, asyncRoute(async (req, res) => {
  const admin = req.user.role === 'admin';
  const doctors = admin ? await col('doctors').find({ hospital_id: req.user.hospital_id }, { projection: { id: 1 } }).toArray() : [];
  const doctorIds = doctors.map(item => item.id);
  const users = admin ? await col('users').find({ hospital_id: req.user.hospital_id }, { projection: { id: 1 } }).toArray() : [];
  const userIds = admin ? users.map(item => item.id) : [req.user.id];
  const [appointments, invoices] = await Promise.all([
    col('appointments').find(admin
      ? { doctor_id: { $in: doctorIds }, status: 'Pending' }
      : { user_id: req.user.id, status: { $in: ['Pending', 'Confirmed'] } }).sort({ appointment_at: 1 }).limit(10).toArray(),
    col('invoices').find(admin
      ? { user_id: { $in: userIds }, status: 'Due' }
      : { user_id: req.user.id, status: 'Due' }).sort({ created_at: -1 }).limit(10).toArray()
  ]);
  const notifications = [
    ...appointments.map(item => ({
      id: item.id, detail: item.appointment_at,
      message: admin ? 'Appointment request pending' : `Appointment ${item.status.toLowerCase()}`
    })),
    ...invoices.map(item => ({ id: item.id, detail: item.description, message: admin ? 'Invoice due' : 'Payment due' }))
  ];
  return res.json({ notifications });
}));

app.use('/backend', (_req, res) => res.status(404).send('Not found'));

// Static files and SPA single-page application fallback
app.use(express.static(ROOT, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.startsWith(UPLOAD_DIR)) res.setHeader('Cache-Control', 'private, no-store');
  }
}));
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

// Centralized error handler
app.use((error, _req, res, _next) => {
  if (error?.code === 11000) return res.status(409).json({ error: 'A record with those details already exists.' });
  if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
  if (error?.message === 'Only PDF, JPG and PNG files are allowed.') return res.status(400).json({ error: error.message });
  console.error('Request failed:', error?.message || 'Unknown server error');
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

async function start() {
  const db = await connectDatabase(MONGODB_URI);
  try {
    await seedData();
  } catch (error) {
    console.warn('Seed data warning:', error.message);
  }
  const server = app.listen(PORT, () => console.log(`CareSphere API running on http://localhost:${PORT}`));
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.close(async () => {
      try { await db.close(); } catch (error) { console.error('MongoDB shutdown failed:', error.message); }
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (require.main === module) {
  start().catch(error => {
    console.error('CareSphere startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, start };
