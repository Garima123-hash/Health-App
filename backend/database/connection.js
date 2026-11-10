'use strict';

const { MongoClient } = require('mongodb');
const { collectionSchemas, indexDefinitions } = require('./schemas');
const { MONGODB_MAX_POOL_SIZE, MONGODB_SERVER_SELECTION_TIMEOUT_MS } = require('../config');

let dbInstance = null;

async function connectDatabase(uri) {
  if (!uri || !uri.trim()) {
    throw new Error('MONGODB_URI is required. Set it in your environment before starting CareSphere.');
  }

  const client = new MongoClient(uri, {
    appName: 'CareSphere',
    maxPoolSize: MONGODB_MAX_POOL_SIZE,
    serverSelectionTimeoutMS: MONGODB_SERVER_SELECTION_TIMEOUT_MS
  });

  try {
    await client.connect();
    const database = client.db();
    const existing = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));

    async function nextIdFor(sequence) {
      const counter = await database.collection('counters').findOneAndUpdate(
        { _id: sequence },
        { $inc: { sequence: 1 } },
        { upsert: true, returnDocument: 'after', includeResultMetadata: false }
      );
      return counter.sequence;
    }

    // Auto-migrate legacy documents missing integer 'id' or required fields before building unique indexes
    const idCollections = [
      'hospitals', 'users', 'doctors', 'appointments', 'reports',
      'womens_health_mood_entries', 'womens_health_cycle_entries',
      'prescriptions', 'pending_prescriptions', 'invoices', 'hospital_admins'
    ];
    for (const name of idCollections) {
      if (!existing.has(name)) continue;
      const unindexedDocs = await database.collection(name).find({
        $or: [{ id: null }, { id: { $exists: false } }]
      }).toArray();
      for (const doc of unindexedDocs) {
        const id = await nextIdFor(name);
        const updates = { id };
        if (name === 'hospitals') {
          if (!doc.name_key && doc.name) updates.name_key = doc.name.trim().toLowerCase();
          if (!doc.phone) updates.phone = '1-800-555-0100';
          if (!doc.city) updates.city = 'Metro Campus';
          if (!doc.created_at) updates.created_at = new Date().toISOString();
        } else if (name === 'doctors') {
          if (!doc.name_key && doc.name) updates.name_key = doc.name.trim().toLowerCase();
          if (doc.hospital_id == null) {
            const h = await database.collection('hospitals').findOne({}, { sort: { id: 1 } });
            if (h) updates.hospital_id = h.id;
          }
        } else if (name === 'users') {
          if (doc.hospital_id == null) {
            const h = await database.collection('hospitals').findOne({}, { sort: { id: 1 } });
            if (h) updates.hospital_id = h.id;
          }
          if (doc.role == null) updates.role = 'patient';
          if (!doc.created_at) updates.created_at = new Date().toISOString();
        } else if (name === 'reports') {
          if (!doc.stored_name) updates.stored_name = `legacy_${id}`;
          if (!doc.status) updates.status = 'Ready';
          if (doc.shared_with_hospital == null) updates.shared_with_hospital = true;
          if (doc.summary_count == null) updates.summary_count = 0;
          if (!doc.created_at) updates.created_at = new Date().toISOString();
        }
        await database.collection(name).updateOne({ _id: doc._id }, { $set: updates });
      }
    }

    // Auto-align foreign keys in reports and appointments to integer user.id and doctor.id
    if (existing.has('users')) {
      const allUsers = await database.collection('users').find({}).toArray();
      for (const u of allUsers) {
        if (!u.id) continue;
        const userOr = [{ user_id: u._id }, { user_id: String(u._id) }];
        if (u.email) userOr.push({ patient_email: u.email });
        await database.collection('reports').updateMany(
          { $or: userOr, user_id: { $ne: u.id } },
          { $set: { user_id: u.id, patient_name: u.name, patient_email: u.email } }
        );
        await database.collection('appointments').updateMany(
          { $or: userOr, user_id: { $ne: u.id } },
          { $set: { user_id: u.id, patient_name: u.name, patient_email: u.email } }
        );
      }
    }

    if (existing.has('doctors')) {
      const allDoctors = await database.collection('doctors').find({}).toArray();
      for (const d of allDoctors) {
        if (!d.id) continue;
        const docOr = [{ doctor_id: d._id }, { doctor_id: String(d._id) }];
        if (d.name) docOr.push({ doctor_name: d.name });
        await database.collection('appointments').updateMany(
          { $or: docOr, doctor_id: { $ne: d.id } },
          { $set: { doctor_id: d.id, doctor_name: d.name, specialty: d.specialty } }
        );
      }
    }

    for (const [name, validator] of Object.entries(collectionSchemas)) {
      try {
        if (existing.has(name)) {
          await database.command({ collMod: name, validator: { $jsonSchema: validator }, validationLevel: 'moderate' });
        } else {
          await database.createCollection(name, { validator: { $jsonSchema: validator }, validationLevel: 'moderate' });
        }
      } catch (modErr) {
        console.warn(`Schema validation warning for ${name}:`, modErr.message);
      }
    }

    for (const [name, indexes] of Object.entries(indexDefinitions)) {
      try {
        await database.collection(name).createIndexes(indexes.map(([key, options]) => ({ key, ...options })));
      } catch (idxErr) {
        console.warn(`Index initialization warning for ${name}:`, idxErr.message);
      }
    }

    const dbWrapper = {
      client,
      database,
      collection: name => database.collection(name),
      async nextId(sequence) {
        const counter = await database.collection('counters').findOneAndUpdate(
          { _id: sequence },
          { $inc: { sequence: 1 } },
          { upsert: true, returnDocument: 'after', includeResultMetadata: false }
        );
        return counter.sequence;
      },
      close: () => client.close()
    };

    dbInstance = dbWrapper;
    return dbWrapper;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

const getDb = () => dbInstance;
const col = name => dbInstance.collection(name);

module.exports = {
  connectDatabase,
  getDb,
  col
};
