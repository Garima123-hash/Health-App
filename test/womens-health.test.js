const assert = require('node:assert/strict');
const test = require('node:test');
const { login, registerPatient, request, startTestApp, textPdf } = require('../helpers.cjs');

test('optional women’s health workspace stores private logs and retrieves selected local sources', async context => {
  const { baseUrl, adminEmail, adminPassword } = await startTestApp(context);
  const hospitals = await request(baseUrl, '/api/hospitals');
  const owner = await registerPatient(baseUrl, hospitals.body.hospitals[0].id, 'Health Space Owner', 'female');
  const otherPatient = await registerPatient(baseUrl, hospitals.body.hospitals[0].id, 'Other Health Space Patient');
  assert.equal(owner.user.gender, 'female');
  assert.equal(otherPatient.user.gender, 'male');
  const admin = await login(baseUrl, adminEmail, adminPassword);
  const dateOffset = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
  const moodDate = dateOffset(2);
  const cycleStart = dateOffset(30);
  const cycleEnd = dateOffset(26);
  const invalidCycleEnd = dateOffset(27);
  const futureDate = dateOffset(-2);

  assert.equal((await request(baseUrl, '/api/womens-health')).response.status, 401);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: admin.token })).response.status, 403);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: otherPatient.token })).response.status, 403);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: owner.token })).body.enabled, false);
  const disabledWrite = await request(baseUrl, '/api/womens-health/mood', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({ entryDate: moodDate, mood: 'low', stressLevel: 4, sleepHours: 5, energyLevel: 2, symptoms: [] })
  });
  assert.equal(disabledWrite.response.status, 403);

  const enabled = await request(baseUrl, '/api/womens-health/consent', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({ enabled: true })
  });
  assert.equal(enabled.response.status, 200);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: owner.token })).body.enabled, true);

  const mood = await request(baseUrl, '/api/womens-health/mood', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({
      entryDate: moodDate,
      mood: 'low',
      stressLevel: 4,
      sleepHours: 6.5,
      energyLevel: 2,
      symptoms: ['fatigue', 'irregular_periods']
    })
  });
  assert.equal(mood.response.status, 201, JSON.stringify(mood.body));
  const upsertMood = await request(baseUrl, '/api/womens-health/mood', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({
      entryDate: moodDate,
      mood: 'okay',
      stressLevel: 3,
      sleepHours: 7,
      energyLevel: 3,
      symptoms: []
    })
  });
  assert.equal(upsertMood.response.status, 201);

  const invalidMood = await request(baseUrl, '/api/womens-health/mood', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({ entryDate: futureDate, mood: 'very_low', stressLevel: 4, sleepHours: 5, energyLevel: 1, symptoms: [] })
  });
  assert.equal(invalidMood.response.status, 400);

  const cycle = await request(baseUrl, '/api/womens-health/cycle', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({ startDate: cycleStart, endDate: cycleEnd })
  });
  assert.equal(cycle.response.status, 201, JSON.stringify(cycle.body));
  const invalidCycle = await request(baseUrl, '/api/womens-health/cycle', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({ startDate: dateOffset(25), endDate: invalidCycleEnd })
  });
  assert.equal(invalidCycle.response.status, 400);

  const pdfForm = new FormData();
  pdfForm.append('report', new Blob([
    textPdf('This private history report records fatigue and a clinician follow-up to discuss menstrual cycle changes.')
  ], { type: 'application/pdf' }), 'private-health-history.pdf');
  pdfForm.append('shareWithHospital', 'false');
  const report = await request(baseUrl, '/api/reports', {
    token: owner.token,
    method: 'POST',
    body: pdfForm
  });
  assert.equal(report.response.status, 201, JSON.stringify(report.body));

  const guide = await request(baseUrl, '/api/womens-health/guide', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({
      question: 'Can fatigue and irregular periods diagnose PCOS, and what should I eat?',
      includeMoodHistory: true,
      includeReports: true,
      reportIds: [report.body.report.id]
    })
  });
  assert.equal(guide.response.status, 200, JSON.stringify(guide.body));
  assert.equal(guide.body.method, 'local-keyword-rag');
  assert.match(guide.body.answer, /cannot determine whether you have PCOS\/PCOD/);
  assert.match(guide.body.answer, /adequacy, balance, moderation, and diversity/);
  assert.ok(guide.body.sources.some(source => source.url.includes('womenshealth.gov')));
  assert.equal(guide.body.moodReflection.checkInsReviewed, 1);
  assert.equal(guide.body.moodReflection.lowerMoodCheckIns, 0);
  assert.match(guide.body.reportMatches[0].excerpt, /fatigue/);
  assert.match(guide.body.notice, /no external AI model/);

  const enableOtherPatient = await request(baseUrl, '/api/womens-health/consent', {
    token: otherPatient.token,
    method: 'POST',
    body: JSON.stringify({ enabled: true })
  });
  assert.equal(enableOtherPatient.response.status, 403);
  const otherHistoryAccess = await request(baseUrl, '/api/womens-health/guide', {
    token: otherPatient.token,
    method: 'POST',
    body: JSON.stringify({
      question: 'What does this report say about menstrual cycle changes?',
      includeMoodHistory: false,
      includeReports: true,
      reportIds: [report.body.report.id]
    })
  });
  assert.equal(otherHistoryAccess.response.status, 403);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: otherPatient.token })).response.status, 403);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: admin.token })).response.status, 403);

  const deleted = await request(baseUrl, '/api/womens-health/data', { token: owner.token, method: 'DELETE' });
  assert.equal(deleted.response.status, 200);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: owner.token })).body.enabled, false);

  const updatedProfile = await request(baseUrl, '/api/profile', {
    token: owner.token,
    method: 'PATCH',
    body: JSON.stringify({ name: owner.user.name, email: owner.email, gender: 'male' })
  });
  assert.equal(updatedProfile.response.status, 200, JSON.stringify(updatedProfile.body));
  assert.equal(updatedProfile.body.user.gender, 'male');
  assert.equal((await request(baseUrl, '/api/womens-health', { token: owner.token })).response.status, 403);
});
