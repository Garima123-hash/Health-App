const assert = require('node:assert/strict');
const test = require('node:test');
const { login, registerPatient, request, startTestApp, textPdf } = require('../helpers.cjs');

test('optional women’s health workspace stores private logs and retrieves selected local sources', async context => {
  const { baseUrl, adminEmail, adminPassword } = await startTestApp(context);
  const hospitals = await request(baseUrl, '/api/hospitals');
  const owner = await registerPatient(baseUrl, hospitals.body.hospitals[0].id, 'Health Space Owner', true);
  const otherPatient = await registerPatient(baseUrl, hospitals.body.hospitals[0].id, 'Other Health Space Patient', true);
  const ineligiblePatient = await registerPatient(baseUrl, hospitals.body.hospitals[0].id, 'Patient Without Eligibility');
  const admin = await login(baseUrl, adminEmail, adminPassword);
  const dateOffset = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
  const moodDate = dateOffset(2);
  const cycleStart = dateOffset(30);
  const cycleEnd = dateOffset(26);
  const invalidCycleEnd = dateOffset(27);
  const futureDate = dateOffset(-2);

  assert.equal((await request(baseUrl, '/api/womens-health')).response.status, 401);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: admin.token })).response.status, 403);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: owner.token })).body.enabled, false);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: ineligiblePatient.token })).response.status, 403);
  assert.equal((await request(baseUrl, '/api/womens-health/consent', {
    token: ineligiblePatient.token, method: 'POST', body: JSON.stringify({ enabled: true })
  })).response.status, 403);
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

  const knowledgeForm = new FormData();
  knowledgeForm.append('document', new Blob([
    textPdf('Pregnancy care includes regular antenatal visits with a qualified clinician. Discuss medicines and new symptoms with your pregnancy-care professional.')
  ], { type: 'application/pdf' }), 'pregnancy-care.pdf');
  const knowledge = await request(baseUrl, '/api/admin/womens-health/knowledge', {
    token: admin.token, method: 'POST', body: knowledgeForm
  });
  assert.equal(knowledge.response.status, 201, JSON.stringify(knowledge.body));
  assert.equal((await request(baseUrl, '/api/admin/womens-health/knowledge', { token: owner.token })).response.status, 403);
  assert.equal((await request(baseUrl, '/api/admin/womens-health/knowledge', { token: admin.token })).body.documents.length, 1);

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

  const pregnancyGuide = await request(baseUrl, '/api/womens-health/guide', {
    token: owner.token,
    method: 'POST',
    body: JSON.stringify({ question: 'What should I know about pregnancy antenatal care?' })
  });
  assert.equal(pregnancyGuide.response.status, 200, JSON.stringify(pregnancyGuide.body));
  assert.ok(pregnancyGuide.body.sources.some(source => source.title.includes('pregnancy-care.pdf')));
  assert.match(pregnancyGuide.body.answer, /regular antenatal visits/);

  const enableOtherPatient = await request(baseUrl, '/api/womens-health/consent', {
    token: otherPatient.token,
    method: 'POST',
    body: JSON.stringify({ enabled: true })
  });
  assert.equal(enableOtherPatient.response.status, 200);
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
  assert.equal(otherHistoryAccess.response.status, 404);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: otherPatient.token })).body.enabled, true);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: admin.token })).response.status, 403);

  const deleteKnowledge = await request(baseUrl, `/api/admin/womens-health/knowledge/${knowledge.body.document.id}`, {
    token: admin.token, method: 'DELETE'
  });
  assert.equal(deleteKnowledge.response.status, 200);

  const deleted = await request(baseUrl, '/api/womens-health/data', { token: owner.token, method: 'DELETE' });
  assert.equal(deleted.response.status, 200);
  assert.equal((await request(baseUrl, '/api/womens-health', { token: owner.token })).body.enabled, false);
});
