'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { col, getDb } = require('../database/connection');
const { cleanText, isPastOrToday, nowIso, asyncRoute } = require('../utils/helpers');
const { requireFemalePatient } = require('../middleware/auth.middleware');
const { funFacts, retrieveKnowledge } = require('../womens-health-knowledge');
const { extractReportSentences } = require('../services/pdf.service');

const router = express.Router();

const womensHealthGuideLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/', requireFemalePatient, asyncRoute(async (req, res) => {
  const user = await col('users').findOne({ id: req.user.id }, { projection: { womens_health_enabled: 1 } });
  if (!user?.womens_health_enabled) return res.json({ enabled: false });
  const [moodEntries, cycleEntries, reportOptions] = await Promise.all([
    col('womens_health_mood_entries').find({ user_id: req.user.id }, { projection: { _id: 0, id: 1, entry_date: 1, mood: 1, stress_level: 1, sleep_hours: 1, energy_level: 1, symptoms: 1 } }).sort({ entry_date: -1 }).limit(30).toArray(),
    col('womens_health_cycle_entries').find({ user_id: req.user.id }, { projection: { _id: 0, id: 1, start_date: 1, end_date: 1 } }).sort({ start_date: -1 }).limit(24).toArray(),
    col('reports').find({ user_id: req.user.id, mime_type: 'application/pdf' }, { projection: { _id: 0, id: 1, original_name: 1, created_at: 1 } }).sort({ created_at: -1 }).limit(10).toArray()
  ]);
  return res.json({ enabled: true, moodEntries, cycleEntries, reportOptions, funFacts });
}));

router.post('/consent', requireFemalePatient, asyncRoute(async (req, res) => {
  if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ error: 'Choose whether to enable the optional Women’s Health section.' });
  await col('users').updateOne({ id: req.user.id }, { $set: { womens_health_enabled: req.body.enabled } });
  return res.json({ enabled: req.body.enabled });
}));

router.post('/mood', requireFemalePatient, asyncRoute(async (req, res) => {
  const db = getDb();
  const user = await col('users').findOne({ id: req.user.id }, { projection: { womens_health_enabled: 1 } });
  if (!user?.womens_health_enabled) return res.status(403).json({ error: 'Enable the optional Women’s Health section before saving check-ins.' });
  const { entryDate, mood, stressLevel, sleepHours, energyLevel } = req.body;
  const allowedMoods = ['great', 'good', 'okay', 'low', 'very_low'];
  const allowedSymptoms = ['anxiety', 'irritability', 'fatigue', 'cramps', 'headache', 'bloating', 'acne', 'irregular_periods'];
  const symptoms = req.body.symptoms;
  const stress = Number(stressLevel);
  const sleep = Number(sleepHours);
  const energy = Number(energyLevel);

  if (!isPastOrToday(entryDate) || entryDate < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Choose a check-in date within the past year, not a future date.' });
  }
  if (!allowedMoods.includes(mood)) return res.status(400).json({ error: 'Choose a mood from the list.' });
  if (!Number.isInteger(stress) || stress < 1 || stress > 5) return res.status(400).json({ error: 'Stress level must be from 1 to 5.' });
  if (!Number.isFinite(sleep) || sleep < 0 || sleep > 24) return res.status(400).json({ error: 'Sleep hours must be between 0 and 24.' });
  if (!Number.isInteger(energy) || energy < 1 || energy > 5) return res.status(400).json({ error: 'Energy level must be from 1 to 5.' });
  if (!Array.isArray(symptoms) || symptoms.length > allowedSymptoms.length || symptoms.some(item => !allowedSymptoms.includes(item)) || new Set(symptoms).size !== symptoms.length) {
    return res.status(400).json({ error: 'Choose valid symptoms from the check-in list.' });
  }

  await col('womens_health_mood_entries').updateOne(
    { user_id: req.user.id, entry_date: entryDate },
    { $set: { mood, stress_level: stress, sleep_hours: sleep, energy_level: energy, symptoms },
      $setOnInsert: { id: await db.nextId('womens_health_mood_entries'), user_id: req.user.id, entry_date: entryDate, created_at: nowIso() } },
    { upsert: true }
  );

  return res.status(201).json({ ok: true, entryDate });
}));

