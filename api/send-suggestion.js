import { requireUser } from './admin/_auth.js';
import { sendMail } from './_mailer.js';

// Footer "Suggestion" form (see Dashboard.jsx handleSubmitSuggestion) -- any
// signed-in user can send product feedback straight to the app owner's
// inbox over the same free Gmail SMTP infra already used for reports and
// invites. This is intentionally simple (one email, no DB table): the goal
// is just to get the suggestion read, not to build a full feedback-tracking
// system.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { name, email, location, message } = req.body || {};
  if (!name || !name.trim() || !message || !message.trim()) {
    return res.status(400).json({ error: 'Name and suggestion message are required' });
  }

  try {
    await sendMail({
      to: process.env.GMAIL_USER,
      subject: `Hearth suggestion from ${name.trim()}`,
      text: [
        `Name: ${name.trim()}`,
        `Email: ${(email || '').trim() || '(not provided)'}`,
        `Location: ${(location || '').trim() || '(not provided)'}`,
        `Submitted by account: ${user.email}`,
        '',
        'Suggestion:',
        message.trim(),
      ].join('\n'),
    });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }

  res.status(200).json({ ok: true });
}
