import { requireUser } from './admin/_auth.js';
import { sendMail } from './_mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { to, subject, pdfBase64, filename, rangeLabel } = req.body || {};
  if (!to || !EMAIL_RE.test(to)) {
    return res.status(400).json({ error: 'A valid recipient email is required' });
  }
  if (!pdfBase64) {
    return res.status(400).json({ error: 'Missing report file' });
  }

  try {
    await sendMail({
      to,
      subject: subject || 'Your Hearth budget report',
      text: `Attached is your budget report${rangeLabel ? ` for ${rangeLabel}` : ''}, requested by ${user.email}.\n\nThis report is confidential -- please don't forward it to anyone outside your household.`,
      attachments: [
        {
          filename: filename || 'budget-report.pdf',
          content: pdfBase64,
          encoding: 'base64',
        },
      ],
    });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }

  res.status(200).json({ ok: true });
}
