'use strict';

const crypto = require('node:crypto');
const { col } = require('../database/connection');
const { nowIso } = require('../utils/helpers');

class HealthcareBlockchain {
  static hashData(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data || {})).digest('hex');
  }

  static calculateHash(index, previousHash, timestamp, dataHash, nonce) {
    const timeVal = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
    return crypto
      .createHash('sha256')
      .update(String(index) + String(previousHash) + timeVal + String(dataHash) + String(nonce))
      .digest('hex');
  }

  static async getBlocks() {
    return col('blocks').find({}, { projection: { _id: 0 } }).sort({ index: 1 }).toArray();
  }

  static async getLatestBlock() {
    const blocks = await col('blocks').find().sort({ index: -1 }).limit(1).toArray();
    return blocks[0] || null;
  }

  static async addBlock(type, title, actorId, actorName, data = {}, documentHash = null) {
    const latest = await this.getLatestBlock();
    const index = latest ? latest.index + 1 : 0;
    const previousHash = latest ? latest.hash : '0'.repeat(64);
    const dataHash = documentHash || this.hashData(data);
    const timestamp = new Date();

    let nonce = 0;
    let hash = '';
    while (true) {
      hash = this.calculateHash(index, previousHash, timestamp, dataHash, nonce);
      if (hash.startsWith('0')) break;
      nonce += 1;
    }

    const block = {
      index,
      timestamp,
      type,
      title,
      actor_id: String(actorId || 'SYSTEM'),
      actor_name: String(actorName || 'CareSphere System'),
      data,
      data_hash: dataHash,
      previous_hash: previousHash,
      hash,
      nonce,
      created_at: nowIso()
    };

    await col('blocks').insertOne(block);
    return block;
  }

  static async validateChain() {
    const blocks = await col('blocks').find().sort({ index: 1 }).toArray();
    if (!blocks || blocks.length === 0) return { isValid: true, length: 0, brokenBlockIndex: null };

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (i > 0) {
        const prev = blocks[i - 1];
        if (b.previous_hash !== prev.hash) {
          return { isValid: false, length: blocks.length, brokenBlockIndex: b.index };
        }
      }
      const dataHash = b.data_hash || this.hashData(b.data);
      const expectedHash = this.calculateHash(b.index, b.previous_hash, b.timestamp, dataHash, b.nonce);
      if (b.hash !== expectedHash) {
        return { isValid: false, length: blocks.length, brokenBlockIndex: b.index };
      }
    }
    return { isValid: true, length: blocks.length, brokenBlockIndex: null };
  }

  static async simulateTamper() {
    const blocks = await col('blocks').find().sort({ index: 1 }).toArray();
    if (blocks.length < 2) throw new Error('Not enough blocks to simulate tampering. Create at least one appointment or report.');
    const targetBlock = blocks[1];
    await col('blocks').updateOne(
      { index: targetBlock.index },
      { $set: { 'data.compromised': true, 'data.tamperedAt': new Date().toISOString(), title: '⚠️ TAMPERED: ' + targetBlock.title } }
    );
    return await col('blocks').findOne({ index: targetBlock.index });
  }

  static async repair() {
    const blocks = await col('blocks').find().sort({ index: 1 }).toArray();
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const prevHash = i === 0 ? '0'.repeat(64) : blocks[i - 1].hash;
      const dataHash = this.hashData(b.data);
      let nonce = 0;
      let hash = '';
      while (true) {
        hash = this.calculateHash(b.index, prevHash, b.timestamp, dataHash, nonce);
        if (hash.startsWith('0')) break;
        nonce += 1;
      }
      b.previous_hash = prevHash;
      b.data_hash = dataHash;
      b.hash = hash;
      b.nonce = nonce;
      await col('blocks').updateOne(
        { index: b.index },
        { $set: { previous_hash: prevHash, data_hash: dataHash, hash, nonce } }
      );
    }
    return await this.getBlocks();
  }

  static async initializeGenesis() {
    const count = await col('blocks').countDocuments();
    if (count === 0) {
      await this.addBlock('GENESIS', 'CareSphere Genesis Block Initialized', 'SYSTEM', 'CareSphere Core', {
        platform: 'CareSphere Healthcare Platform',
        security: 'SHA-256 Tamper-Proof Cryptographic Ledger',
        initialized: nowIso()
      });
      console.log('Genesis Block #0 successfully initialized.');
    }
  }
}

module.exports = { HealthcareBlockchain };

