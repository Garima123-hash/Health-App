'use strict';

const bcrypt = require('bcryptjs');
const { col, getDb } = require('../database/connection');
const { starterDoctors } = require('../config');
const { cleanEnv, cleanText, nowIso } = require('../utils/helpers');
const { HealthcareBlockchain } = require('./blockchain.service');

async function ensureHospital(name, city = '') {
  const db = getDb();
  const nameKey = name.toLocaleLowerCase('en');
  let existing = await col('hospitals').findOne({
    $or: [{ name_key: nameKey }, { name: { $regex: new RegExp(`^${name}$`, 'i') } }]
  });
  if (existing) {
    const updates = {};
    if (!existing.id) updates.id = await db.nextId('hospitals');
    if (!existing.name_key) updates.name_key = nameKey;
    if (!existing.city && city) updates.city = city;
    if (Object.keys(updates).length > 0) {
      await col('hospitals').updateOne({ _id: existing._id }, { $set: updates });
      existing = { ...existing, ...updates };
    }
    return existing;
  }
  const hospital = { id: await db.nextId('hospitals'), name, name_key: nameKey, city, phone: '1-800-555-0100', created_at: nowIso() };
  try {
    await col('hospitals').insertOne(hospital);
  } catch (error) {
    if (error.code === 11000) {
      return (await col('hospitals').findOne({ $or: [{ name_key: nameKey }, { name }] })) || hospital;
    }
    throw error;
  }
  return hospital;
}

async function seedData() {
  const db = getDb();
  const defaultHospitalName = cleanEnv(process.env.ADMIN_HOSPITAL || process.env.DEFAULT_HOSPITAL_NAME, 'CareSphere Central Hospital');
  const locations = [
    { name: defaultHospitalName, city: 'Central District' },
    { name: 'CareSphere North Clinic', city: 'North District' },
    { name: 'CareSphere South Clinic', city: 'South District' },
    { name: 'Apollo Multi-Specialty Hospital', city: 'Metro Wing' },
    { name: 'Metro City Healthcare', city: 'Urban Campus' }
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

  // Seed Admin Account
  const email = cleanText(process.env.ADMIN_EMAIL, 254).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email && password && password.length >= 8) {
    const hospitalName = cleanEnv(process.env.ADMIN_HOSPITAL_NAME || process.env.ADMIN_HOSPITAL, defaultHospitalName);
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
      if (!await col('hospital_admins').findOne({ user_id: user.id, hospital_id: assignedHospital.id }, { projection: { _id: 1 } })) {
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

  // Seed Demo Patient Account
  const demoEmail = 'vedant@example.com';
  if (!await col('users').findOne({ email: demoEmail }, { projection: { _id: 1 } })) {
    const demoUser = {
      id: await db.nextId('users'),
      name: 'Vedant Sharma',
      email: demoEmail,
      password_hash: await bcrypt.hash('Password@123', 12),
      role: 'patient',
      age: 28,
      hospital_id: hospitals[0].id,
      womens_health_enabled: true,
      created_at: nowIso()
    };
    await col('users').insertOne(demoUser);
    console.log(`Demo patient account created: ${demoEmail} / Password@123`);
  }

  // Initialize Blockchain Genesis Block
  await HealthcareBlockchain.initializeGenesis();
}

module.exports = {
  ensureHospital,
  seedData
};

