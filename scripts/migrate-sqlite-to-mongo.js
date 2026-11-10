/**
 * SQLite to MongoDB Migration Utility for CareSphere
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-mongo.js [path/to/caresphere.sqlite]
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caresphere';
const defaultSqlitePath = path.join(__dirname, '..', 'backend', 'data', 'caresphere.sqlite');
const sqlitePath = process.argv[2] || defaultSqlitePath;

if (!fs.existsSync(sqlitePath)) {
  console.log(`No SQLite database found at: ${sqlitePath}`);
  console.log('Skipping data migration as there is no existing SQLite database file.');
  process.exit(0);
}

// Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['patient', 'admin'], default: 'patient' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  experience: { type: String, default: '' },
  available: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const appointmentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  appointment_at: { type: Date, required: true },
  reason: { type: String, default: 'Consultation' },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'], default: 'Pending' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const reportSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  original_name: { type: String, required: true },
  stored_name: { type: String, required: true, unique: true },
  mime_type: { type: String, required: true },
  file_size: { type: Number, required: true },
  status: { type: String, default: 'Uploaded' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User = mongoose.model('User', userSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Report = mongoose.model('Report', reportSchema);

async function migrate() {
  let sqliteDb;
  try {
    const Database = require('better-sqlite3');
    sqliteDb = new Database(sqlitePath, { readonly: true });
  } catch (err) {
    console.error('To run migration from a legacy SQLite file, please ensure better-sqlite3 is installed temporarily.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB at: ${MONGODB_URI.replace(/:[^:]*@/, ':****@')}`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const userIdMap = new Map();
  const doctorIdMap = new Map();

  // 1. Migrate Users
  const users = sqliteDb.prepare('SELECT * FROM users').all();
  console.log(`Found ${users.length} users in SQLite.`);
  for (const u of users) {
    let mongoUser = await User.findOne({ email: u.email.toLowerCase() });
    if (!mongoUser) {
      mongoUser = await User.create({
        name: u.name,
        email: u.email.toLowerCase(),
        password_hash: u.password_hash,
        role: u.role || 'patient',
        created_at: u.created_at ? new Date(u.created_at) : new Date()
      });
    }
    userIdMap.set(u.id, mongoUser._id);
  }

  // 2. Migrate Doctors
  const doctors = sqliteDb.prepare('SELECT * FROM doctors').all();
  console.log(`Found ${doctors.length} doctors in SQLite.`);
  for (const d of doctors) {
    let mongoDoctor = await Doctor.findOne({ name: d.name });
    if (!mongoDoctor) {
      mongoDoctor = await Doctor.create({
        name: d.name,
        specialty: d.specialty,
        experience: d.experience || '',
        available: Boolean(d.available)
      });
    }
    doctorIdMap.set(d.id, mongoDoctor._id);
  }

  // 3. Migrate Appointments
  const appointments = sqliteDb.prepare('SELECT * FROM appointments').all();
  console.log(`Found ${appointments.length} appointments in SQLite.`);
  let apptCount = 0;
  for (const a of appointments) {
    const mongoUserId = userIdMap.get(a.user_id);
    const mongoDoctorId = doctorIdMap.get(a.doctor_id);

    if (mongoUserId && mongoDoctorId) {
      const existing = await Appointment.findOne({
        user_id: mongoUserId,
        doctor_id: mongoDoctorId,
        appointment_at: new Date(a.appointment_at)
      });

      if (!existing) {
        await Appointment.create({
          user_id: mongoUserId,
          doctor_id: mongoDoctorId,
          appointment_at: new Date(a.appointment_at),
          reason: a.reason || 'Consultation',
          status: a.status || 'Pending',
          created_at: a.created_at ? new Date(a.created_at) : new Date()
        });
        apptCount++;
      }
    }
  }
  console.log(`Migrated ${apptCount} new appointments.`);

  // 4. Migrate Reports
  try {
    const reports = sqliteDb.prepare('SELECT * FROM reports').all();
    console.log(`Found ${reports.length} reports in SQLite.`);
    let repCount = 0;
    for (const r of reports) {
      const mongoUserId = userIdMap.get(r.user_id);
      if (mongoUserId) {
        const existing = await Report.findOne({ stored_name: r.stored_name });
        if (!existing) {
          await Report.create({
            user_id: mongoUserId,
            original_name: r.original_name,
            stored_name: r.stored_name,
            mime_type: r.mime_type,
            file_size: r.file_size,
            status: r.status || 'Uploaded',
            created_at: r.created_at ? new Date(r.created_at) : new Date()
          });
          repCount++;
        }
      }
    }
    console.log(`Migrated ${repCount} new report records.`);
  } catch (_) {
    // Reports table may not exist in older SQLite schemas
  }

  console.log('Migration completed successfully.');
  await mongoose.disconnect();
  sqliteDb.close();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

