import { createAdminClient } from '../admin/_auth.js';
import { sendMail } from '../_mailer.js';

// Runs once a day (see vercel.json) and emails every household member about
// any fixed expense (rent, EMI, bill, etc.) whose due date is within its
// reminder window -- by default 3 days out -- repeating daily right up to
// and including the due date itself. Skips quietly (no error) if the Gmail
// env vars haven't been added yet, so a missing config doesn't show up as a
// failed cron run for something that's expected to be off until set up.
//
// Also runs the per-category budget threshold check right after (see
// checkCategoryBudgetAlerts below) -- kept in this same file/function rather
// than a new api/cron/*.js file, since the Vercel Hobby plan caps serverless
// functions at 12 and this project is already right at that limit (see the
// "Fix Vercel Hobby function-count limit" commit). One cron schedule, one
// function, two independent checks.
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

  const billResult = await sendRentReminders(admin);
  const budgetResult = await checkCategoryBudgetAlerts(admin);

  if (billResult.error) return res.status(500).json({ error: billResult.error });
  if (budgetResult.error) return res.status(500).json({ error: budgetResult.error });

  res.status(200).json({
    ok: true,
    rentReminders: { sent: billResult.sent, errors: billResult.errors },
    budgetAlerts: { sent: budgetResult.sent, errors: budgetResult.errors },
  });
}

async function sendRentReminders(admin) {
  const { data: bills, error } = await admin
    .from('recurring_expenses')
    .select('id, household_id, name, amount, due_date, remind_before_days, active')
    .eq('active', true)
    .not('due_date', 'is', null);

  if (error) return { error: error.message, sent: 0, errors: [] };

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
    return { sent: 0, errors: [] };
  }

  const householdIds = [...new Set(due.map((b) => b.household_id))];
  const { data: members, error: memErr } = await admin
    .from('household_members')
    .select('household_id, email')
    .in('household_id', householdIds);
  if (memErr) return { error: memErr.message, sent: 0, errors: [] };

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

  return { sent, errors };
}

// Per-category budget threshold alerts -- 35%, 60% and 100% of a category's
// monthly_budget each fire exactly once per household+category+month (see
// category_alert_log's unique constraint in
// supabase/migration_category_alerts.sql). Once a category is over 100%, a
// separate "still over budget" nudge fires once a day (not more than once a
// day, since last_sent_date is checked/bumped per calendar day) for as long
// as it stays over 100%, resetting naturally next month since the log rows
// are keyed by month.
async function checkCategoryBudgetAlerts(admin) {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${month}-01`;
  const monthEndDate = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const { data: categories, error: catErr } = await admin
    .from('categories')
    .select('id, name, monthly_budget, household_id')
    .gt('monthly_budget', 0);
  if (catErr) return { error: catErr.message, sent: 0, errors: [] };
  if (!categories || categories.length === 0) return { sent: 0, errors: [] };

  const householdIds = [...new Set(categories.map((c) => c.household_id))];

  const [{ data: expenses, error: expErr }, { data: recurring, error: recErr }, { data: members, error: memErr }, { data: existingLogs, error: logErr }] = await Promise.all([
    admin.from('expenses').select('category_id, household_id, amount, expense_date').in('household_id', householdIds).gte('expense_date', monthStart).lte('expense_date', monthEnd),
    admin.from('recurring_expenses').select('category_id, household_id, amount, start_date, end_date, active').in('household_id', householdIds).eq('active', true),
    admin.from('household_members').select('household_id, email').in('household_id', householdIds),
    admin.from('category_alert_log').select('household_id, category_id, threshold, last_sent_date').eq('month', month),
  ]);
  if (expErr) return { error: expErr.message, sent: 0, errors: [] };
  if (recErr) return { error: recErr.message, sent: 0, errors: [] };
  if (memErr) return { error: memErr.message, sent: 0, errors: [] };
  if (logErr) return { error: logErr.message, sent: 0, errors: [] };

  const emailsByHousehold = {};
  (members || []).forEach((m) => {
    (emailsByHousehold[m.household_id] ||= new Set()).add(m.email);
  });

  const spendByCategory = {};
  (expenses || []).forEach((e) => {
    spendByCategory[e.category_id] = (spendByCategory[e.category_id] || 0) + Number(e.amount);
  });
  (recurring || []).forEach((r) => {
    // Active for at least part of the current month -- same "full monthly
    // amount counts if active this month" rule the app's own byCategory
    // calc uses for Fixed Expenses.
    if (r.start_date > monthEnd) return;
    if (r.end_date && r.end_date < monthStart) return;
    spendByCategory[r.category_id] = (spendByCategory[r.category_id] || 0) + Number(r.amount);
  });

  const logKey = (householdId, categoryId, threshold) => `${householdId}|${categoryId}|${threshold}`;
  const existingByKey = {};
  (existingLogs || []).forEach((l) => {
    existingByKey[logKey(l.household_id, l.category_id, l.threshold)] = l;
  });

  let sent = 0;
  const errors = [];
  const rowsToUpsert = [];

  for (const cat of categories) {
    const recipients = [...(emailsByHousehold[cat.household_id] || [])];
    if (recipients.length === 0) continue;
    const spend = spendByCategory[cat.id] || 0;
    const budget = Number(cat.monthly_budget);
    if (!budget) continue;
    const pct = (spend / budget) * 100;

    for (const threshold of [35, 60, 100]) {
      if (pct < threshold) continue;
      const key = logKey(cat.household_id, cat.id, threshold);
      if (existingByKey[key]) continue; // already sent once this month
      try {
        await sendMail({
          to: recipients.join(','),
          subject: `${cat.name}: ${threshold}% of this month's budget reached`,
          text: `You've used ${Math.round(pct)}% of your ${cat.name} budget this month (${spend.toFixed(2)} of ${budget.toFixed(2)}).\n\nThis is an automated alert from Hearth.`,
        });
        sent++;
        rowsToUpsert.push({ household_id: cat.household_id, category_id: cat.id, month, threshold, last_sent_date: todayStr });
      } catch (e) {
        errors.push(e.message);
      }
    }

    if (pct > 100) {
      const key = logKey(cat.household_id, cat.id, 999);
      const existing = existingByKey[key];
      if (!existing || existing.last_sent_date !== todayStr) {
        try {
          await sendMail({
            to: recipients.join(','),
            subject: `${cat.name}: still over budget (${Math.round(pct)}%)`,
            text: `${cat.name} is now at ${Math.round(pct)}% of its monthly budget (${spend.toFixed(2)} of ${budget.toFixed(2)}) -- ${(spend - budget).toFixed(2)} over.\n\nThis is an automated alert from Hearth. You'll keep getting this once a day for as long as this category stays over budget this month.`,
          });
          sent++;
          rowsToUpsert.push({ household_id: cat.household_id, category_id: cat.id, month, threshold: 999, last_sent_date: todayStr });
        } catch (e) {
          errors.push(e.message);
        }
      }
    }
  }

  if (rowsToUpsert.length > 0) {
    const { error: upsertErr } = await admin
      .from('category_alert_log')
      .upsert(rowsToUpsert, { onConflict: 'household_id,category_id,month,threshold' });
    if (upsertErr) errors.push(upsertErr.message);
  }

  return { sent, errors };
}
