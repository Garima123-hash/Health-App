'use strict';

const STORAGE_BUCKET = 'medical-reports';

function getStorageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!baseUrl || !secretKey) {
    const error = new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in the backend environment.');
    error.status = 503;
    throw error;
  }
  return { baseUrl, secretKey };
}

function encodedObjectPath(storagePath) {
  return String(storagePath).split('/').map(encodeURIComponent).join('/');
}

async function storageRequest(url, options = {}, { ignoreMissing = false } = {}) {
  const { secretKey } = getStorageConfig();
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        // Supabase sb_secret_* keys are API keys, not JWTs. Do not send them as Bearer tokens.
        apikey: secretKey,
        ...(secretKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${secretKey}` }),
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    const wrapped = new Error(`Could not connect to Supabase Storage: ${error.message || 'network error'}`);
    wrapped.status = 502;
    throw wrapped;
  }
  if (!response.ok) {
    const responseText = await response.text();
    let payload = {};
    try { payload = JSON.parse(responseText); } catch (_) {}
    // Deletion is idempotent: an object already missing from Storage is already deleted.
    if (ignoreMissing && (response.status === 404 || payload.code === 'NoSuchKey' || Number(payload.statusCode) === 404)) {
      return response;
    }
    const detail = responseText.replace(/[\r\n]+/g, ' ').slice(0, 300);
    const error = new Error(`Supabase Storage request failed (HTTP ${response.status}). ${detail}`);
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }
  return response;
}

async function uploadReportFile(storagePath, buffer, contentType) {
  const { baseUrl } = getStorageConfig();
  await storageRequest(`${baseUrl}/storage/v1/object/${STORAGE_BUCKET}/${encodedObjectPath(storagePath)}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
    body: buffer
  });
}

async function downloadReportFile(storagePath) {
  const { baseUrl } = getStorageConfig();
  const response = await storageRequest(
    `${baseUrl}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${encodedObjectPath(storagePath)}`,
    { method: 'GET' }
  );
  return Buffer.from(await response.arrayBuffer());
}

async function deleteReportFile(storagePath) {
  const { baseUrl } = getStorageConfig();
  await storageRequest(
    `${baseUrl}/storage/v1/object/${STORAGE_BUCKET}/${encodedObjectPath(storagePath)}`,
    { method: 'DELETE' },
    { ignoreMissing: true }
  );
}

module.exports = { uploadReportFile, downloadReportFile, deleteReportFile };
