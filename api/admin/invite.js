import { createAdminClient, requireAdmin } from './_auth.js';

const SITE_URL = 'https://budget-tracker-tau-liart.vercel.app';

const DEFAULT_CATEGORIES = [
  'Groceries', 'Rent/Mortgage', 'Utilities', 'Transportation', 'Dining Out',
  'Entertainment', 'Health', 'Shopping', 'Loan EMI', 'Credit Card EMI', 'Other',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let adminUser;
  try {
    adminUser = await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { email, relation, householdId, newHouseholdName } = req.body || {};
  if (!email || !relation) {
    return res.status(400).json({ error: 'Email and relation are required' });
  }
  if (!householdId && !newHouseholdName) {
    return res.status(400).json({ error: 'Choose an existing household or provide a new household name' });
  }

  const admin = createAdminClient();
  let targetHouseholdId = householdId;

  if (!targetHouseholdId) {
    const { data: newHousehold, error: hErr } = await admin
      .from('households')
      .insert({ name: newHouseholdName.trim(), created_by: adminUser.id })
      .select()
      .single();
    if (hErr) return res.status(500).json({ error: hErr.message });
    targetHouseholdId = newHousehold.id;

    await admin.from('categories').insert(
      DEFAULT_CATEGORIES.map((n) => ({ name: n, household_id: targetHouseholdId }))
    );
    await admin.from('settings').insert({ household_id: targetHouseholdId, total_monthly_budget: 0 });
  }

  // Avoid creating a second pending-invite row if this admin retries after
  // an earlier attempt (e.g. one that failed on the auth-email rate limit).
  const { data: existingInvite } = await admin
    .from('household_invites')
    .select('id')
    .eq('household_id', targetHouseholdId)
    .eq('status', 'pending')
    .ilike('email', email.trim())
    .maybeSingle();

  if (!existingInvite) {
    const { error: inviteErr } = await admin.from('household_invites').insert({
      household_id: targetHouseholdId,
      email: email.trim(),
      relation,
      invited_by: adminUser.id,
    });
    if (inviteErr) return res.status(500).json({ error: inviteErr.message });
  }

  const { error: userErr } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: SITE_URL,
  });

  const alreadyRegistered = !!userErr && /already/i.test(userErr.message || '');
  if (userErr && !alreadyRegistered) {
    return res.status(500).json({ error: userErr.message });
  }

  res.status(200).json({ ok: true, householdId: targetHouseholdId, userAlreadyExisted: alreadyRegistered });
}
