'use strict';

const express = require('express');
const { asyncRoute } = require('../utils/helpers');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth.middleware');
const { HealthcareBlockchain } = require('../services/blockchain.service');

const router = express.Router();

function publicBlock(block) {
  const type = String(block.type || 'UNKNOWN').toLowerCase();
  const title = type === 'medical_record'
    ? 'Medical record sealed'
    : type === 'medical_record_verification'
      ? 'Medical record verification'
      : type === 'genesis'
        ? 'CareSphere ledger initialized'
        : 'Healthcare ledger event';
  return {
    index: block.index,
    timestamp: block.timestamp,
    type: block.type,
    title,
    data: { type, title },
    previousHash: block.previous_hash,
    hash: block.hash,
    nonce: block.nonce
  };
}

router.get('/', requireAuth, asyncRoute(async (_req, res) => {
  const [blocks, validation] = await Promise.all([
    HealthcareBlockchain.getBlocks(),
    HealthcareBlockchain.validateChain()
  ]);
  res.json({ blocks: blocks.map(publicBlock), validation });
}));

router.get('/verify', requireAuth, asyncRoute(async (_req, res) => {
  const validation = await HealthcareBlockchain.validateChain();
  res.json(validation);
}));

router.post('/simulate-tamper', requireSuperAdmin, asyncRoute(async (_req, res) => {
  const tamperedBlock = await HealthcareBlockchain.simulateTamper();
  const validation = await HealthcareBlockchain.validateChain();
  res.json({
    ok: true,
    message: 'Tampering simulated on Block #1. Hash chain is now cryptographically broken.',
    tamperedBlock: publicBlock(tamperedBlock),
    validation
  });
}));

router.post('/repair', requireSuperAdmin, asyncRoute(async (_req, res) => {
  const repairedBlocks = await HealthcareBlockchain.repair();
  const validation = await HealthcareBlockchain.validateChain();
  res.json({
    ok: true,
    message: 'Cryptographic ledger repaired. All SHA-256 block hashes re-mined and validated.',
    blocks: repairedBlocks.map(publicBlock),
    validation
  });
}));

module.exports = router;
