import { createAdminClient, requireAdmin } from './_auth.js';

// This endpoint powers the admin "Users" tab. Vipin's ask was to see
// every signup attempt across every household -- successful and
// unsuccessful -- not just the pending invites for one household. So
// instead of querying a single table, we cross-reference three sources:
//   - auth.users (every account that was ever created, via the admin API)
//   - household_members (accounts that actually landed in a household)
//   - household_invites (invites sent, regardless of whether the person
//     ever signed up)
// and classify each unique email into a status so the UI can group them
// into "successful" vs "unsuccessful/pending".
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }
  const admin = createAdminClient();
  try {
    let authUsers = [];
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      authUsers = authUsers.concat(data.users || []);
      if (!data.users || data.users.length < 1000) break;
      page += 1;
    }

    const [{ data: households, error: hErr }, { data: members, error: mErr }, { data: invites, error: iErr }] = await Promise.all([
      admin.from('households').select('id, name, created_at'),
      admin.from('household_members').select('id, household_id, user_id, email, role, relation, name, joined_at'),
      admin.from('household_invites').select('id, household_id, email, relation, status, name, created_at'),
    ]);
    if (hErr) throw hErr;
    if (mErr) throw mErr;
    if (iErr) throw iErr;

    const householdNameById = {};
    (households || []).forEach((h) => { householdNameById[h.id] = h.name; });

    const membersByEmail = {};
    (members || []).forEach((m) => {
      const key = (m.email || '').toLowerCase();
      (membersByEmail[key] = membersByEmail[key] || []).push(m);
    });

    const invitesByEmail = {};
    (invites || []).forEach((inv) => {
      const key = (inv.email || '').toLowerCase();
      (invitesByEmail[key] = invitesByEmail[key] || []).push(inv);
    });

    const authByEmail = {};
    authUsers.forEach((u) => { authByEmail[(u.email || '').toLowerCase()] = u; });

    const allEmails = new Set([
      ...authUsers.map((u) => (u.email || '').toLowerCase()),
      ...Object.keys(membersByEmail),
      ...Object.keys(invitesByEmail),
    ]);

    const rows = [...allEmails].filter(Boolean).map((emailKey) => {
      const authUser = authByEmail[emailKey];
      const memberRows = membersByEmail[emailKey] || [];
      const inviteRows = invitesByEmail[emailKey] || [];
      const displayEmail = authUser?.email || memberRows[0]?.email || inviteRows[0]?.email || emailKey;

      let status;
      if (authUser && memberRows.length > 0) {
        status = 'active';
      } else if (authUser && !authUser.email_confirmed_at) {
        status = 'unverified';
      } else if (authUser && memberRows.length === 0) {
        status = 'orphaned';
      } else if (inviteRows.length > 0) {
        status = 'invited';
      } else {
        status = 'unknown';
      }

      return {
        email: displayEmail,
        userId: authUser?.id || null,
        createdAt: authUser?.created_at || inviteRows[0]?.created_at || null,
        emailConfirmedAt: authUser?.email_confirmed_at || null,
        lastSignInAt: authUser?.last_sign_in_at || null,
        status,
        households: memberRows.map((m) => ({
          householdId: m.household_id,
          householdName: householdNameById[m.household_id] || '(unknown household)',
          relation: m.relation,
          role: m.role,
          name: m.name || null,
        })),
        invites: inviteRows.map((inv) => ({
          inviteId: inv.id,
          householdId: inv.household_id,
          householdName: householdNameById[inv.household_id] || '(unknown household)',
          status: inv.status,
          relation: inv.relation,
          name: inv.name || null,
        })),
      };
    });

    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.status(200).json({ users: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Could not load users' });
  }
}
