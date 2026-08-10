import { createAdminClient, requireAdmin } from './_auth.js';

// Plan-tier admin endpoint -- action-dispatch pattern (kept in this same
// file rather than a new one) since Vercel's Hobby plan caps a project at
// 12 serverless functions, already exactly met. GET still returns the
// household list (now including `plan`, used by the Invite tab's dropdown
// and the new Households tab); POST with {action:'setPlan'} is the only
// way a household's plan actually changes -- there's no payment processor
// wired up yet, this is a deliberate manual/admin-granted flag (see
// supabase/migration_plan_tier.sql for the full rationale).
export default async function handler(req, res) {
  try {
    await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const admin = createAdminClient();

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('households')
      .select('id, name, created_at, plan')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ households: data || [] });
  }

  if (req.method === 'POST') {
    const { action, householdId, plan } = req.body || {};
    if (action === 'setPlan') {
      if (!householdId || !['free', 'paid'].includes(plan)) {
        return res.status(400).json({ error: 'householdId and a valid plan (free/paid) are required.' });
      }
      const { data, error } = await admin
        .from('households')
        .update({ plan })
        .eq('id', householdId)
        .select('id, name, created_at, plan')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ household: data });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
