import { createAdminClient } from '../admin/_auth.js';
import { sendMail } from '../_mailer.js';

// Runs once a day (see vercel.json) and emails every household member about
// any fixed expense (rent, EMI, bill, etc.) whose due date is within its
// reminder window -- by default 3 days out -- repeating daily right up to
// and including the due date itself. Skips quietly (no error) if the Gmail
// env vars haven't been added yet, so a missing config doesn't show up as a
// failed cron run for something that's expected to be off until set up.
export default async function handler(req, res) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(200).json({ ok: true, skipped: 'email not configured' });
  }

  const admin = createAdminClient();

  const { data: bills, error } = await admin
    .from('recurring_expenses')
    .select('id, household_id, name, amount, due_date, remind_before_days, active')
    .eq('active', true)
    .not('due_date', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const due = (bills || [])
    .map((b) => {
      const dueDate = new Date(b.due_date + 'T00:00:00Z');
      const daysUntil = Math.round((dueDate - today) / 86400000);
      return { ...b, daysUntil };
    })
    .filter((b) => b.daysUntil >= 0 && b.daysUntil <= (b.remind_before_days ?? 3));

  if (due.length === 0) {
    return res.status(200).json({ ok: true, sent: 0 });
  }

  const householdIds = [...new Set(due.map((b) => b.household_id))];
  const { data: members, error: memErr } = await admin
    .from('household_members')
    .select('household_id, email')
    .in('household_id', householdIds);
  if (memErr) return res.status(500).json({ error: memErr.message });

  const emailsByHousehold = {};
  (members || []).forEach((m) => {
    (emailsByHousehold[m.household_id] ||= new Set()).add(m.email);
  });

  let sent = 0;
  const errors = [];
  for (const bill of due) {
    const recipients = [...(emailsByHousehold[bill.household_id] || [])];
    if (recipients.length === 0) continue;
    const whenText = bill.daysUntil === 0 ? 'today' : `in ${bill.daysUntil} day${bill.daysUntil > 1 ? 's' : ''}`;
    try {
      await sendMail({
        to: recipients.join(','),
        subject: `Reminder: ${bill.name} is due ${whenText}`,
        text: `${bill.name} (amount ${bill.amount}) is due ${whenText}, on ${bill.due_date}.\n\nThis is an automated reminder from Hearth. You'll keep getting this daily until the due date.`,
      });
      sent++;
    } catch (e) {
      errors.push(e.message);
    }
  }

  res.status(200).json({ ok: true, sent, errors });
}
