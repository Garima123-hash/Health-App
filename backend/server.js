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

// Render terminates HTTPS at its reverse proxy. Trust the single proxy hop in production
// so express-rate-limit can read the client IP from X-Forwarded-For safely.
app.set('trust proxy', 1);

// Security and performance middleware
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

// Persistent session storage in MongoDB
const sessionStore = MONGODB_URI
  ? MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: 'sessions',
      ttl: 14 * 24 * 60 * 60,
      autoRemove: 'native'
    })
  : undefined;

app.use(session({
  name: 'caresphere.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));

// Rate limiting on sensitive auth endpoints
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
}));

// Global dual authentication middleware
app.use('/api', asyncRoute(authenticate));
app.locals.getDatabase = () => getDb();

// Mount master API routes
app.use('/api', apiRouter);

// Prevent static access to backend code
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

  console.error('Request failed:', error?.stack || error?.message || 'Unknown server error');
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  const safeMessage = status < 500 || (status === 502 && /^Could not connect to Supabase Storage:/.test(error?.message || ''))
    ? error.message
    : 'An unexpected server error occurred. Check the backend logs for the request details.';
  return res.status(status).json({ error: safeMessage });
});

async function start() {
  const db = await connectDatabase(MONGODB_URI);
  try {
    await seedData();
  } catch (error) {
    await db.close();
    throw error;
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
