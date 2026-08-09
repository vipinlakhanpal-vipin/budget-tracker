import { requireUser, createAdminClient } from './admin/_auth.js';
import { sendMail } from './_mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_URL = 'https://budget-tracker-tau-liart.vercel.app';

// This file handles two unrelated jobs behind one route
// (POST /api/invite-member) purely to stay under Vercel Hobby's
// 12-serverless-function cap (see api/admin/users.js for the same
// constraint noted there): the original household-invite courtesy email,
// and (new) self-service account deletion. They're dispatched by an
// `action` field in the request body -- no `action` (or action === undefined)
// keeps the original invite-email behavior so nothing already calling this
// route needs to change.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { action } = req.body || {};
  if (action === 'deleteAccount') return deleteOwnAccount(req, res, user);

  return sendInviteEmail(req, res, user);
}

// Any signed-in household owner can call this after creating a
// household_invites row (see Dashboard.jsx handleSendInvite) -- it's just a
// courtesy notification email over the same free Gmail SMTP infra used for
// reports and rent reminders. The actual "join the household" logic doesn't
// depend on this email arriving: App.jsx auto-joins any signed-up user whose
// email matches a pending household_invites row regardless of whether they
// ever saw this message, so a failure here should never block the invite.
async function sendInviteEmail(req, res, user) {
  const { to, householdName } = req.body || {};
  if (!to || !EMAIL_RE.test(to)) {
    return res.status(400).json({ error: 'A valid recipient email is required' });
  }

  try {
    await sendMail({
      to,
      subject: `You're invited to join "${householdName || 'a household'}" on Hearth`,
      text: `${user.email} has invited you to join their household "${householdName || ''}" on Hearth.\n\nTo join, go to ${SITE_URL} and sign up (or sign in) using this exact email address (${to}) -- you'll be added to their household automatically.\n\nThis invite is private to your household and is never shared with anyone outside it.`,
    });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }

  res.status(200).json({ ok: true });
}

// Self-service account deletion (Settings > App > Delete My Account),
// built to satisfy Apple App Review guideline 5.1.1(v) / the equivalent
// Google Play requirement that any app supporting account creation must
// also offer in-app account deletion, without a support request.
//
// Always operates on the CALLER's own id (user.id, taken from their
// verified session token via requireUser) -- there is no way to pass a
// different user's id through this action, so this can't be used to delete
// someone else's account.
//
// Financial data the person created (expenses, income, fixed bills,
// savings goals, budgets, chat messages, attachments, invites they sent)
// is NOT deleted -- it's shared household data other members may still
// rely on, so `created_by`/`invited_by` is nulled out on it instead of the
// rows being removed. household_members, investments, and login_events
// rows are set up with ON DELETE CASCADE at the database level (see
// supabase/migration_households.sql, migration_investments.sql,
// migration_login_tracking.sql) so those clean up automatically once the
// underlying auth user is deleted -- note this means any investments the
// person created ARE deleted along with their account (a pre-existing
// schema behavior, not something new here).
//
// If this account was the only member of a household, that household's
// row is left in place with created_by = null; it becomes permanently
// inaccessible (RLS still requires membership) rather than being deleted
// outright, so no other member's data is ever touched by this action.
async function deleteOwnAccount(req, res, user) {
  const admin = createAdminClient();
  try {
    const nullColumn = (table, column = 'created_by') =>
      admin.from(table).update({ [column]: null }).eq(column, user.id);

    const results = await Promise.all([
      nullColumn('households'),
      nullColumn('expenses'),
      nullColumn('recurring_expenses'),
      nullColumn('incomes'),
      nullColumn('savings_goals'),
      nullColumn('monthly_budgets'),
      nullColumn('chat_messages'),
      nullColumn('row_attachments'),
      nullColumn('household_invites', 'invited_by'),
    ]);
    const cleanupError = results.find((r) => r.error)?.error;
    if (cleanupError) throw cleanupError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Could not delete account' });
  }
}
