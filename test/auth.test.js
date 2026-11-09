const assert = require('node:assert/strict');
const test = require('node:test');
const { startTestApp } = require('../helpers.cjs');

function refreshCookie(response) {
  const setCookie = response.headers.getSetCookie?.().find(value => value.startsWith('caresphere.refresh='));
  assert.ok(setCookie, 'Expected an HttpOnly refresh cookie');
  return setCookie.split(';')[0];
}

async function login(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return { response, body, cookie: refreshCookie(response) };
}

test('JWT bearer access and rotating HttpOnly refresh tokens authenticate and revoke correctly', async context => {
  const { baseUrl, adminEmail, adminPassword } = await startTestApp(context);
  const session = await login(baseUrl, adminEmail, adminPassword);
  assert.ok(session.body.accessToken);
  assert.equal(session.body.expiresIn, 900);
  assert.doesNotMatch(JSON.stringify(session.body), /refresh/i);
  assert.match(session.response.headers.getSetCookie().join(';'), /HttpOnly/i);
  assert.match(session.response.headers.getSetCookie().join(';'), /SameSite=Strict/i);
  assert.equal((await fetch(`${baseUrl}/api/doctors`)).status, 401);

  const doctors = await fetch(`${baseUrl}/api/doctors`, {
    headers: { Authorization: `Bearer ${session.body.accessToken}` }
  });
  assert.equal(doctors.status, 200);

  const refreshedResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: session.cookie }
  });
  const refreshed = await refreshedResponse.json();
  assert.equal(refreshedResponse.status, 200, JSON.stringify(refreshed));
  assert.notEqual(refreshed.accessToken, session.body.accessToken);
  const rotatedCookie = refreshCookie(refreshedResponse);

  const replayResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: session.cookie }
  });
  assert.equal(replayResponse.status, 401);

  const revokedFamilyResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: rotatedCookie }
  });
  assert.equal(revokedFamilyResponse.status, 401);
  const replayRevokedAccess = await fetch(`${baseUrl}/api/doctors`, {
    headers: { Authorization: `Bearer ${refreshed.accessToken}` }
  });
  assert.equal(replayRevokedAccess.status, 401);

  const logoutSession = await login(baseUrl, adminEmail, adminPassword);
  const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: logoutSession.cookie, Authorization: `Bearer ${logoutSession.body.accessToken}` }
  });
  assert.equal(logoutResponse.status, 200);
  const afterLogout = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: logoutSession.cookie }
  });
  assert.equal(afterLogout.status, 401);
  const afterLogoutAccess = await fetch(`${baseUrl}/api/doctors`, {
    headers: { Authorization: `Bearer ${logoutSession.body.accessToken}` }
  });
  assert.equal(afterLogoutAccess.status, 401);
});
