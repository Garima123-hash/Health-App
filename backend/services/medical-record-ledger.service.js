'use strict';

const crypto = require('node:crypto');
const { HealthcareBlockchain } = require('./blockchain.service');

const PROVIDER = 'sha256-linked-blockchain-v1';

function hashFile(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashAuditEvent({ reportId, status, actorRole, createdAt, documentHash }) {
  return crypto.createHash('sha256').update(JSON.stringify({
    reportId, status, actorRole, createdAt, documentHash, provider: PROVIDER
  })).digest('hex');
}

function classifyIntegrityStatus({ fileExists, fileMatches, anchorStatus }) {
  if (!fileExists) return 'file-missing';
  if (anchorStatus === 'anchor-missing') return 'anchor-missing';
  if (!fileMatches) return 'file-modified';
  return anchorStatus;
}

const medicalRecordLedger = {
  provider: PROVIDER,

  anchorRecord(documentHash) {
    return HealthcareBlockchain.addBlock(
      'MEDICAL_RECORD',
      'Medical record sealed',
      'SYSTEM',
      'CareSphere Medical Records',
      { action: 'record-sealed', provider: PROVIDER },
      documentHash
    );
  },

  async verifyRecordAnchor(record) {
    const blockIndex = Number(record.block_index);
    if (!record.document_hash || record.block_index == null || record.block_index === ''
      || !Number.isSafeInteger(blockIndex) || blockIndex < 0) {
      const chain = await HealthcareBlockchain.validateChain();
      return { status: 'anchor-missing', verified: false, anchorMatches: false, chainValid: chain.isValid };
    }

    const [chain, block] = await Promise.all([
      HealthcareBlockchain.validateChain(),
      HealthcareBlockchain.getBlock(blockIndex)
    ]);
    if (!block || block.type !== 'MEDICAL_RECORD' || block.data_hash !== record.document_hash) {
      return { status: 'anchor-mismatch', verified: false, anchorMatches: false, chainValid: chain.isValid };
    }
    if (!chain.isValid) {
      return { status: 'ledger-invalid', verified: false, anchorMatches: true, chainValid: false };
    }
    return { status: 'verified', verified: true, anchorMatches: true, chainValid: true };
  },

  async anchorVerification(status, auditHash) {
    return HealthcareBlockchain.addBlock(
      'MEDICAL_RECORD_VERIFICATION',
      'Medical record integrity verification',
      'SYSTEM',
      'CareSphere Integrity Service',
      { action: 'record-verified', status, auditHash, provider: PROVIDER }
    );
  }
};

module.exports = { classifyIntegrityStatus, hashAuditEvent, hashFile, medicalRecordLedger };
