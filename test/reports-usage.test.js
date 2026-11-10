const assert = require('node:assert/strict');
const test = require('node:test');
const { registerPatient, request, startTestApp, textPdf } = require('../helpers.cjs');

test('report explanations require AI configuration and remain private to the owner', async context => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  context.after(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  });
  const { baseUrl } = await startTestApp(context);
  const hospitals = await request(baseUrl, '/api/hospitals');
  const owner = await registerPatient(baseUrl, hospitals.body.hospitals[0].id, 'Report Owner');
  const otherPatient = await registerPatient(baseUrl, hospitals.body.hospitals[0].id, 'Other Report Patient');

  const form = new FormData();
  form.append('report', new Blob([
    textPdf('This local report contains readable test information and a scheduled follow-up visit.')
  ], { type: 'application/pdf' }), 'test-report.pdf');
  form.append('shareWithHospital', 'false');
  const uploaded = await request(baseUrl, '/api/reports', {
    token: owner.token,
    method: 'POST',
    body: form
  });
  assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.body));
  const reportId = uploaded.body.report.id;

  const firstOverview = await request(baseUrl, `/api/reports/${reportId}/summary`, {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(firstOverview.response.status, 503, JSON.stringify(firstOverview.body));
  assert.match(firstOverview.body.error, /Set OPENAI_API_KEY in \.env/);
  const reportList = await request(baseUrl, '/api/reports', { token: owner.token });
  assert.equal(reportList.body.reports[0].shared_with_hospital, 0);

  const otherPatientView = await request(baseUrl, `/api/reports/${reportId}/summary`, {
    token: otherPatient.token,
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(otherPatientView.response.status, 404);
  assert.deepEqual((await request(baseUrl, '/api/reports', { token: otherPatient.token })).body.reports, []);
});
