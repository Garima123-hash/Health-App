'use strict';

const express = require('express');
const { asyncRoute } = require('../utils/helpers');
const { HealthcareBlockchain } = require('../services/blockchain.service');

const router = express.Router();

router.get('/', asyncRoute(async (_req, res) => {
  const [blocks, validation] = await Promise.all([
    HealthcareBlockchain.getBlocks(),
    HealthcareBlockchain.validateChain()
  ]);
  res.json({ blocks, validation });
}));

router.get('/verify', asyncRoute(async (_req, res) => {
  const validation = await HealthcareBlockchain.validateChain();
  res.json(validation);
}));

router.post('/simulate-tamper', asyncRoute(async (_req, res) => {
  const tamperedBlock = await HealthcareBlockchain.simulateTamper();
  const validation = await HealthcareBlockchain.validateChain();
  res.json({
    ok: true,
    message: 'Tampering simulated on Block #1. Hash chain is now cryptographically broken.',
    tamperedBlock,
    validation
  });
}));

router.post('/repair', asyncRoute(async (_req, res) => {
  const repairedBlocks = await HealthcareBlockchain.repair();
  const validation = await HealthcareBlockchain.validateChain();
  res.json({
    ok: true,
    message: 'Cryptographic ledger repaired. All SHA-256 block hashes re-mined and validated.',
    blocks: repairedBlocks,
    validation
  });
}));

module.exports = router;

