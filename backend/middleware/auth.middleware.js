'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET, REFRESH_COOKIE } = require('../config');
const { col } = require('../database/connection');
const { userWithHospital, hashRefreshToken, readCookie } = require('../services/auth.service');
const { asyncRoute } = require('../utils/helpers');

// Dual Authentication (JWT Bearer Token + Express Session + Refresh Cookie)
async function authenticate(req, res, next) {
  // 1. Try Bearer Authorization Header
  const authorization = req.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (match) {
      try {
        const payload = jwt.verify(match[1], JWT_SECRET, {
          algorithms: ['HS256'],
          issuer: 'caresphere-api',
          audience: 'caresphere-web'
        });
        const user = await userWithHospital(Number(payload.sub));
        if (user) {
          req.user = user;
          if (req.session) req.session.user = user;
          return next();
        }
      } catch (error) {
        // Fall through to session / refresh token check
      }
    }
  }

  // 2. Try Express Session
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }

  // 3. Try Persistent Refresh Cookie Fallback
  const refreshToken = readCookie(req, REFRESH_COOKIE);
  if (refreshToken) {
    try {
      const tokenHash = hashRefreshToken(refreshToken);
      const tokenDoc = await col('auth_refresh_tokens').findOne({
        token_hash: tokenHash,
        revoked_at: { $exists: false },
        expires_at: { $gt: Date.now() }
      });
      if (tokenDoc) {
        const user = await userWithHospital(tokenDoc.user_id);
        if (user) {
          req.user = user;
          if (req.session) {
            req.session.user = user;
            req.session.save(() => {});
          }
          return next();
        }
      }
    } catch (_) {}
  }

  req.user = null;
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user && (!req.session || !req.session.user)) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
  if (!req.user && req.session?.user) {
    req.user = req.session.user;
  }
  return next();
}

const requireAdmin = asyncRoute(async (req, res, next) => {
  if (!req.user && req.session?.user) req.user = req.session.user;
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  return next();
});

function requirePatient(req, res, next) {
  if (!req.user && req.session?.user) req.user = req.session.user;
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Patient account access required.' });
  return next();
}

module.exports = {
  authenticate,
  requireAuth,
  requireAdmin,
  requirePatient
};
