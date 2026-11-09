const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { once } = require('node:events');

const root = __dirname;

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function startTestApp(testContext) {
  const port = await unusedPort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caresphere-test-'));
  const adminEmail = `admin-${process.pid}-${port}@example.invalid`;
  const adminPassword = 'Test-Admin-Password-2026!';
  const child = spawn(process.execPath, [path.join(root, 'backend', 'server.js')], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      CARESPHERE_DATA_DIR: dataDir,
      SESSION_SECRET: 'test-only-session-secret-with-sufficient-length',
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
      ADMIN_HOSPITAL_NAME: 'CareSphere Community Hospital'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs = `${logs}${chunk}`.slice(-8000); });
  child.stderr.on('data', chunk => { logs = `${logs}${chunk}`.slice(-8000); });

  testContext.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        once(child, 'exit'),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Test application failed to start.\n${logs}`);
  return { baseUrl, adminEmail, adminPassword };
}

function cookieFrom(response) {
  const cookies = response.headers.getSetCookie?.() || [];
  assert.ok(cookies.length, 'Expected the server to issue a session cookie');
  return cookies[0].split(';')[0];
}

async function request(baseUrl, route, { cookie, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body, cookie: response.headers.getSetCookie?.()[0]?.split(';')[0] };
}

async function registerPatient(baseUrl, hospitalId, name = 'Test Patient') {
  const email = `patient-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.invalid`;
  const { response, body, cookie } = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password: 'Test-Patient-Password-2026!', hospitalId, age: 38 })
  });
  assert.equal(response.status, 201, JSON.stringify(body));
  return { user: body.user, email, cookie };
}

async function login(baseUrl, email, password) {
  const { response, body, cookie } = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, JSON.stringify(body));
  return { user: body.user, cookie };
}

function textPdf(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

module.exports = { login, registerPatient, request, startTestApp, textPdf };
