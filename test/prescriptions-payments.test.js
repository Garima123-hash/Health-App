const assert = require('node:assert/strict');
const test = require('node:test');
const { login, registerPatient, request, startTestApp } = require('../helpers.cjs');

test('hospital prescription records reach only their patient and invoice demo choices persist', async context => {
  const { baseUrl, adminEmail, adminPassword } = await startTestApp(context);
  const hospitals = await request(baseUrl, '/api/hospitals');
  const hospitalId = hospitals.body.hospitals[0].id;
  const patient = await registerPatient(baseUrl, hospitalId, 'Prescription Patient');
  const otherPatient = await registerPatient(baseUrl, hospitalId, 'Unrelated Patient');
  const admin = await login(baseUrl, adminEmail, adminPassword);
  const doctors = await request(baseUrl, '/api/doctors', { cookie: admin.cookie });

  const prescription = await request(baseUrl, '/api/admin/prescriptions', {
    cookie: admin.cookie,
    method: 'POST',
    body: JSON.stringify({
      patientType: 'registered',
      userId: patient.user.id,
      doctorId: doctors.body.doctors[0].id,
      medication: 'Test medication record',
      directions: 'Follow the directions supplied by your clinician.',
      refills: 1
    })
  });
  assert.equal(prescription.response.status, 201, JSON.stringify(prescription.body));
  const patientPrescriptions = await request(baseUrl, '/api/prescriptions', { cookie: patient.cookie });
  const unrelatedPrescriptions = await request(baseUrl, '/api/prescriptions', { cookie: otherPatient.cookie });
  assert.equal(patientPrescriptions.body.prescriptions.length, 1);
  assert.equal(patientPrescriptions.body.prescriptions[0].medication, 'Test medication record');
  assert.deepEqual(unrelatedPrescriptions.body.prescriptions, []);
  assert.equal((await request(baseUrl, '/api/prescriptions', { cookie: admin.cookie })).body.prescriptions.length, 1);

  const updatedPrescription = await request(baseUrl, `/api/admin/prescriptions/${prescription.body.prescription.id}`, {
    cookie: admin.cookie,
    method: 'PATCH',
    body: JSON.stringify({
      doctorId: doctors.body.doctors[0].id,
      medication: 'Updated test medication',
      directions: 'Updated directions from the hospital care team.',
      refills: 0,
      status: 'Completed'
    })
  });
  assert.equal(updatedPrescription.response.status, 200, JSON.stringify(updatedPrescription.body));
  const updatedPatientPrescriptions = await request(baseUrl, '/api/prescriptions', { cookie: patient.cookie });
  assert.equal(updatedPatientPrescriptions.body.prescriptions[0].medication, 'Updated test medication');
  assert.equal(updatedPatientPrescriptions.body.prescriptions[0].status, 'Completed');

  const otherHospital = await request(baseUrl, '/api/hospitals');
  const northHospital = otherHospital.body.hospitals.find(hospital => hospital.name === 'CareSphere North Clinic');
  const switchNorth = await request(baseUrl, '/api/admin/hospitals/select', {
    cookie: admin.cookie,
    method: 'POST',
    body: JSON.stringify({ hospitalId: northHospital.id })
  });
  assert.equal(switchNorth.response.status, 200);
  const northPatient = await registerPatient(baseUrl, northHospital.id, 'North Clinic Patient');
  const northDoctors = await request(baseUrl, '/api/doctors', { cookie: admin.cookie });
  const northPrescription = await request(baseUrl, '/api/admin/prescriptions', {
    cookie: admin.cookie,
    method: 'POST',
    body: JSON.stringify({
      patientType: 'registered',
      userId: northPatient.user.id,
      doctorId: northDoctors.body.doctors[0].id,
      medication: 'North clinic record',
      directions: 'Clinic-specific directions.',
      refills: 0
    })
  });
  assert.equal(northPrescription.response.status, 201);
  const switchBack = await request(baseUrl, '/api/admin/hospitals/select', {
    cookie: admin.cookie,
    method: 'POST',
    body: JSON.stringify({ hospitalId })
  });
  assert.equal(switchBack.response.status, 200);
  const wrongHospitalEdit = await request(baseUrl, `/api/admin/prescriptions/${northPrescription.body.prescription.id}`, {
    cookie: admin.cookie,
    method: 'PATCH',
    body: JSON.stringify({
      medication: 'Unauthorized edit',
      directions: 'This update must not cross hospitals.',
      refills: 0,
      status: 'Active'
    })
  });
  assert.equal(wrongHospitalEdit.response.status, 404);

  const invoice = await request(baseUrl, '/api/admin/invoices', {
    cookie: admin.cookie,
    method: 'POST',
    body: JSON.stringify({ userId: patient.user.id, description: 'Demo consultation', amountCents: 5000 })
  });
  assert.equal(invoice.response.status, 201, JSON.stringify(invoice.body));
  const missingChoice = await request(baseUrl, `/api/invoices/${invoice.body.invoice.id}/pay-demo`, {
    cookie: patient.cookie,
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(missingChoice.response.status, 400);

  const paid = await request(baseUrl, `/api/invoices/${invoice.body.invoice.id}/pay-demo`, {
    cookie: patient.cookie,
    method: 'POST',
    body: JSON.stringify({ paymentMethod: 'upi-demo' })
  });
  assert.equal(paid.response.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.payment, 'demo-only-no-charge');
  const invoices = await request(baseUrl, '/api/invoices', { cookie: patient.cookie });
  assert.equal(invoices.body.invoices[0].status, 'Paid');
  assert.equal(invoices.body.invoices[0].payment_method, 'upi-demo');
  assert.deepEqual((await request(baseUrl, '/api/invoices', { cookie: otherPatient.cookie })).body.invoices, []);
});

test('new-patient prescriptions stay hospital-scoped until the matching patient registers', async context => {
  const { baseUrl, adminEmail, adminPassword } = await startTestApp(context);
  const hospitals = (await request(baseUrl, '/api/hospitals')).body.hospitals;
  const hospitalId = hospitals[0].id;
  const otherHospital = hospitals.find(hospital => hospital.id !== hospitalId);
  const admin = await login(baseUrl, adminEmail, adminPassword);
  const doctors = await request(baseUrl, '/api/doctors', { cookie: admin.cookie });
  const pendingEmail = `pending-${process.pid}-${Date.now()}@example.invalid`;

  const created = await request(baseUrl, '/api/admin/prescriptions', {
    cookie: admin.cookie,
    method: 'POST',
    body: JSON.stringify({
      patientType: 'new',
      patientName: 'Future Patient',
      patientEmail: pendingEmail,
      doctorId: doctors.body.doctors[0].id,
      medication: 'Pending medication',
      directions: 'Directions recorded by the hospital clinician.',
      refills: 2
    })
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.pendingPrescription.patient_email, pendingEmail);

  const pendingList = await request(baseUrl, '/api/prescriptions', { cookie: admin.cookie });
  assert.equal(pendingList.body.pendingPrescriptions.length, 1);
  assert.equal(pendingList.body.pendingPrescriptions[0].patient_name, 'Future Patient');
  const otherHospitalEmail = `wrong-hospital-${process.pid}-${Date.now()}@example.invalid`;
  const otherHospitalPending = await request(baseUrl, '/api/admin/prescriptions', {
    cookie: admin.cookie,
    method: 'POST',
    body: JSON.stringify({
      patientType: 'new',
      patientName: 'Wrong Hospital Patient',
      patientEmail: otherHospitalEmail,
      medication: 'Hospital-specific medication',
      directions: 'This record must remain at its originating hospital.',
      refills: 0
    })
  });
  assert.equal(otherHospitalPending.response.status, 201, JSON.stringify(otherHospitalPending.body));
  const otherHospitalRegistration = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Wrong Hospital Patient',
      email: otherHospitalEmail,
      password: 'Test-Patient-Password-2026!',
      hospitalId: otherHospital.id,
      age: 38
    })
  });
  assert.equal(otherHospitalRegistration.response.status, 201, JSON.stringify(otherHospitalRegistration.body));
  assert.equal(otherHospitalRegistration.body.claimedPrescriptions, 0);
  const otherHospitalPatient = { cookie: otherHospitalRegistration.cookie };
  assert.deepEqual((await request(baseUrl, '/api/prescriptions', { cookie: otherHospitalPatient.cookie })).body.prescriptions, []);
  assert.deepEqual((await request(baseUrl, '/api/prescriptions', { cookie: otherHospitalPatient.cookie })).body.pendingPrescriptions, []);
  assert.equal((await request(baseUrl, '/api/prescriptions', { cookie: admin.cookie })).body.pendingPrescriptions.length, 2);

  const registration = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Future Patient',
      email: pendingEmail,
      password: 'Test-Patient-Password-2026!',
      hospitalId,
      age: 38
    })
  });
  assert.equal(registration.response.status, 201, JSON.stringify(registration.body));
  assert.equal(registration.body.claimedPrescriptions, 1);
  const patientPrescriptions = await request(baseUrl, '/api/prescriptions', { cookie: registration.cookie });
  assert.equal(patientPrescriptions.body.prescriptions.length, 1);
  assert.equal(patientPrescriptions.body.prescriptions[0].medication, 'Pending medication');
  assert.deepEqual(patientPrescriptions.body.pendingPrescriptions, []);
  const remainingPending = (await request(baseUrl, '/api/prescriptions', { cookie: admin.cookie })).body.pendingPrescriptions;
  assert.equal(remainingPending.length, 1);
  assert.equal(remainingPending[0].patient_email, otherHospitalEmail);
});
