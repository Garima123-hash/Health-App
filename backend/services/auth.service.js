'use strict';

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { col } = require('../database/connection');
const {
  JWT_SECRET,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_COOKIE,
  refreshCookieOptions
} = require('../config');
const { cleanPatientName, nowIso } = require('../utils/helpers');

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readCookie(req, name) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  if (!value) return '';
  try { return decodeURIComponent(value.slice(name.length + 1)); } catch { return ''; }
}

function publicUser(user, hospitalName = '') {
  return {
    id: user.id,
    name: user.role === 'patient' ? cleanPatientName(user.name) : user.name,
    email: user.email,
    role: user.role,
    is_super_admin: user.role === 'admin' && user.is_super_admin === true,
    age: user.age ?? null,
    gender: user.gender || 'unspecified',
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

function createAccessToken(user, familyId) {
  return jwt.sign({ sub: String(user.id), sid: familyId }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    jwtid: crypto.randomUUID(),
    issuer: 'caresphere-api',
    audience: 'caresphere-web'
  });
}

async function issueAuthTokens(user, res, req = null) {
  const familyId = crypto.randomUUID();
  const token = crypto.randomBytes(48).toString('base64url');
  await col('auth_refresh_tokens').insertOne({
    token_hash: hashRefreshToken(token),
    family_id: familyId,
    user_id: user.id,
    expires_at: Date.now() + REFRESH_TOKEN_TTL_MS,
    created_at: nowIso()
  });
  if (res && typeof res.cookie === 'function') {
    res.cookie(REFRESH_COOKIE, token, refreshCookieOptions);
  }
  if (req && req.session) {
    req.session.user = user;
    await new Promise(resolve => {
      req.session.save(() => resolve());
    });
  }
  const accessToken = createAccessToken(user, familyId);
  return { user, accessToken, token: accessToken, expiresIn: 900 };
}

module.exports = {
  hashRefreshToken,
  readCookie,
  publicUser,
  userWithHospital,
  createAccessToken,
  issueAuthTokens
};
