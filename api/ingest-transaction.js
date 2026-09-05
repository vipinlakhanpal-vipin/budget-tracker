// Unattended ingestion endpoint for bank transaction alerts (SMS or email)
// forwarded by automation the user sets up themselves -- MacroDroid/Tasker
// on Android (fully automatic), an iOS Shortcut triggered from the Share
// Sheet or a Forward-to-number flow on iPhone, or a mail-forwarding rule
// for email-based transactions on either platform. See the E-Manual for
// setup instructions for each path.
//
// There is no logged-in browser session here, so this does NOT use
// requireUser -- instead the caller authenticates with the per-household
// "webhook secret" from webhook-secret.js, sent as secret in the JSON
// body (or a secret query param, since some automation tools can only
// set the URL, not the POST body).
//
// Same AI pattern as scan-receipt.js / categorize-expense.js: Claude haiku
// reads the raw alert text and returns structured fields. Unlike those,
// this endpoint does the Supabase insert itself (there is no logged-in
// frontend session waiting to do it), using the service-role client so it
// can write regardless of RLS.
import { createAdminClient } from './admin/_auth.js';

const MODEL = 'claude-haiku-4-5-20251001';

function extractJsonObject(text) {
  if (!text) return null;
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    const braceMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!braceMatch) return null;
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      return null;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

const body = req.body || {};
  const secret = body.secret || req.query.secret;
  const rawText = body.text || body.Body || '';
  const source = body.source === 'email' ? 'email' : 'sms';

if (!secret) return res.status(401).json({ error: 'Missing secret' });
  if (!rawText || !rawText.trim()) return res.status(400).json({ error: 'Missing alert text' });

const admin = createAdminClient();
  const { data: household, error: hErr } = await admin
  .from('households')
  .select('id')
  .eq('webhook_secret', secret)
  .maybeSingle();

if (hErr || !household) return res.status(401).json({ error: 'Invalid secret' });

const { data: categories } = await admin
  .from('categories')
  .select('id, name')
  .eq('household_id', household.id);

const categoryNames = (categories || []).map((c) => c.name);

const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: false, reason: 'AI not configured' });

const prompt =
  `You extract structured data from a bank transaction alert (an SMS or email sent by a bank ` +
  `or card issuer). The alert may or may not describe an actual purchase -- ignore OTPs, ` +
  `balance/mini-statement replies, login alerts, promotional messages, and credits/refunds/` +
  `salary deposits (money coming IN, not being spent).\n\n` +
  `Respond with ONLY a JSON object, no markdown fences, no extra text, in exactly this shape:\n` +
  `{"isTransaction": boolean, "amount": number|null, "merchant": string|null, ` +
  `"paymentSource": "Credit Card"|"Debit Card"|"Bank"|null, "bank": string|null, ` +
  `"categoryName": string|null}\n\n` +
  `Rules:\n` +
  `- isTransaction: true only if money was actually spent/debited -- a card purchase, POS ` +
  `swipe, UPI payment, online payment, ATM withdrawal, or bill auto-debit. false for anything ` +
  `else (OTPs, balance alerts, login alerts, promotions, incoming credits, failed/declined ` +
  `transactions).\n` +
  `- amount: the transaction amount as a plain number, no currency symbol or commas, or null.\n` +
  `- merchant: the merchant/payee name if present (e.g. "Amazon", "Starbucks"), else a short ` +
  `plain description, or null.\n` +
  `- paymentSource: "Credit Card" if paid by credit card, "Debit Card" if paid by debit card, ` +
  `"Bank" if it is a direct bank/UPI/net-banking debit not through a card, else null.\n` +
  `- bank: the bank or card issuer name if mentioned (e.g. "HDFC Bank", "Chase"), else null.\n` +
  `- categoryName: the single best match from this list, exactly as written, or null if ` +
  `nothing fits reasonably: ${categoryNames.join(', ')}\n\n` +
  `Raw alert text:\n"""\n${rawText}\n"""\n\n` +
  `Respond with ONLY the JSON object.`;

let parsed = null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await r.json();
    const text = data?.content?.[0]?.text || '';
    parsed = extractJsonObject(text);
  } catch (e) {
    console.error('ingest-transaction AI call failed:', e);
    return res.status(200).json({ ok: false, reason: 'AI call failed' });
  }

if (!parsed || !parsed.isTransaction || !Number.isFinite(Number(parsed.amount)) || Number(parsed.amount) <= 0) {
  return res.status(200).json({ ok: true, skipped: true });
}

const amount = Number(parsed.amount);
  const description = typeof parsed.merchant === 'string' && parsed.merchant.trim() ? parsed.merchant.trim().slice(0, 200) : 'Auto-imported transaction';
  const paymentSource = ['Credit Card', 'Debit Card', 'Bank'].includes(parsed.paymentSource) ? parsed.paymentSource : null;
  const paymentBank = typeof parsed.bank === 'string' && parsed.bank.trim() ? parsed.bank.trim().slice(0, 100) : null;
  const categoryName = typeof parsed.categoryName === 'string' ? parsed.categoryName : null;
  const category = (categories || []).find((c) => c.name.toLowerCase() === (categoryName || '').toLowerCase());
  const expenseDate = new Date().toISOString().slice(0, 10);

const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: dupes } = await admin
  .from('expenses')
  .select('id')
  .eq('household_id', household.id)
  .eq('amount', amount)
  .eq('description', description)
  .gte('created_at', tenMinutesAgo)
  .limit(1);

if (dupes && dupes.length > 0) {
  return res.status(200).json({ ok: true, duplicate: true });
}

const { error: insertErr } = await admin.from('expenses').insert({
  expense_date: expenseDate,
  category_id: category ? category.id : null,
  description,
  amount,
  created_by: null,
  created_by_email: source === 'email' ? 'Auto-import (Email)' : 'Auto-import (SMS)',
  household_id: household.id,
  payment_source: paymentSource,
  payment_bank: paymentBank,
});

if (insertErr) {
  console.error('ingest-transaction insert failed:', insertErr);
  return res.status(500).json({ ok: false, reason: 'Could not save expense' });
}

return res.status(200).json({ ok: true, inserted: true });
}
