// Blockchain Module: SHA-256 Ledger Visualizer, Cryptographic Verification, Tamper Demo & Self-Healing
import { runtime, state } from '../state.js';
import { apiRequest, refreshBackendData, formatAppointmentDate } from '../api.js';
import { escapeHtml, toast, stat, panelHead } from '../components/ui.js';

export function renderBlockchain() {
  const isValid = runtime.blockchainValidation?.isValid === true;
  const checked = typeof runtime.blockchainValidation?.isValid === 'boolean';
  const count = runtime.apiBlocks.length;

  return `<div class="welcome">
    <div>
      <h1>Record protection</h1>
      <p>Medical report contents stay off the ledger. A digital fingerprint helps detect if a saved file has changed.</p>
    </div>
    <div class="blockchain-actions">
      <button class="btn btn-primary" onclick="verifyBlockchain()">Check protection</button>
    </div>
  </div>

  <div class="chain-banner ${!checked ? '' : (isValid ? 'valid' : 'tampered')}">
    <div>
      <strong>${!checked ? 'Protection has not been checked yet' : (isValid ? 'No ledger changes detected' : 'The ledger needs attention')}</strong>
      <p>${!checked
        ? 'Select “Check protection” to validate the record ledger.'
        : (isValid
          ? `The latest check found no changes in the ledger (${count} recorded event${count === 1 ? '' : 's'}).`
          : escapeHtml(runtime.blockchainValidation?.reason || 'A ledger check found a mismatch. Contact your hospital administrator.'))}</p>
    </div>
    ${checked ? `<span class="status ${isValid ? 'active' : 'critical'}">${isValid ? 'Looks good' : 'Needs review'}</span>` : ''}
  </div>

  ${state.role === 'admin' ? `<details class="blockchain-advanced">
    <summary>Advanced ledger details</summary>
    <div class="blockchain-actions">
      ${state.isSuperAdmin ? `
        <button class="btn btn-outline" style="border-color:#e74c3c;color:#c0392b" onclick="simulateTamper()">Simulate tampering</button>
        <button class="btn btn-light" onclick="repairBlockchain()">Repair ledger</button>
      ` : ''}
    </div>
    <div class="stats">
    ${stat('Total Blocks Mined', String(count), '⛓️', 'Immutable ledger height')}
    ${stat('Fingerprint', 'SHA-256', '🔐', 'Medical files only')}
    ${stat('Consensus / Proof', 'Proof of Work', '⚙️', 'Target: Leading zero nonce')}
    ${stat('Integrity State', !checked ? 'Not checked' : (isValid ? 'Looks good' : 'Needs review'), '🛡️', `<span class="${isValid ? 'up' : 'down'}">${!checked ? 'Check pending' : (isValid ? 'No mismatch found' : 'Mismatch detected')}</span>`)}
    </div>

    <div class="panel">
    ${panelHead('Blockchain Block Explorer', 'Every patient interaction is permanently sealed with previous block hash linkage')}
    <div class="chain-timeline">
      ${runtime.apiBlocks.map((b, idx) => {
        const isBroken = !isValid && runtime.blockchainValidation?.brokenBlockIndex === b.index;
        const type = (b.data?.type || 'GENESIS').toLowerCase();

        return `
        ${idx > 0 ? `<div class="chain-connector">⛓️ <span>SHA-256 Block Link • Prev Hash Verified</span> ⛓️</div>` : ''}
        <article class="block-card ${isBroken ? 'tampered' : ''}">
          <div class="block-top">
            <div class="block-index">
              <span>⛓️ Block #${b.index}</span>
              ${b.index === 0 ? '<span class="block-badge genesis">Genesis Block</span>' : `<span class="block-badge ${isBroken ? 'tampered' : (type === 'medical_record' ? 'medical_record' : (type.includes('doctor') ? 'doctor' : 'appointment'))}">${isBroken ? 'TAMPERED BLOCK' : type.replace(/_/g, ' ')}</span>`}
            </div>
            <div style="font-size:11px;color:var(--muted)">📅 ${escapeHtml(formatAppointmentDate(b.timestamp))}</div>
          </div>

          <div class="block-body">
            <strong>${escapeHtml(b.data?.title || 'Data Block')}</strong>
            <div class="block-meta-row">
              <span><strong>Entity:</strong> ${escapeHtml(b.data?.patientName || 'CareSphere Network')}</span>
              ${b.data?.details?.hospital ? `<span><strong>Hospital:</strong> ${escapeHtml(b.data.details.hospital)}</span>` : ''}
              ${b.data?.documentHash ? `<span><strong>Doc Fingerprint:</strong> ${escapeHtml(b.data.documentHash.slice(0, 16))}...</span>` : ''}
              <span><strong>Block Nonce:</strong> ${b.nonce ?? 0}</span>
            </div>
            ${b.data?.details ? `<div style="font-size:11px;color:#55776a;margin-top:6px;background:#f3f9f6;padding:8px 12px;border-radius:8px"><strong>Payload Details:</strong> ${escapeHtml(JSON.stringify(b.data.details))}</div>` : ''}
          </div>

          <div class="hash-container">
            <div class="hash-item">
              <span class="hash-label">Block Hash:</span>
              <span class="hash-value ${isBroken ? 'invalid' : 'highlight'}">${escapeHtml(b.hash)}</span>
            </div>
            <div class="hash-item">
              <span class="hash-label">Prev Hash:</span>
              <span class="hash-value">${escapeHtml(b.previousHash)}</span>
            </div>
          </div>
        </article>`;
      }).join('')}
    </div>
    </div>
  </details>` : ''}`;
}

export async function verifyBlockchain() {
  toast('Checking record protection…');
  try {
    const res = await apiRequest('/api/blockchain/verify');
    runtime.blockchainValidation = res;
    if (typeof window.renderAll === 'function') window.renderAll();
    if (res.isValid) {
      toast('Protection check complete. No ledger changes detected.');
    } else {
      toast('Protection check found a mismatch. Contact your hospital administrator.');
    }
  } catch (err) {
    toast(err.message || 'Could not check record protection.');
  }
}

export async function simulateTamper() {
  toast('Running the tampering demo…');
  try {
    const res = await apiRequest('/api/blockchain/simulate-tamper', { method: 'POST', body: '{}' });
    await refreshBackendData();
    runtime.blockchainValidation = res.validation;
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.go === 'function') window.go('blockchain');
    toast('The demo tampering change was detected.');
  } catch (err) {
    toast(err.message || 'Could not run the tampering demo.');
  }
}

export async function repairBlockchain() {
  toast('Repairing the ledger…');
  try {
    const res = await apiRequest('/api/blockchain/repair', { method: 'POST', body: '{}' });
    await refreshBackendData();
    runtime.blockchainValidation = res.validation;
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.go === 'function') window.go('blockchain');
    toast('Ledger repair completed.');
  } catch (err) {
    toast(err.message || 'Could not repair the ledger.');
  }
}