router.post('/cycle', requireFemalePatient, asyncRoute(async (req, res) => {
  const db = getDb();
  const user = await col('users').findOne({ id: req.user.id }, { projection: { womens_health_enabled: 1 } });
  if (!user?.womens_health_enabled) return res.status(403).json({ error: 'Enable the optional Women’s Health section before saving cycle dates.' });
  const { startDate } = req.body;
  const endDate = req.body.endDate || null;
  if (!isPastOrToday(startDate) || startDate < new Date(Date.now() - 5 * 366 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Choose a period start date within the past five years, not a future date.' });
  }
  if (endDate !== null && (!isPastOrToday(endDate) || endDate < startDate)) return res.status(400).json({ error: 'End date must be on or after the start date and not in the future.' });
  await col('womens_health_cycle_entries').updateOne(
    { user_id: req.user.id, start_date: startDate },
    { $set: { end_date: endDate }, $setOnInsert: { id: await db.nextId('womens_health_cycle_entries'), user_id: req.user.id, start_date: startDate, created_at: nowIso() } },
    { upsert: true }
  );
  return res.status(201).json({ ok: true, startDate, endDate });
}));

router.post('/guide', womensHealthGuideLimiter, requireFemalePatient, asyncRoute(async (req, res) => {
  const user = await col('users').findOne({ id: req.user.id }, { projection: { womens_health_enabled: 1 } });
  if (!user?.womens_health_enabled) return res.status(403).json({ error: 'Enable the optional Women’s Health section before using the health guide.' });
  const question = cleanText(req.body.question, 500);
  if (question.length < 3) return res.status(400).json({ error: 'Enter a health question of at least 3 characters.' });
  const includeMoodHistory = req.body.includeMoodHistory === true;
  const includeReports = req.body.includeReports === true;
  const reportIds = req.body.reportIds === undefined ? [] : req.body.reportIds;
  if (!Array.isArray(reportIds) || reportIds.length > 3 || reportIds.some(id => !Number.isSafeInteger(Number(id)) || Number(id) < 1) || new Set(reportIds.map(Number)).size !== reportIds.length) {
    return res.status(400).json({ error: 'Select up to three valid PDF reports.' });
  }
  if (!includeReports && reportIds.length) return res.status(400).json({ error: 'Confirm report use before selecting medical history files.' });
  const knowledge = retrieveKnowledge(question);
  const reportsUsed = [];
  const reportMatches = [];
  for (const id of reportIds.map(Number)) {
    const report = await col('reports').findOne({ id, user_id: req.user.id });
    if (!report) return res.status(404).json({ error: 'A selected report was not found in your account.' });
    if (report.mime_type !== 'application/pdf') return res.status(415).json({ error: 'Only text-based PDF reports can be searched locally.' });
    const { sentences } = await extractReportSentences(report.stored_name, 10);
    const queryTerms = new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    const matches = sentences.map((text, index) => ({
      text, index,
      score: [...new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter(word => queryTerms.has(word)).length
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2);
    reportsUsed.push({ id: report.id, name: report.original_name, hadSelectableText: sentences.length > 0 });
    reportMatches.push(...matches.map(match => ({ reportName: report.original_name, excerpt: match.text.slice(0, 350) })));
  }
  let moodReflection = null;
  if (includeMoodHistory) {
    const entries = await col('womens_health_mood_entries').find(
      { user_id: req.user.id }, { projection: { _id: 0, entry_date: 1, mood: 1, stress_level: 1, sleep_hours: 1, energy_level: 1 } }
    ).sort({ entry_date: -1 }).limit(30).toArray();
    const lowerMoodCount = entries.filter(entry => entry.mood === 'low' || entry.mood === 'very_low').length;
    const averageStress = entries.length ? Number((entries.reduce((total, entry) => total + entry.stress_level, 0) / entries.length).toFixed(1)) : null;
    moodReflection = {
      checkInsReviewed: entries.length, lowerMoodCheckIns: lowerMoodCount, averageStressLevel: averageStress,
      message: entries.length
        ? 'This is a simple count of your own recent check-ins, not a mental-health assessment or explanation of why you felt this way.'
        : 'There are no mood check-ins to include yet.'
    };
  }
  const mentionsPcos = /\b(pcos|pcod|polycystic|ovarian)\b/i.test(question);
  const answer = [
    mentionsPcos
      ? 'I cannot determine whether you have PCOS/PCOD from symptoms, mood check-ins, or uploaded records. A clinician needs to review your health history and may use an examination or tests to consider other causes.'
      : 'This is general health education, not a diagnosis or personalized treatment plan.',
    ...(knowledge.length ? knowledge.map(item => item.text) : ['I could not find a close match in the local health-information library. Try asking about PCOS/PCOD, clinical assessment, balanced eating, or mood check-ins, and discuss personal concerns with a clinician.']),
    ...(reportMatches.length ? ['Selected report text that matched your question is shown separately as an unverified excerpt; the app does not interpret it.'] : []),
    'Do not start, stop, or change medicines, supplements, or a restrictive diet based on this guide. Contact a qualified clinician for advice about your situation.'
  ].join('\n\n');
  return res.json({
    method: 'local-keyword-rag', answer,
    sources: knowledge.map(({ id, title, url }) => ({ id, title, url })),
    reportMatches, reportsUsed, moodReflection,
    notice: 'Local retrieval only: no external AI model or service is connected. This feature does not diagnose PCOS/PCOD, interpret medical records, or provide treatment advice.'
  });
}));

router.delete('/data', requireFemalePatient, asyncRoute(async (req, res) => {
  await Promise.all([
    col('womens_health_mood_entries').deleteMany({ user_id: req.user.id }),
    col('womens_health_cycle_entries').deleteMany({ user_id: req.user.id }),
    col('users').updateOne({ id: req.user.id }, { $set: { womens_health_enabled: false } })
  ]);
  return res.json({ ok: true, enabled: false });
}));

module.exports = router;
