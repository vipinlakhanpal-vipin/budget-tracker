import { createAdminClient, requireAdmin } from './_auth.js';

// This single endpoint powers the admin "Users" tab: GET lists every
// signup attempt across every household (successful and unsuccessful,
// cross-referencing auth.users / household_members / household_invites),
// and POST deletes a user Vipin picked from that list. Combined into one
// file (instead of two) to stay under Vercel Hobby's 12-serverless-function
// cap for this project.
export default async function handler(req, res) {
  if (req.method === 'GET') return listUsers(req, res);
  if (req.method === 'POST') {
    const action = (req.body || {}).action;
    if (action === 'insights') return getInsights(req, res);
    if (action === 'resetPassword') return resetPassword(req, res);
    return deleteUser(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function listUsers(req, res) {
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

    const [{ data: households, error: hErr }, { data: members, error: mErr }, { data: invites, error: iErr }, { data: loginEvents, error: leErr }] = await Promise.all([
      admin.from('households').select('id, name, created_at'),
      admin.from('household_members').select('id, household_id, user_id, email, role, relation, name, joined_at, phone, location, invited_by'),
      admin.from('household_invites').select('id, household_id, email, relation, status, name, created_at, invited_by'),
      // v2.23: powers the Users tab's Device and "Last seen" columns -- see
      // login_events in supabase/migration_login_tracking.sql (client
      // inserts a best-effort row on every real sign-in, from App.jsx).
      // Ordered newest-first so the reduce below can just keep the first
      // row it sees per user as "latest".
      admin.from('login_events').select('user_id, device_type, os, browser, city, region, country, created_at').order('created_at', { ascending: false }),
    ]);
    if (hErr) throw hErr;
    if (mErr) throw mErr;
    if (iErr) throw iErr
    if (leErr) throw leErr

    const latestLoginByUser = {}
    const recentLocationsByUser = {}
    for (const ev of loginEvents || []) {
      if (!latestLoginByUser[ev.user_id]) latestLoginByUser[ev.user_id] = ev
      const loc = [ev.city, ev.country].filter(Boolean).join(', ')
      if (loc) {
        const list = recentLocationsByUser[ev.user_id] || (recentLocationsByUser[ev.user_id] = [])
        if (!list.includes(loc) && list.length < 3) list.push(loc)
      }
    };

    // Feature-coverage usage % -- computed from data that already exists
    // (no new tracking table needed): does this person have at least one row
    // of their own in each of the app's core data tables, plus whether their
    // household has ever used the AI chat, plus whether they filled in their
    // own profile (Phone/Location).
    const [
      { data: expenseRows },
      { data: recurringRows },
      { data: incomeRows },
      { data: savingsRows },
      { data: chatRows },
    ] = await Promise.all([
      admin.from('expenses').select('created_by'),
      admin.from('recurring_expenses').select('created_by'),
      admin.from('incomes').select('created_by'),
      admin.from('savings_goals').select('created_by'),
      admin.from('chat_messages').select('household_id'),
    ]);
    const usedFeature = { expense: new Set(), recurring: new Set(), income: new Set(), savings: new Set() };
    (expenseRows || []).forEach((r) => r.created_by && usedFeature.expense.add(r.created_by));
    (recurringRows || []).forEach((r) => r.created_by && usedFeature.recurring.add(r.created_by));
    (incomeRows || []).forEach((r) => r.created_by && usedFeature.income.add(r.created_by));
    (savingsRows || []).forEach((r) => r.created_by && usedFeature.savings.add(r.created_by));
    const householdsWithChat = new Set((chatRows || []).map((r) => r.household_id));

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
        device: authUser && latestLoginByUser[authUser.id]
          ? [latestLoginByUser[authUser.id].device_type, latestLoginByUser[authUser.id].os, latestLoginByUser[authUser.id].browser].filter(Boolean).join(' / ') || null
          : null,
        lastSeenLocation: authUser && latestLoginByUser[authUser.id]
          ? ([latestLoginByUser[authUser.id].city, latestLoginByUser[authUser.id].country].filter(Boolean).join(', ') || null)
          : null,
        recentLocations: authUser ? (recentLocationsByUser[authUser.id] || []) : [],
        status,
        households: memberRows.map((m) => ({
          householdId: m.household_id,
          householdName: householdNameById[m.household_id] || '(unknown household)',
          relation: m.relation,
          role: m.role,
          name: m.name || null,
          phone: m.phone || null,
          location: m.location || null,
        })),
        invites: inviteRows.map((inv) => ({
          inviteId: inv.id,
          householdId: inv.household_id,
          householdName: householdNameById[inv.household_id] || '(unknown household)',
          status: inv.status,
          relation: inv.relation,
          name: inv.name || null,
        })),
        // 0-6 features touched -> a rough "how much of the app do they
        // actually use" percentage. null (not 0) for pending/never-signed-up
        // rows, since there's no real user_id yet to measure against.
        usagePercent: authUser
          ? Math.round(
              (100 *
                [
                  usedFeature.expense.has(authUser.id),
                  usedFeature.recurring.has(authUser.id),
                  usedFeature.income.has(authUser.id),
                  usedFeature.savings.has(authUser.id),
                  memberRows.some((m) => m.household_id && householdsWithChat.has(m.household_id)),
                  memberRows.some((m) => m.phone && m.location),
                ].filter(Boolean).length) /
                6
            )
          : null,
        // Names of people this user personally invited. Only populated going
        // forward from when invited_by started being recorded -- invites/
        // members created before that won't be attributed, which is expected.
        invitedNames: [],
      };
    });

    // Second pass: walk every member/invite row and, if it was invited by
    // someone in our list, add their name to that inviter's invitedNames.
    const rowsByUserId = {};
    rows.forEach((r) => { if (r.userId) rowsByUserId[r.userId] = r; });
    (members || []).forEach((m) => {
      if (m.invited_by && rowsByUserId[m.invited_by]) {
        rowsByUserId[m.invited_by].invitedNames.push(m.name || m.email);
      }
    });
    (invites || []).forEach((inv) => {
      if (inv.invited_by && rowsByUserId[inv.invited_by]) {
        rowsByUserId[inv.invited_by].invitedNames.push((inv.name || inv.email) + ' (pending)');
      }
    });

    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.status(200).json({ users: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Could not load users' });
  }
}

async function deleteUser(req, res) {
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


// Powers the "AI insights" button next to each successful signup in the
// admin Users tab -- reuses this same serverless function (rather than a
// new api/admin/*.js file) to stay under Vercel Hobby's 12-function cap.
// Same model/call pattern as api/chat-assistant.js.
async function getInsights(req, res) {
  try {
    await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const admin = createAdminClient();
  try {
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId);
    if (authErr || !authData?.user) throw authErr || new Error('User not found');
    const u = authData.user;

    const [{ data: members }, { data: expenseRows }, { data: recurringRows }, { data: incomeRows }, { data: savingsRows }] = await Promise.all([
      admin.from('household_members').select('household_id, name, relation, phone, location, joined_at').eq('user_id', userId),
      admin.from('expenses').select('id').eq('created_by', userId),
      admin.from('recurring_expenses').select('id').eq('created_by', userId),
      admin.from('incomes').select('id').eq('created_by', userId),
      admin.from('savings_goals').select('id').eq('created_by', userId),
    ]);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(200).json({ insight: null, aiEnabled: false });

    const facts = {
      email: u.email,
      joinedApp: u.created_at,
      lastSignIn: u.last_sign_in_at,
      emailConfirmed: !!u.email_confirmed_at,
      householdsCount: (members || []).length,
      regularExpensesLogged: (expenseRows || []).length,
      fixedExpensesLogged: (recurringRows || []).length,
      incomeEntriesLogged: (incomeRows || []).length,
      savingsEntriesLogged: (savingsRows || []).length,
      profileComplete: (members || []).some((m) => m.phone && m.location),
    };

    const systemPrompt = `You write a short (3-4 sentence) engagement summary for an app owner about one signed-up user of their household budget tracker app, Hearth. Be concise and factual, based only on the data given -- note how actively they seem to be using the app (which features they've touched, how recently active, whether their profile is filled in), not financial advice about their money. Plain prose, no headers or bullet points.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: JSON.stringify(facts) }],
      }),
    });

    if (!r.ok) {
      console.error('Anthropic API error:', r.status, await r.text());
      return res.status(200).json({ insight: null, aiEnabled: true });
    }
    const data = await r.json();
    const insight = (data?.content?.[0]?.text || '').trim();
    return res.status(200).json({ insight: insight || null, aiEnabled: true });
  } catch (e) {
    console.error('getInsights failed:', e);
    return res.status(500).json({ error: e.message || 'Could not generate insights' });
  }
}


// Powers the "Reset Password" button in the Admin Console's Users tab.
// Vipin explicitly asked for admin-set passwords (not a self-service
// "email a reset link" flow), so this sets the password directly via the
// Supabase service-role Admin API and hands the plaintext value back in
// the response once so it can be shared with the user -- it is never
// stored or logged anywhere.
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

async function resetPassword(req, res) {
  try {
    await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }
  const { userId, newPassword } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const password = (newPassword && newPassword.trim()) || generatePassword();
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const admin = createAdminClient();
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
    res.status(200).json({ ok: true, password });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Could not reset password' });
  }
}
