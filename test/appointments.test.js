const assert = require('node:assert/strict');
const test = require('node:test');
const { login, registerPatient, request, startTestApp } = require('../helpers.cjs');

test('hospital choices, booking reasons, and patient-only appointment access', async context => {
  const { baseUrl, adminEmail, adminPassword } = await startTestApp(context);
  const directory = await request(baseUrl, '/api/hospitals');
  assert.equal(directory.response.status, 200);
  assert.ok(directory.body.hospitals.length >= 3);

  const northHospital = directory.body.hospitals.find(hospital => hospital.name === 'CareSphere North Clinic');
  assert.ok(northHospital, 'The starter directory should include the North Clinic');
  const owner = await registerPatient(baseUrl, northHospital.id, 'Appointment Owner');
  const otherPatient = await registerPatient(baseUrl, northHospital.id, 'Other Patient');
  const doctors = await request(baseUrl, '/api/doctors', { token: owner.token });
  assert.equal(doctors.response.status, 200);
  assert.ok(doctors.body.doctors.length > 0);

  const appointmentAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const booking = await request(baseUrl, '/api/appointments', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({
      doctorId: doctors.body.doctors[0].id,
      appointmentAt,
      reason: 'Follow-up visit'
    })
  });
  assert.equal(booking.response.status, 201, JSON.stringify(booking.body));

  const ownerAppointments = await request(baseUrl, '/api/appointments', { token: owner.token });
  const otherAppointments = await request(baseUrl, '/api/appointments', { token: otherPatient.token });
  assert.equal(ownerAppointments.body.appointments.length, 1);
  assert.equal(ownerAppointments.body.appointments[0].reason, 'Follow-up visit');
  assert.deepEqual(otherAppointments.body.appointments, []);
  assert.equal((await request(baseUrl, '/api/appointments')).response.status, 401);

  const invalidReason = await request(baseUrl, '/api/appointments', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({
      doctorId: doctors.body.doctors[0].id,
      appointmentAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Unlisted reason'
    })
  });
  assert.equal(invalidReason.response.status, 400);

  const admin = await login(baseUrl, adminEmail, adminPassword);
  const switchHospital = await request(baseUrl, '/api/admin/hospitals/select', {
    token: admin.token,
    method: 'POST',
    body: JSON.stringify({ hospitalId: northHospital.id })
  });
  assert.equal(switchHospital.response.status, 200);
  const adminAppointments = await request(baseUrl, '/api/appointments', { token: admin.token });
  assert.equal(adminAppointments.body.appointments.length, 1);
  assert.equal(adminAppointments.body.appointments[0].doctor_name, doctors.body.doctors[0].name);
  assert.equal(adminAppointments.body.appointments[0].specialty, doctors.body.doctors[0].specialty);
});
