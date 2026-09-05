// Issues and rotates the per-household "webhook secret" used to
// authenticate unattended automation (MacroDroid/Tasker on Android,
// iOS Shortcuts, Twilio inbound SMS, inbound-email bridges) that has no
// logged-in browser session to carry a normal Supabase auth token -- see
// ingest-transaction.js, which is the endpoint that actually checks it.
// Any signed-in household member can view or rotate the secret (rotating
// invalidates it everywhere it is configured, so the user will need to
// re-paste it into MacroDroid/Shortcuts/Twilio after rotating).
import { requireUser, createAdminClient } from './admin/_auth.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

let user;
  try {
    user = await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

const admin = createAdminClient();
  const { data: member, error: memberErr } = await admin
  .from('household_members')
  .select('household_id')
  .eq('user_id', user.id)
  .limit(1)
  .maybeSingle();

if (memberErr || !member) {
  return res.status(404).json({ error: 'No household found for this account' });
}

const { action } = req.body || {};

if (action === 'regenerate') {
  const newSecret = crypto.randomBytes(20).toString('hex');
  const { error: updateErr } = await admin
  .from('households')
  .update({ webhook_secret: newSecret })
  .eq('id', member.household_id);
  if (updateErr) return res.status(500).json({ error: 'Could not regenerate secret' });
  return res.status(200).json({ secret: newSecret });
}

const { data: household, error: hErr } = await admin
  .from('households')
  .select('webhook_secret')
  .eq('id', member.household_id)
  .single();

if (hErr || !household) return res.status(404).json({ error: 'Household not found' });

if (household.webhook_secret) {
  return res.status(200).json({ secret: household.webhook_secret });
}

const secret = crypto.randomBytes(20).toString('hex');
  const { error: initErr } = await admin
  .from('households')
  .update({ webhook_secret: secret })
  .eq('id', member.household_id);
  if (initErr) return res.status(500).json({ error: 'Could not create secret' });
  return res.status(200).json({ secret });
}
