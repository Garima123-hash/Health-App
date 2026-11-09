const assert = require('node:assert/strict');
const test = require('node:test');
const { registerPatient, request, startTestApp, textPdf } = require('../helpers.cjs');

test('local report overviews extract text and record usage only for the owner', async context => {
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
    cookie: owner.cookie,
    method: 'POST',
    body: form
  });
  assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.body));
  const reportId = uploaded.body.report.id;

  const firstOverview = await request(baseUrl, `/api/reports/${reportId}/summary`, {
    cookie: owner.cookie,
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(firstOverview.response.status, 200, JSON.stringify(firstOverview.body));
  assert.equal(firstOverview.body.method, 'local-extractive');
  assert.match(firstOverview.body.summary.join(' '), /readable test information/);
  assert.equal(firstOverview.body.usageCount, 1);
  assert.match(firstOverview.body.notice, /not AI/);

  const secondOverview = await request(baseUrl, `/api/reports/${reportId}/summary`, {
    cookie: owner.cookie,
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(secondOverview.body.usageCount, 2);
  const reportList = await request(baseUrl, '/api/reports', { cookie: owner.cookie });
  assert.equal(reportList.body.reports[0].summary_count, 2);
  assert.equal(reportList.body.reports[0].shared_with_hospital, 0);

  const otherPatientView = await request(baseUrl, `/api/reports/${reportId}/summary`, {
    cookie: otherPatient.cookie,
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(otherPatientView.response.status, 404);
  assert.deepEqual((await request(baseUrl, '/api/reports', { cookie: otherPatient.cookie })).body.reports, []);
});
