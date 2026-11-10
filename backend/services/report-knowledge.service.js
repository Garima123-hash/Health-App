'use strict';

const { col } = require('../database/connection');
const { nowIso } = require('../utils/helpers');

const reportKnowledgeSeed = [
  {
    id: 'cbc',
    title: 'Complete blood count (CBC)',
    url: 'https://medlineplus.gov/lab-tests/complete-blood-count-cbc/',
    terms: ['cbc', 'complete blood count', 'blood count', 'hemoglobin', 'haemoglobin', 'hematocrit', 'haematocrit', 'red blood cell', 'white blood cell', 'platelet'],
    text: 'A complete blood count measures several types of cells in the blood. It commonly includes red blood cells, white blood cells, platelets, hemoglobin, and hematocrit. A result needs to be interpreted using its own reference range and the person’s health context.'
  },
  {
    id: 'glucose',
    title: 'Blood glucose test',
    url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/',
    terms: ['glucose', 'blood sugar', 'fasting blood sugar', 'fasting glucose'],
    text: 'A blood glucose test measures sugar in the blood. The meaning of a result can depend on whether the person was fasting, the timing of the test, medicines, and the laboratory’s reference range.'
  },
  {
    id: 'a1c',
    title: 'Hemoglobin A1C test',
    url: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/',
    terms: ['a1c', 'hba1c', 'hemoglobin a1c', 'glycated hemoglobin'],
    text: 'An A1C test reflects average blood glucose over roughly the past three months. A clinician interprets it with the laboratory range and other health information.'
  },
  {
    id: 'kidney',
    title: 'Creatinine and kidney tests',
    url: 'https://medlineplus.gov/lab-tests/creatinine-test/',
    terms: ['creatinine', 'egfr', 'estimated glomerular filtration rate', 'kidney function', 'bun', 'blood urea nitrogen'],
    text: 'Creatinine and estimated glomerular filtration rate (eGFR) are commonly used to assess kidney function. Results can be affected by factors such as age, body size, medicines, and hydration, so a clinician should interpret them in context.'
  },
  {
    id: 'lipids',
    title: 'Cholesterol and lipid tests',
    url: 'https://medlineplus.gov/cholesterollevels.html',
    terms: ['cholesterol', 'ldl', 'hdl', 'triglyceride', 'lipid panel'],
    text: 'A lipid panel may report total cholesterol, LDL, HDL, and triglycerides. Their significance depends on the values, the laboratory’s reference information, and a person’s overall health risks.'
  },
  {
    id: 'thyroid',
    title: 'Thyroid-stimulating hormone (TSH) test',
    url: 'https://medlineplus.gov/lab-tests/thyroid-stimulating-hormone-tsh-test/',
    terms: ['tsh', 'thyroid stimulating hormone', 'thyrotropin', 'thyroid'],
    text: 'A TSH test measures thyroid-stimulating hormone and is often used when evaluating thyroid function. It is usually interpreted alongside symptoms and sometimes other thyroid tests.'
  },
  {
    id: 'liver',
    title: 'Liver function tests',
    url: 'https://medlineplus.gov/lab-tests/liver-function-tests/',
    terms: ['alt', 'ast', 'alanine aminotransferase', 'aspartate aminotransferase', 'bilirubin', 'liver function', 'alp', 'alkaline phosphatase'],
    text: 'Liver function tests measure substances such as enzymes, proteins, or bilirubin in blood. An out-of-range value does not identify a cause by itself; clinicians interpret the pattern and health context.'
  }
];

function matchReportKnowledge(reportText, knowledge, limit = 5) {
  const text = String(reportText || '').toLowerCase();
  return knowledge
    .map(item => {
      const matches = item.terms.filter(term => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
      });
      return { ...item, score: matches.length, matches };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, title, url, text: reference, matches }) => ({
      id, title, url, text: reference, matches
    }));
}

async function retrieveReportKnowledge(reportText, limit = 5, collection = col('report_knowledge')) {
  const knowledge = await collection.find(
    { active: true },
    { projection: { _id: 0, id: 1, title: 1, url: 1, terms: 1, text: 1 } }
  ).toArray();
  if (!knowledge.length) throw new Error('The report reference library is empty; database seeding must complete before analysis.');
  return matchReportKnowledge(reportText, knowledge, limit);
}

async function seedReportKnowledge() {
  const collection = col('report_knowledge');
  const timestamp = nowIso();
  for (const reference of reportKnowledgeSeed) {
    await collection.updateOne(
      { id: reference.id },
      {
        $set: { ...reference, active: true },
        $setOnInsert: { created_at: timestamp, updated_at: timestamp }
      },
      { upsert: true }
    );
  }
}

module.exports = {
  matchReportKnowledge,
  reportKnowledgeSeed,
  retrieveReportKnowledge,
  seedReportKnowledge
};
