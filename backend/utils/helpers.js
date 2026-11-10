'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../config');

const nowIso = () => new Date().toISOString();

const cleanEnv = (value, fallback) =>
  typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 120)
    : fallback;

const cleanText = (value, max = 100) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const validEmail = email =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
  email.length <= 254;

const asyncRoute = handler => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const withoutMongoId = ({ _id, ...document }) => document;

function cleanPatientName(name) {
  if (!name || typeof name !== 'string') return 'Patient';
  return name.replace(/\s*[-—(]\s*(CareSphere|Apollo|Metro|Hospital|Clinic|Healthcare).*$/i, '').trim() || name;
}

function updateEnvFile(key, value) {
  try {
    if (process.env[key] === value) return;
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

module.exports = {
  nowIso,
  cleanEnv,
  cleanText,
  validEmail,
  asyncRoute,
  withoutMongoId,
  cleanPatientName,
  updateEnvFile,
  idFrom,
  validISODate,
  isPastOrToday
};
