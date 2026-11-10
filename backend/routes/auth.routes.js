'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { col, getDb } = require('../database/connection');
const {
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_MS,
  refreshCookieOptions
} = require('../config');
const {
  cleanText,
  cleanPatientName,
  validEmail,
  idFrom,
  nowIso,
  asyncRoute
} = require('../utils/helpers');
const {
  readCookie,
  hashRefreshToken,
  createAccessToken,
  issueAuthTokens,
  userWithHospital,
  publicUser
} = require('../services/auth.service');
const { HealthcareBlockchain } = require('../services/blockchain.service');
const { ensureHospital } = require('../services/seed.service');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
const allowedGenders = new Set(['female', 'male', 'non_binary', 'prefer_not_to_say', 'unspecified']);

router.get('/config', asyncRoute(async (_req, res) => {
  const configuredName = cleanText(process.env.ADMIN_HOSPITAL || 'CareSphere Central Hospital', 120);
  const hospital = await col('hospitals').findOne({
    name_key: configuredName.toLocaleLowerCase('en')
  }, { projection: { _id: 0, name: 1 } });
  return res.json({ defaultHospital: hospital?.name || configuredName });
}));

router.post('/register', asyncRoute(async (req, res) => {
  const db = getDb();
  const name = cleanText(req.body.name, 80);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const gender = cleanText(req.body.gender, 32).toLowerCase() || 'unspecified';
  const hospitalNameParam = cleanText(req.body.hospitalName || req.body.hospital_name, 100);
  let hospitalId = idFrom(req.body.hospitalId);

  if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (password.length < 4 || password.length > 128) return res.status(400).json({ error: 'Password must contain 4–128 characters.' });
  if (!allowedGenders.has(gender)) return res.status(400).json({ error: 'Choose a valid gender option.' });

  let hospital;
  if (hospitalId) {
    hospital = await col('hospitals').findOne({ id: hospitalId });
  } else if (hospitalNameParam) {
    hospital = await ensureHospital(hospitalNameParam);
    hospitalId = hospital.id;
  } else {
    hospital = await col('hospitals').findOne({}, { sort: { name: 1 } });
    if (hospital) hospitalId = hospital.id;
  }

  if (!hospitalId || !hospital) {
    return res.status(400).json({ error: 'Choose a hospital for your patient account.' });
  }

  const age = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
    return res.status(400).json({ error: 'Age must be a whole number between 0 and 120.' });
  }

  if (await col('users').findOne({ email }, { projection: { _id: 1 } })) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  const user = {
    id: await db.nextId('users'),
    name: cleanPatientName(name),
    email,
    password_hash: await bcrypt.hash(password, 12),
    role: 'patient',
    age,
    gender,
    hospital_id: hospitalId,
    womens_health_enabled: false,
    created_at: nowIso()
  };

  try {
    await col('users').insertOne(user);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    throw error;
  }

  // Claim any pending prescriptions issued to this email
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

  // Mine a cryptographic audit block for user registration
  await HealthcareBlockchain.addBlock(
    'PATIENT_REGISTRATION',
    `Patient Account Created: ${user.name}`,
    String(user.id),
    user.name,
    { email: user.email, hospital: hospital.name, role: 'patient' }
  );

  const publicUserData = publicUser(user, hospital.name);
  const tokens = await issueAuthTokens(publicUserData, res, req);
  return res.status(201).json({ ...tokens, claimedPrescriptions });
}));

router.post('/login', asyncRoute(async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const hospitalName = cleanText(req.body.hospitalName, 120);

  if (!validEmail(email) || !password) return res.status(400).json({ error: 'Enter your email address and password.' });
  const user = await col('users').findOne({ email });
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (user.role === 'admin') {
    if (!hospitalName) return res.status(400).json({ error: 'Enter your assigned hospital name.' });
    const hospital = await col('hospitals').findOne({ name_key: hospitalName.toLocaleLowerCase('en') });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found. Check the hospital name and try again.' });
    const assignment = await col('hospital_admins').findOne({
      user_id: user.id,
      hospital_id: hospital.id
    }, { projection: { _id: 1 } });
    if (!assignment) return res.status(403).json({ error: 'This administrator account is not assigned to the selected hospital.' });
    if (user.hospital_id !== hospital.id) {
      await col('users').updateOne({ id: user.id }, { $set: { hospital_id: hospital.id } });
      user.hospital_id = hospital.id;
    }
  }

  const userData = await userWithHospital(user.id);
  const tokens = await issueAuthTokens(userData, res, req);
  return res.json(tokens);
}));

router.post('/refresh', asyncRoute(async (req, res) => {
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
  const nextToken = require('node:crypto').randomBytes(48).toString('base64url');
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
  return res.json({ user, accessToken: createAccessToken(user, current.family_id), token: createAccessToken(user, current.family_id), expiresIn: 900 });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.post('/logout', asyncRoute(async (req, res) => {
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
  if (req.session) {
    req.session.destroy(() => {});
  }
  res.clearCookie('caresphere.sid', { httpOnly: true, sameSite: 'lax' });
  return res.json({ ok: true });
}));

module.exports = router;
