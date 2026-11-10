'use strict';

const express = require('express');
const { col, getDb } = require('../database/connection');
const {
  asyncRoute,
  cleanText,
  idFrom,
  nowIso,
  withoutMongoId
} = require('../utils/helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

async function invoiceRows(user) {
  const filter = user.role === 'admin' ? {} : { user_id: user.id };
  const invoices = await col('invoices').find(filter).sort({ created_at: -1 }).toArray();
  const users = await col('users').find({ role: 'patient' }).toArray();
  const patientMap = new Map(users.map(item => [item.id, item]));
  return invoices.map(item => ({
    id: item.id, user_id: item.user_id, description: item.description, amount_cents: item.amount_cents,
    status: item.status, created_at: item.created_at, paid_at: item.paid_at ?? null,
    payment_method: item.payment_method ?? null, patient_name: patientMap.get(item.user_id)?.name || '',
    patient_email: patientMap.get(item.user_id)?.email || ''
  }));
}

router.get('/', requireAuth, asyncRoute(async (req, res) => res.json({ invoices: await invoiceRows(req.user) })));

router.post('/admin', requireAdmin, asyncRoute(async (req, res) => {
  const db = getDb();
  const userId = idFrom(req.body.userId);
  const description = cleanText(req.body.description, 160);
  const amountCents = Number(req.body.amountCents);
  if (!userId || !await col('users').findOne({ id: userId, role: 'patient' })) return res.status(400).json({ error: 'Choose a registered patient at your hospital.' });
  if (description.length < 2) return res.status(400).json({ error: 'Enter an invoice description.' });
  if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 100000000) return res.status(400).json({ error: 'Enter a valid invoice amount.' });
  const invoice = { id: await db.nextId('invoices'), user_id: userId, description, amount_cents: amountCents, status: 'Due', created_at: nowIso() };
  await col('invoices').insertOne(invoice);
  return res.status(201).json({ invoice: withoutMongoId(invoice) });
}));

router.post('/:id/pay-demo', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patient accounts can update their demo payment status.' });
  const paymentMethod = req.body.paymentMethod;
  if (!['pay-at-hospital', 'upi-demo', 'card-demo'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose one of the available demonstration payment methods.' });
  const result = await col('invoices').updateOne(
    { id: idFrom(req.params.id), user_id: req.user.id, status: 'Due' },
    { $set: { status: 'Paid', paid_at: nowIso(), payment_method: paymentMethod } }
  );
  if (!result.matchedCount) {
    const invoice = await col('invoices').findOne({ id: idFrom(req.params.id), user_id: req.user.id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    return res.status(409).json({ error: 'This invoice has already been paid.' });
  }
  return res.json({ ok: true, payment: 'demo-only-no-charge', paymentMethod });
}));

module.exports = router;

