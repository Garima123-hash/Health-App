'use strict';

require('dotenv').config();
const dns = require('dns');
const path = require('node:path');

// Configure public DNS servers for reliable MongoDB Atlas SRV resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {}

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = process.env.CARESPHERE_DATA_DIR
  ? path.resolve(process.env.CARESPHERE_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const configuredJwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const JWT_SECRET = configuredJwtSecret || 'local-development-only-change-this-secret';
if (process.env.NODE_ENV === 'production' && (!configuredJwtSecret || Buffer.byteLength(configuredJwtSecret) < 32)) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 bytes before running in production.');
}

const starterDoctorRosters = [
  [
    ['Dr. Ananya Mehta', 'Cardiology', '12 years experience'],
    ['Dr. Rahul Kapoor', 'General Medicine', '9 years experience'],
    ['Dr. Priya Nair', 'Dermatology', '8 years experience'],
    ['Dr. Ishaan Verma', 'Neurology', '10 years experience'],
    ['Dr. Kavita Rao', 'Paediatrics', '14 years experience'],
    ['Dr. Nikhil Shah', 'Orthopaedics', '11 years experience']
  ],
  [
    ['Dr. Vikram Rao', 'Orthopaedics', '15 years experience'],
    ['Dr. Sana Khan', 'Paediatrics', '10 years experience'],
    ['Dr. Arjun Das', 'Neurology', '11 years experience'],
    ['Dr. Leena Iyer', 'Cardiology', '9 years experience'],
    ['Dr. Kabir Malhotra', 'General Medicine', '13 years experience'],
    ['Dr. Aisha Menon', 'Dermatology', '8 years experience']
  ],
  [
    ['Dr. Meera Joshi', 'General Medicine', '16 years experience'],
    ['Dr. Aditya Sen', 'Cardiology', '12 years experience'],
    ['Dr. Pooja Nambiar', 'Dermatology', '9 years experience'],
    ['Dr. Farhan Ali', 'Neurology', '14 years experience'],
    ['Dr. Tara Kapoor', 'Paediatrics', '7 years experience'],
    ['Dr. Rohan Bhat', 'Orthopaedics', '10 years experience']
  ],
  [
    ['Dr. Neha Kulkarni', 'Cardiology', '18 years experience'],
    ['Dr. Dev Patel', 'General Medicine', '11 years experience'],
    ['Dr. Simran Gill', 'Dermatology', '12 years experience'],
    ['Dr. Karan Sethi', 'Orthopaedics', '13 years experience'],
    ['Dr. Zoya Hussain', 'Paediatrics', '9 years experience'],
    ['Dr. Manav Reddy', 'Neurology', '15 years experience']
  ],
  [
    ['Dr. Riya Chatterjee', 'Neurology', '12 years experience'],
    ['Dr. Arnav Bose', 'Cardiology', '10 years experience'],
    ['Dr. Naina Desai', 'General Medicine', '14 years experience'],
    ['Dr. Samar Khanna', 'Dermatology', '11 years experience'],
    ['Dr. Esha Thomas', 'Orthopaedics', '8 years experience'],
    ['Dr. Yash Sood', 'Paediatrics', '13 years experience']
  ]
];

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  ROOT,
  DATA_DIR,
  UPLOAD_DIR,
  JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET || JWT_SECRET,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_MAX_POOL_SIZE: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000),
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  REFRESH_COOKIE: 'caresphere.refresh',
  refreshCookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000
  },
  starterDoctorRosters
};
