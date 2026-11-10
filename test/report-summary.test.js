const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { summarizeReportText } = require('../backend/services/report-summary.service');
const { extractReportSentences } = require('../backend/services/pdf.service');
const { UPLOAD_DIR } = require('../backend/config');
const { textPdf } = require('../helpers.cjs');
const {
  matchReportKnowledge,
  reportKnowledgeSeed,
  retrieveReportKnowledge
} = require('../backend/services/report-knowledge.service');

const retrieveTestKnowledge = async text => matchReportKnowledge(text, reportKnowledgeSeed);

test('OpenAI report explanation requests patient-friendly structured output', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = 'test-api-key';
  process.env.OPENAI_MODEL = 'test-model';
  let requestUrl;
  let requestOptions;

  try {
    const explanation = await summarizeReportText(
      'Patient Jane Doe jane@example.test, hemoglobin: 13 g/dL.',
      async (url, options) => {
        requestUrl = url;
        requestOptions = options;
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  overview: 'Your hemoglobin result is 13 g/dL.',
                  keyPoints: ['The report lists a hemoglobin value.'],
                  terms: [{ term: 'Hemoglobin', explanation: 'A protein in red blood cells.' }],
                  questions: ['How does this result compare with my other tests?']
                })
              }
            }]
          })
        };
      },
      ['Jane Doe'],
      retrieveTestKnowledge
    );

    assert.equal(requestUrl, 'https://api.openai.com/v1/chat/completions');
    assert.equal(requestOptions.headers.Authorization, 'Bearer test-api-key');
    const body = JSON.parse(requestOptions.body);
    assert.equal(body.model, 'test-model');
    assert.equal(body.response_format.type, 'json_object');
    assert.match(body.messages[1].content, /hemoglobin: 13 g\/dL/);
    assert.match(body.messages[1].content, /Retrieved local reference excerpts/);
    assert.doesNotMatch(body.messages[1].content, /Jane Doe|jane@example\.test/);
    assert.deepEqual(explanation.terms, [{ term: 'Hemoglobin', explanation: 'A protein in red blood cells.' }]);
    assert.equal(explanation.method, 'openai-rag');
    assert.equal(explanation.sources[0].title, 'Complete blood count (CBC)');
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

test('report explanation fails clearly when no server-side AI key is configured', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(summarizeReportText(
      'Patient Jane Doe, fasting glucose: 106 mg/dL. A1C: 5.8%.',
      undefined,
      ['Jane Doe'],
      retrieveTestKnowledge
    ), error => {
      assert.equal(error.status, 503);
      assert.match(error.message, /Set OPENAI_API_KEY in \.env/);
      return true;
    });
  } finally {
    if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey;
  }
});

test('report matching retrieves relevant references from the database corpus', async () => {
  const collection = {
    find(query, options) {
      assert.deepEqual(query, { active: true });
      assert.equal(options.projection._id, 0);
      return { toArray: async () => reportKnowledgeSeed };
    }
  };
  const references = await retrieveReportKnowledge('The patient has a cholesterol value and LDL result.', 5, collection);
  assert.equal(references.length, 1);
  assert.equal(references[0].id, 'lipids');
  assert.match(references[0].text, /lipid panel/);
  assert.equal((await retrieveReportKnowledge('No lab terms are present.', 5, collection)).length, 0);
});

test('report analyzer reports AI connection failures instead of returning local-only results', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-api-key';
  try {
    await assert.rejects(summarizeReportText('Hemoglobin 11.2 g/dL.', async () => {
      throw new Error('simulated network failure');
    }, [], retrieveTestKnowledge), error => {
      assert.equal(error.status, 502);
      assert.match(error.message, /Could not connect to the AI service/);
      return true;
    });
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test('synthetic CBC PDF text is sent to AI and explained with matching references and report values', async () => {
  const filename = `report-analysis-test-${process.pid}-${Date.now()}.pdf`;
  const reportText = 'Complete blood count report. Hemoglobin 11.2 g/dL with laboratory reference range 12.0 to 16.0 g/dL. White blood cell count 6.4 thousand per microliter. Platelet count 250 thousand per microliter. Please discuss these results with your clinician.';
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  try {
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), textPdf(reportText));
    const extracted = await extractReportSentences(filename);
    const extractedText = extracted.sentences.join('\n');

    assert.ok(extractedText.includes('Hemoglobin 11.2 g/dL'), extractedText);
    assert.equal(extracted.pagesRead, 1);
    assert.equal(extracted.totalPages, 1);

    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-api-key';
    try {
      let requestBody;
      const explanation = await summarizeReportText(extractedText, async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  overview: 'The report lists a hemoglobin value of 11.2 g/dL.',
                  keyPoints: ['Hemoglobin is 11.2 g/dL; the report range is 12.0 to 16.0 g/dL.'],
                  terms: [{ term: 'Hemoglobin', explanation: 'A protein in red blood cells.' }],
                  questions: ['How should I interpret this result?'],
                  precautions: ['Discuss the report with your clinician.']
                })
              }
            }]
          })
        };
      }, [], retrieveTestKnowledge);
      assert.equal(explanation.method, 'openai-rag');
      assert.match(requestBody.messages[1].content, /Hemoglobin 11\.2 g\/dL/);
      assert.match(requestBody.messages[1].content, /12\.0 to 16\.0 g\/dL/);
      assert.ok(explanation.sources.some(source => source.id === 'cbc'));
      assert.match(explanation.keyPoints[0], /11\.2 g\/dL/);
      assert.equal(explanation.terms[0].term, 'Hemoglobin');
      assert.ok(explanation.precautions.length > 0);
    } finally {
      if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey;
    }
  } finally {
    fs.rmSync(path.join(UPLOAD_DIR, filename), { force: true });
  }
});
