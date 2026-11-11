'use strict';

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
      password_hash: { bsonType: 'string' }, role: { enum: ['patient', 'admin'] }, age: { bsonType: ['int', 'long', 'double', 'null'] },
      gender: { enum: ['female', 'male', 'non_binary', 'prefer_not_to_say', 'unspecified'] },
      is_super_admin: { bsonType: 'bool' }
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
  report_knowledge: {
    bsonType: 'object',
    required: ['id', 'title', 'url', 'terms', 'text', 'active', 'created_at', 'updated_at'],
    properties: {
      id: { bsonType: 'string' },
      title: { bsonType: 'string' },
      url: { bsonType: 'string' },
      terms: { bsonType: 'array', items: { bsonType: 'string' } },
      text: { bsonType: 'string' },
      active: { bsonType: 'bool' },
      created_at: { bsonType: 'string' },
      updated_at: { bsonType: 'string' }
    }
  },
  medical_record_audits: {
    bsonType: 'object',
    required: ['id', 'report_id', 'user_id', 'event_type', 'status', 'actor_role', 'created_at'],
    properties: {
      id: { bsonType: ['int', 'long', 'double'] },
      report_id: { bsonType: ['int', 'long', 'double'] },
      user_id: { bsonType: ['int', 'long', 'double'] },
      event_type: { enum: ['sealed', 'verification', 'deleted'] },
      status: { enum: ['sealed', 'verified', 'file-missing', 'file-modified', 'anchor-missing', 'anchor-mismatch', 'ledger-invalid', 'deleted'] },
      actor_role: { enum: ['patient', 'admin'] },
      block_index: { bsonType: ['int', 'long', 'double', 'null'] },
      audit_hash: { bsonType: 'string' },
      provider: { bsonType: 'string' },
      created_at: { bsonType: 'string' }
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
  report_knowledge: [[{ id: 1 }, { unique: true }], [{ active: 1 }, {}]],
  medical_record_audits: [[{ id: 1 }, { unique: true }], [{ report_id: 1, created_at: -1 }, {}], [{ user_id: 1, report_id: 1, created_at: -1 }, {}]],
  womens_health_mood_entries: [[{ id: 1 }, { unique: true }], [{ user_id: 1, entry_date: -1 }, {}], [{ user_id: 1, entry_date: 1 }, { unique: true }]],
  womens_health_cycle_entries: [[{ id: 1 }, { unique: true }], [{ user_id: 1, start_date: -1 }, {}], [{ user_id: 1, start_date: 1 }, { unique: true }]],
  prescriptions: [[{ id: 1 }, { unique: true }], [{ user_id: 1, created_at: -1 }, {}], [{ source_pending_id: 1 }, { unique: true, sparse: true }]],
  pending_prescriptions: [[{ id: 1 }, { unique: true }], [{ hospital_id: 1, patient_email: 1 }, {}]],
  invoices: [[{ id: 1 }, { unique: true }], [{ user_id: 1, created_at: -1 }, {}]],
  hospital_admins: [[{ id: 1 }, { unique: true }], [{ user_id: 1, hospital_id: 1 }, { unique: true }]],
  auth_refresh_tokens: [[{ token_hash: 1 }, { unique: true }], [{ family_id: 1, revoked_at: 1, expires_at: 1 }, {}], [{ user_id: 1, created_at: -1 }, {}]],
  blocks: [[{ index: 1 }, { unique: true }]]
};

module.exports = {
  collectionSchemas,
  indexDefinitions
};
