const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { HealthcareBlockchain } = require('../backend/services/blockchain.service');
const {
  classifyIntegrityStatus,
  hashAuditEvent,
  hashFile,
  medicalRecordLedger
} = require('../backend/services/medical-record-ledger.service');

test('medical record fingerprints use SHA-256 and ledger anchors contain no patient or file metadata', async () => {
  const document = Buffer.from('private medical record contents');
  const expectedHash = crypto.createHash('sha256').update(document).digest('hex');
  assert.equal(hashFile(document), expectedHash);

  const originalAddBlock = HealthcareBlockchain.addBlock;
  let captured;
  HealthcareBlockchain.addBlock = async (...args) => {
    captured = args;
    return { index: 8 };
  };
  try {
    const block = await medicalRecordLedger.anchorRecord(expectedHash);
    assert.equal(block.index, 8);
    assert.equal(captured[0], 'MEDICAL_RECORD');
    assert.equal(captured[1], 'Medical record sealed');
    assert.deepEqual(captured[4], {
      action: 'record-sealed',
      provider: 'sha256-linked-blockchain-v1'
    });
    assert.equal(captured[5], expectedHash);
    assert.doesNotMatch(JSON.stringify(captured), /private medical record contents|patientName|filename|email/);
  } finally {
    HealthcareBlockchain.addBlock = originalAddBlock;
  }
});

test('record integrity statuses distinguish missing, modified, and valid evidence', () => {
  assert.equal(classifyIntegrityStatus({
    fileExists: false, fileMatches: false, anchorStatus: 'verified'
  }), 'file-missing');
  assert.equal(classifyIntegrityStatus({
    fileExists: true, fileMatches: false, anchorStatus: 'anchor-missing'
  }), 'anchor-missing');
  assert.equal(classifyIntegrityStatus({
    fileExists: true, fileMatches: false, anchorStatus: 'verified'
  }), 'file-modified');
  assert.equal(classifyIntegrityStatus({
    fileExists: true, fileMatches: true, anchorStatus: 'ledger-invalid'
  }), 'ledger-invalid');
  assert.equal(classifyIntegrityStatus({
    fileExists: true, fileMatches: true, anchorStatus: 'verified'
  }), 'verified');
});

test('audit event fingerprints are stable and change with verification outcome', () => {
  const event = {
    reportId: 7,
    status: 'verified',
    actorRole: 'patient',
    createdAt: '2026-11-10T10:00:00.000Z',
    documentHash: 'a'.repeat(64)
  };
  const firstHash = hashAuditEvent(event);
  assert.equal(firstHash, hashAuditEvent(event));
  assert.notEqual(firstHash, hashAuditEvent({ ...event, status: 'file-modified' }));
  assert.match(firstHash, /^[a-f0-9]{64}$/);
});
