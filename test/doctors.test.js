const assert = require('node:assert/strict');
const test = require('node:test');
const { login, request, startTestApp } = require('../helpers.cjs');

test('administrator doctor creation validates required fields and saves valid doctors', async context => {
  const { baseUrl, adminEmail, adminPassword } = await startTestApp(context);
  const admin = await login(baseUrl, adminEmail, adminPassword);

  const shortName = await request(baseUrl, '/api/admin/doctors', {
    token: admin.token,
    method: 'POST',
    body: JSON.stringify({ name: 'Dr', specialty: 'Cardiology', experience: '' })
  });
  assert.equal(shortName.response.status, 400);
  assert.match(shortName.body.error, /doctor name with at least 3 characters/i);

  const shortSpecialty = await request(baseUrl, '/api/admin/doctors', {
    token: admin.token,
    method: 'POST',
    body: JSON.stringify({ name: 'Dr. Test Doctor', specialty: 'X', experience: '' })
  });
  assert.equal(shortSpecialty.response.status, 400);
  assert.match(shortSpecialty.body.error, /specialty with at least 2 characters/i);

  const created = await request(baseUrl, '/api/admin/doctors', {
    token: admin.token,
    method: 'POST',
    body: JSON.stringify({ name: 'Dr. Test Doctor', specialty: 'Cardiology', experience: '5 years' })
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.doctor.name, 'Dr. Test Doctor');
  assert.equal(created.body.doctor.specialty, 'Cardiology');
});
