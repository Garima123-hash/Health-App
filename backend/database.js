'use strict';

const { MongoClient } = require('mongodb');

const collectionSchemas = {
  hospitals: {
    bsonType: 'object',
    required: ['id', 'name', 'name_key', 'city', 'phone', 'created_at'],
    properties: { id: { bsonType: ['int', 'long', 'double'] }, name: { bsonType: 'string' }, name_key: { bsonType: 'string' } }
  },
  users: {
    bsonType: 'object',
    required: ['id', 'name', 'email', 'password_hash', 'role', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, name: { bsonType: 'string' }, email: { bsonType: 'string' },
      password_hash: { bsonType: 'string' }, role: { enum: ['patient', 'admin'] }, age: { bsonType: ['int', 'long', 'double', 'null'] }
    }
  },
  doctors: {
    bsonType: 'object',
    required: ['id', 'name', 'name_key', 'specialty', 'experience', 'available', 'hospital_id'],
    properties: { id: { bsonType: ['int', 'long', 'double'] }, hospital_id: { bsonType: ['int', 'long', 'double'] }, available: { bsonType: 'bool' } }
  },
  appointments: {
    bsonType: 'object',
    required: ['id', 'user_id', 'doctor_id', 'appointment_at', 'reason', 'status', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, user_id: { bsonType: ['int', 'long', 'double'] },
      doctor_id: { bsonType: ['int', 'long', 'double'] }, appointment_at: { bsonType: 'string' },
      status: { enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'] }
    }
  },
  reports: {
    bsonType: 'object',
    required: ['id', 'user_id', 'stored_name', 'original_name', 'mime_type', 'file_size', 'shared_with_hospital', 'summary_count', 'status', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, user_id: { bsonType: ['int', 'long', 'double'] },
      stored_name: { bsonType: 'string' }, mime_type: { bsonType: 'string' }, file_size: { bsonType: ['int', 'long', 'double'] },
      shared_with_hospital: { bsonType: 'bool' }, summary_count: { bsonType: ['int', 'long', 'double'] }
    }
  },
  womens_health_mood_entries: {
    bsonType: 'object',
    required: ['id', 'user_id', 'entry_date', 'mood', 'stress_level', 'sleep_hours', 'energy_level', 'symptoms', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, user_id: { bsonType: ['int', 'long', 'double'] },
      entry_date: { bsonType: 'string' }, mood: { enum: ['great', 'good', 'okay', 'low', 'very_low'] },
      stress_level: { bsonType: ['int', 'long', 'double'], minimum: 1, maximum: 5 },
      sleep_hours: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 24 },
      energy_level: { bsonType: ['int', 'long', 'double'], minimum: 1, maximum: 5 },
      symptoms: { bsonType: 'array', items: { bsonType: 'string' } }
    }
  },
  womens_health_cycle_entries: {
    bsonType: 'object',
    required: ['id', 'user_id', 'start_date', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, user_id: { bsonType: ['int', 'long', 'double'] },
      start_date: { bsonType: 'string' }, end_date: { bsonType: ['string', 'null'] }
    }
  },
  prescriptions: {
    bsonType: 'object',
    required: ['id', 'user_id', 'medication', 'directions', 'refills', 'status', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, user_id: { bsonType: ['int', 'long', 'double'] },
      doctor_id: { bsonType: ['int', 'long', 'double', 'null'] }, refills: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 20 },
      status: { enum: ['Active', 'Completed', 'Stopped'] }
    }
  },
  pending_prescriptions: {
    bsonType: 'object',
    required: ['id', 'hospital_id', 'patient_name', 'patient_email', 'medication', 'directions', 'refills', 'status', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, hospital_id: { bsonType: ['int', 'long', 'double'] },
      patient_email: { bsonType: 'string' }, doctor_id: { bsonType: ['int', 'long', 'double', 'null'] },
      refills: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 20 }, status: { enum: ['Active', 'Completed', 'Stopped'] }
    }
  },
  invoices: {
    bsonType: 'object',
    required: ['id', 'user_id', 'description', 'amount_cents', 'status', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, user_id: { bsonType: ['int', 'long', 'double'] },
      amount_cents: { bsonType: ['int', 'long', 'double'], minimum: 1 }, status: { enum: ['Due', 'Paid'] }
    }
  },
  hospital_admins: {
    bsonType: 'object',
    required: ['id', 'user_id', 'hospital_id'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] }, user_id: { bsonType: ['int', 'long', 'double'] },
      hospital_id: { bsonType: ['int', 'long', 'double'] }
    }
  },
  auth_refresh_tokens: {
    bsonType: 'object',
    required: ['token_hash', 'family_id', 'user_id', 'expires_at', 'created_at'],
    properties: {
      token_hash: { bsonType: 'string' }, family_id: { bsonType: 'string' },
      user_id: { bsonType: ['int', 'long', 'double'] }, expires_at: { bsonType: ['int', 'long', 'double'] },
      revoked_at: { bsonType: ['int', 'long', 'double'] }
    }
  },
  counters: { bsonType: 'object', required: ['_id', 'sequence'], properties: { sequence: { bsonType: ['int', 'long', 'double'] } } }
};

const indexDefinitions = {
  hospitals: [[{ id: 1 }, { unique: true }], [{ name_key: 1 }, { unique: true }]],
  users: [[{ id: 1 }, { unique: true }], [{ email: 1 }, { unique: true }], [{ hospital_id: 1, role: 1, created_at: -1 }, {}]],
  doctors: [[{ id: 1 }, { unique: true }], [{ hospital_id: 1, name_key: 1 }, {}], [{ hospital_id: 1, available: 1, name: 1 }, {}]],
  appointments: [[{ id: 1 }, { unique: true }], [{ user_id: 1, appointment_at: 1 }, {}], [{ doctor_id: 1, appointment_at: 1 }, {}]],
  reports: [[{ id: 1 }, { unique: true }], [{ user_id: 1, created_at: -1 }, {}], [{ user_id: 1, shared_with_hospital: 1 }, {}], [{ stored_name: 1 }, { unique: true }]],
  womens_health_mood_entries: [[{ id: 1 }, { unique: true }], [{ user_id: 1, entry_date: -1 }, {}], [{ user_id: 1, entry_date: 1 }, { unique: true }]],
  womens_health_cycle_entries: [[{ id: 1 }, { unique: true }], [{ user_id: 1, start_date: -1 }, {}], [{ user_id: 1, start_date: 1 }, { unique: true }]],
  prescriptions: [[{ id: 1 }, { unique: true }], [{ user_id: 1, created_at: -1 }, {}], [{ source_pending_id: 1 }, { unique: true, sparse: true }]],
  pending_prescriptions: [[{ id: 1 }, { unique: true }], [{ hospital_id: 1, patient_email: 1 }, {}]],
  invoices: [[{ id: 1 }, { unique: true }], [{ user_id: 1, created_at: -1 }, {}]],
  hospital_admins: [[{ id: 1 }, { unique: true }], [{ user_id: 1, hospital_id: 1 }, { unique: true }]],
  auth_refresh_tokens: [[{ token_hash: 1 }, { unique: true }], [{ family_id: 1, revoked_at: 1, expires_at: 1 }, {}], [{ user_id: 1, created_at: -1 }, {}]],
  blocks: [[{ index: 1 }, { unique: true }]]
};

async function connectDatabase(uri) {
  if (!uri || !uri.trim()) throw new Error('MONGODB_URI is required. Set it in your environment before starting CareSphere.');
  const client = new MongoClient(uri, {
    appName: 'CareSphere',
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000)
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
    return {
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
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

module.exports = { connectDatabase };
