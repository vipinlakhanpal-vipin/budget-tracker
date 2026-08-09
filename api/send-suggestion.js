import { requireUser } from './admin/_auth.js';
import { sendMail } from './_mailer.js';

// Footer "Support" form (see Dashboard.jsx handleSubmitSuggestion) -- any
// signed-in user can send a support request or product suggestion straight
// to the app owner's inbox over the same free Gmail SMTP infra already used
// for reports and invites. Kept under its original filename/route
// (send-suggestion.js, /api/send-suggestion) to avoid adding a 13th
// serverless function under Vercel Hobby's 12-function cap. Intentionally
// simple (one email, no DB table): the goal is just to get the message
// read, not to build a full ticketing system.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { name, email, location, message, topics } = req.body || {};
  if (!name || !name.trim() || !message || !message.trim()) {
    return res.status(400).json({ error: 'Name and message are required' });
  }
  const topicList = Array.isArray(topics) ? topics.filter((t) => typeof t === 'string' && t.trim()) : [];

  try {
    await sendMail({
      to: process.env.GMAIL_USER,
      subject: `Hearth support request from ${name.trim()}${topicList.length ? ` (${topicList.join(', ')})` : ''}`,
      text: [
        `Name: ${name.trim()}`,
        `Email: ${(email || '').trim() || '(not provided)'}`,
        `Location: ${(location || '').trim() || '(not provided)'}`,
        `Topics: ${topicList.length ? topicList.join(', ') : '(none selected)'}`,
        `Submitted by account: ${user.email}`,
        '',
        'Message:',
        message.trim(),
      ].join('\n'),
    });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }

  res.status(200).json({ ok: true });
}
