import { requireUser } from './admin/_auth.js';
import { sendMail } from './_mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_URL = 'https://budget-tracker-tau-liart.vercel.app';

// Any signed-in household owner can call this after creating a
// household_invites row (see Dashboard.jsx handleSendInvite) -- it's just a
// courtesy notification email over the same free Gmail SMTP infra used for
// reports and rent reminders. The actual "join the household" logic doesn't
// depend on this email arriving: App.jsx auto-joins any signed-up user whose
// email matches a pending household_invites row regardless of whether they
// ever saw this message, so a failure here should never block the invite.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

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
