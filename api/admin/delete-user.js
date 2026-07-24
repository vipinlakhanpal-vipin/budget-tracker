import { createAdminClient, requireAdmin } from './_auth.js';

// Deletes a user Vipin found in the admin Users tab. If the person has a
// real Supabase auth account (userId), we delete that -- which cascades
// to household_members via its "on delete cascade" FK, so their household
// membership disappears too. household_invites has no such FK (it's keyed
// by email text, not user id), so we also explicitly clear any invite row
// for that email so a stale "invited" entry doesn't linger behind.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }
  const { userId, email, inviteId } = req.body || {};
  if (!userId && !inviteId) {
    return res.status(400).json({ error: 'userId or inviteId is required' });
  }
  const admin = createAdminClient();
  try {
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    }
    if (email) {
      const { error } = await admin.from('household_invites').delete().ilike('email', email.trim());
      if (error) throw error;
    } else if (inviteId) {
      const { error } = await admin.from('household_invites').delete().eq('id', inviteId);
      if (error) throw error;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Could not delete user' });
  }
}
